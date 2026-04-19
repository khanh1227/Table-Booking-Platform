"""
PhoBERT Inference Service — Singleton pattern để load model 1 lần.
"""
import re
import json
import logging
import threading
from pathlib import Path

import torch
from transformers import AutoTokenizer, RobertaConfig

from django.conf import settings

logger = logging.getLogger(__name__)

# ─── Label configs ────────────────────────────────────────────────────────────
INTENT_CLASSES = [
    "ask_alternative", "ask_contact", "ask_help", "ask_location",
    "ask_operating_hours", "book_table", "chitchat", "out_of_scope",
    "reject_suggestion", "suggest_dish", "suggest_restaurant",
]
ENTITY_TYPES = ["PEOPLE_COUNT", "DATE", "TIME", "CUISINE", "LOCATION", "PRICE", "RESTAURANT", "OCCASION"]
NER_CLASSES = ["O"]
for e in ENTITY_TYPES:
    NER_CLASSES.append(f"B-{e}")
    NER_CLASSES.append(f"I-{e}")

intent2id = {l: i for i, l in enumerate(INTENT_CLASSES)}
id2intent = {i: l for l, i in intent2id.items()}
ner2id    = {l: i for i, l in enumerate(NER_CLASSES)}
id2ner    = {i: l for l, i in ner2id.items()}


# ─── Lazy import model class (tránh import nặng nề ở module level) ──────────
def _get_model_class():
    from torch import nn
    from torch.nn import CrossEntropyLoss
    from transformers import PreTrainedModel, RobertaModel

    class JointIntentNERModel(PreTrainedModel):
        config_class = RobertaConfig

        def __init__(self, config, num_intents, num_ner_labels):
            super().__init__(config)
            self.num_intents = num_intents
            self.num_ner_labels = num_ner_labels
            self.roberta = RobertaModel(config, add_pooling_layer=False)
            self.dropout = nn.Dropout(config.hidden_dropout_prob)
            self.intent_classifier = nn.Linear(config.hidden_size, num_intents)
            self.ner_classifier = nn.Linear(config.hidden_size, num_ner_labels)
            self.post_init()

        @classmethod
        def _can_set_experts_implementation(cls):
            return False

        def forward(self, input_ids=None, attention_mask=None, token_type_ids=None,
                    intent_labels=None, labels=None):
            outputs = self.roberta(input_ids, attention_mask=attention_mask)
            seq = self.dropout(outputs[0])
            ner_logits    = self.ner_classifier(seq)
            intent_logits = self.intent_classifier(seq[:, 0, :])
            loss = None
            if intent_labels is not None and labels is not None:
                fct = CrossEntropyLoss()
                intent_loss = fct(intent_logits.view(-1, self.num_intents), intent_labels.view(-1))
                active = attention_mask.view(-1) == 1
                ner_loss = fct(ner_logits.view(-1, self.num_ner_labels)[active], labels.view(-1)[active])
                loss = intent_loss + ner_loss
            return (loss, intent_logits, ner_logits) if loss is not None else (intent_logits, ner_logits)

    return JointIntentNERModel


# ─── Singleton ────────────────────────────────────────────────────────────────
_lock     = threading.Lock()
_instance = None


class PhoBERTService:
    """
    Singleton wrapper xung quanh PhoBERT joint model.
    Sử dụng: PhoBERTService.get_instance().predict(text)
    """

    def __init__(self):
        model_path = getattr(settings, 'PHOBERT_MODEL_PATH',
                             Path(__file__).resolve().parent.parent / 'phobert')
        model_path = Path(model_path)
        logger.info(f"[PhoBERT] Loading model from {model_path}")

        self.tokenizer = AutoTokenizer.from_pretrained(str(model_path))
        self.device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        JointIntentNERModel = _get_model_class()
        self.model = JointIntentNERModel.from_pretrained(
            str(model_path),
            num_intents=len(INTENT_CLASSES),
            num_ner_labels=len(NER_CLASSES),
        )
        self.model.to(self.device)
        self.model.eval()
        logger.info("[PhoBERT] Model loaded successfully.")

    @classmethod
    def get_instance(cls) -> 'PhoBERTService':
        global _instance
        if _instance is None:
            with _lock:
                if _instance is None:
                    _instance = cls()
        return _instance

    # ── Inference ──────────────────────────────────────────────────────────
    def predict(self, text: str) -> dict:
        """
        Returns:
            {
                "intent": str,
                "intent_confidence": float,   # 0-1
                "entities": {entity_type: value}
            }
        """
        words = re.findall(r'\w+|[^\w\s]', text)

        ids   = [self.tokenizer.cls_token_id]
        # word_token_map[i] = index vào token_labels của word thứ i (-1 nếu không có subtoken)
        word_first_token_pos: list[int] = []

        for w in words:
            subs = self.tokenizer.tokenize(w)
            if subs:
                word_first_token_pos.append(len(ids) - 1)  # vị trí tương đối trong ids (trừ CLS)
                ids.extend(self.tokenizer.convert_tokens_to_ids(subs))
            else:
                word_first_token_pos.append(-1)  # word không có subtoken
        ids.append(self.tokenizer.sep_token_id)

        input_ids      = torch.tensor([ids]).to(self.device)
        attention_mask = torch.tensor([[1] * len(ids)]).to(self.device)

        with torch.no_grad():
            out = self.model(input_ids=input_ids, attention_mask=attention_mask)
            intent_logits, ner_logits = out[0], out[1]

        # ── Intent ─────────────────────────────────────────────────────────
        scores     = torch.softmax(intent_logits, dim=1).squeeze().cpu().tolist()
        intent_idx = int(torch.argmax(intent_logits, dim=1).item())
        intent     = id2intent[intent_idx]
        confidence = scores[intent_idx]

        # ── NER ─────────────────────────────────────────────────────────────
        # ner_preds shape: (seq_len,) — loại bỏ CLS (idx 0) và SEP (idx cuối)
        ner_pred_all = ner_logits.argmax(dim=2).squeeze(0).cpu().tolist()
        token_labels = ner_pred_all[1:-1]   # bỏ CLS, SEP

        # Gán nhãn cho từng word dựa trên first-subtoken
        word_labels: list[str] = []
        for pos in word_first_token_pos:
            if pos < 0 or pos >= len(token_labels):
                word_labels.append('O')
            else:
                word_labels.append(id2ner[token_labels[pos]])

        # Gom entity spans
        entities: dict[str, str] = {}
        cur_type: str | None = None
        cur_words: list[str] = []

        def flush():
            if cur_type and cur_words:
                entities[cur_type] = ' '.join(cur_words)

        for word, lbl in zip(words, word_labels):
            if lbl.startswith('B-'):
                flush()
                cur_type  = lbl[2:]
                cur_words = [word]
            elif lbl.startswith('I-') and cur_type == lbl[2:]:
                cur_words.append(word)
            else:
                flush()
                cur_type  = None
                cur_words = []
        flush()

        return {
            "intent":            intent,
            "intent_confidence": confidence,
            "entities":          entities,
        }
