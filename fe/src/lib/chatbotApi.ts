// lib/chatbotApi.ts
const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

// ======================== TYPES ========================
export type ChatbotAskPayload = {
  message?: string;
  session_key?: string;
  postback?: {
    action: string;
    [key: string]: any;
  };
  user_id?: number;
};

export type ChatbotAskResponse = {
  session_key: string;
  message: string;
  action: string;
  action_data: any;
  debug?: {
    resolved_intent: string;
    entities: any;
    raw_confidence: number;
  };
};

export type ChatbotHealthResponse = {
  status: 'healthy' | 'unhealthy';
  model_loaded?: boolean;
  faq_count?: number;
  intent_count?: number;
  timestamp: string;
  error?: string;
};

export type ChatbotTestPayload = {
  questions: string[];
};

export type ChatbotTestResponse = {
  total: number;
  results: Array<{
    question: string;
    answer?: string;
    type?: string;
    confidence?: number;
    intent?: string;
    slots?: any;
    error?: string;
  }>;
};

// ======================== API FUNCTIONS ========================

/**
 * Gửi câu hỏi đến chatbot
 */
export async function askChatbot(
  payload: ChatbotAskPayload
): Promise<ChatbotAskResponse> {
  const url = `${BASE}/api/chatbot/message/`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || data.message || 'Chatbot request failed');
  }

  return data;
}

/**
 * Health check chatbot
 */
export async function checkChatbotHealth(): Promise<ChatbotHealthResponse> {
  const res = await fetch(`${BASE}/api/chatbot/health/`, {
    method: 'GET',
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Health check failed');
  }

  return data;
}

/**
 * Batch test chatbot
 */
export async function testChatbot(
  payload: ChatbotTestPayload
): Promise<ChatbotTestResponse> {
  const res = await fetch(`${BASE}/api/chatbot/test/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Batch test failed');
  }

  return data;
}

/**
 * Gửi câu hỏi đến chatbot và nhận kết quả dạng stream (SSE)
 */
export async function* askChatbotStream(
  payload: ChatbotAskPayload
): AsyncGenerator<{ type: string; content?: string; action?: string; action_data?: any }> {
  // Ở môi trường dev, port chatbot là 8001
  const CHATBOT_URL = BASE.replace(":8000", ":8001") + "/chat/stream";
  
  const response = await fetch(CHATBOT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Streaming request failed');
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      if (trimmedLine.startsWith('data: ')) {
        try {
          const jsonStr = trimmedLine.slice(6).trim();
          if (jsonStr) {
            yield JSON.parse(jsonStr);
          }
        } catch (e) {
          console.error("Lỗi parse SSE chunk:", e, "Line:", trimmedLine);
        }
      }
    }
  }
}