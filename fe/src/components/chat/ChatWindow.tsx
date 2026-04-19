// components/chat/ChatWindow.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import { useNavigate } from 'react-router-dom';
import ChatFloatingPanel, { type PanelContent } from './ChatFloatingPanel';
import BookingForm from '../bookings/BookingForm';
import type { PrefillBooking } from '@/types/chatbot';
import { askChatbot } from '@/lib/chatbotApi';
import {
  getChatSession,
  addMessage,
  clearChatHistory,
  generateMessageId,
} from '@/utils/chatStorage';
import type { ChatMessage as ChatMessageType } from '@/types/chatbot';
import ChatAutocomplete from './ChatAutocomplete';
import type { AutocompleteItem } from '@/lib/fuzzySearch';
import { shouldEnableRestaurantAutocomplete } from './autocompleteTrigger';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ChatWindow({ isOpen, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [autocompleteVisible, setAutocompleteVisible] = useState(false);
  
  // Single active overlay states
  const [activePanel, setActivePanel] = useState<PanelContent | null>(null);
  const [activeBooking, setActiveBooking] = useState<{ id: number; name: string; address: string; date: string; guests: string } | null>(null);

  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history khi mở
  useEffect(() => {
    if (isOpen) {
      const session = getChatSession();
      if (session) {
        setMessages(session.messages);
      } else {
        // Welcome message
        const welcomeMsg: ChatMessageType = {
          id: generateMessageId(),
          role: 'bot',
          content: 'Xin chào! Tôi có thể giúp gì cho bạn? 😊',
          timestamp: Date.now(),
        };
        setMessages([welcomeMsg]);
        addMessage(welcomeMsg);
      }

      // Focus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSend = async (textOverride?: string, postbackPayload?: any) => {
    const question = textOverride !== undefined ? textOverride.trim() : input.trim();
    if ((!question && !postbackPayload) || isLoading) return;

    if (question) {
      const userMsg: ChatMessageType = {
        id: generateMessageId(),
        role: 'user',
        content: question,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      addMessage(userMsg);
    }

    setInput('');
    setIsLoading(true);

    try {
      const session = getChatSession();
      // Call API
      const response = await askChatbot({
        message: question,
        session_key: session?.session_key,
        postback: postbackPayload,
      });

      // Bot response
      const botMsg: ChatMessageType = {
        id: generateMessageId(),
        role: 'bot',
        content: response.message,
        timestamp: Date.now(),
        action: response.action as any,
        action_data: response.action_data,
        confidence: response.debug?.raw_confidence,
      };

      setMessages((prev) => [...prev, botMsg]);
      addMessage(botMsg);
    } catch (error) {
      // Error message
      const errorMsg: ChatMessageType = {
        id: generateMessageId(),
        role: 'bot',
        content: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau. 😔',
        timestamp: Date.now(),
        action: 'NONE',
      };

      setMessages((prev) => [...prev, errorMsg]);
      addMessage(errorMsg);
      console.error('Chatbot error:', error);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Clear history
  const handleClear = () => {
    if (confirm('Xóa toàn bộ lịch sử chat?')) {
      clearChatHistory();
      setMessages([]);

      // Add welcome back
      const welcomeMsg: ChatMessageType = {
        id: generateMessageId(),
        role: 'bot',
        content: 'Lịch sử đã được xóa. Bạn cần hỗ trợ gì không? 😊',
        timestamp: Date.now(),
      };
      setMessages([welcomeMsg]);
      addMessage(welcomeMsg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-4 w-96 h-[600px] bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-2xl">
            🤖
          </div>
          <div>
            <h3 className="font-semibold text-white">Chatbot Hỗ Trợ</h3>
            <p className="text-xs text-blue-100">Luôn sẵn sàng giúp bạn</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Clear button */}
          <button
            onClick={handleClear}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Xóa lịch sử"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-950">
        {messages.map((msg) => (
          <ChatMessage 
            key={msg.id} 
            message={msg} 
            onSendMessage={handleSend}
            onOpenPanel={(content) => {
              setActiveBooking(null); // Close booking if opening panel
              setActivePanel(content);
            }}
            onOpenBooking={(data) => {
              setActivePanel(null); // Close panel if opening booking
              setActiveBooking(data);
            }}
          />
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
              🤖
            </div>
            <div className="bg-gray-800 px-4 py-2.5 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-gray-900 border-t border-gray-700 relative">
        <ChatAutocomplete
          query={input}
          visible={autocompleteVisible}
          onClose={() => setAutocompleteVisible(false)}
          onSelect={(item: AutocompleteItem) => {
            const current = input;
            const triggerRegex = /((?:nhà\s*hàng|nha\s*hang|quán|quan|(?:đặt|dat)\s*(?:bàn|ban)\s+(?:ở|o|tại|tai))\s+)([^.?!,\n]*)$/i;
            const match = current.match(triggerRegex);
            let next = current;
            if (match && match.index !== undefined) {
              const prefix = current.slice(0, match.index) + match[1];
              next = `${prefix}${item.name} `;
            }
            setInput(next);
            setAutocompleteVisible(false);
            inputRef.current?.focus();
          }}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAutocompleteVisible(false);
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);
              setAutocompleteVisible(shouldEnableRestaurantAutocomplete(val));
            }}
            onFocus={() => setAutocompleteVisible(shouldEnableRestaurantAutocomplete(input))}
            placeholder="Nhập câu hỏi của bạn..."
            className="flex-1 bg-gray-800 text-white px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            disabled={isLoading}
          />

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>

      {/* Global Overlays - ensures only one is open at a time across all messages */}
      {activePanel && (
        <ChatFloatingPanel
          content={activePanel}
          onClose={() => setActivePanel(null)}
        />
      )}

      {activeBooking && (
        <BookingForm
          restaurant={activeBooking as any}
          initialDate={activeBooking.date}
          initialGuests={activeBooking.guests}
          onClose={() => setActiveBooking(null)}
          onSuccess={() => {
            setActiveBooking(null);
            onClose(); // Close chat window
            navigate("/my-bookings");
          }}
        />
      )}
    </div>
  );
}