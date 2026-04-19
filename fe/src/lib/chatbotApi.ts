// lib/chatbotApi.ts
const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

// ======================== TYPES ========================
export type ChatbotAskPayload = {
  message?: string;
  session_key?: string;
  postback?: {
    intent: string;
    entities: Record<string, any>;
  };
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
 * POST /api/chatbot/ask/
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
 * GET /api/chatbot/health/
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
 * POST /api/chatbot/test/
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