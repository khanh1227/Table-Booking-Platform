// components/chat/ChatWindow.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import { useNavigate } from 'react-router-dom';
import ChatFloatingPanel, { type PanelContent } from './ChatFloatingPanel';
import BookingForm from '../bookings/BookingForm';
import type { PrefillBooking } from '@/types/chatbot';
import { askChatbotStream } from '@/lib/chatbotApi';
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

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ChatWindow({ isOpen, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [autocompleteVisible, setAutocompleteVisible] = useState(false);

  const [activePanel, setActivePanel] = useState<PanelContent | null>(null);
  const [activeBooking, setActiveBooking] = useState<any | null>(null);

  const handleAutoConfirm = async (b: any) => {
    const access = localStorage.getItem('access');
    if (!access) return;

    try {
      const payload = {
        restaurant: b.restaurant_id,
        time_slot: b.time_slot_id,
        booking_date: b.booking_date,
        number_of_guests: b.number_of_guests,
        special_request: b.special_request || undefined,
      };

      const res = await fetch(`${API_BASE}/api/bookings/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${access}`
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        let errorMsg = "Đặt bàn thất bại";
        if (data.detail) {
          errorMsg = data.detail;
        } else if (typeof data === 'object') {
          // Lấy message đầu tiên từ error dictionary (ví dụ: { "time_slot": ["..."] })
          const firstKey = Object.keys(data)[0];
          if (firstKey) {
            const val = data[firstKey];
            errorMsg = Array.isArray(val) ? val[0] : String(val);
          }
        }
        throw new Error(errorMsg);
      }

      const bookingId = data?.id || data?.data?.id;
      
      // Gửi tin nhắn thông báo thành công vào chat
      const successMsg: ChatMessageType = {
        id: generateMessageId(),
        role: 'bot',
        content: `✅ **Đã đặt bàn thành công!**\n\nNhà hàng: **${b.restaurant_name || 'Nhà hàng'}**\nMã đơn: **#${bookingId}**\n\nBạn có thể kiểm tra chi tiết trong phần **Lịch sử đặt bàn**. Chúc bạn ngon miệng! 🍽️`,
        timestamp: Date.now(),
        action: 'BOOKING_SUCCESS',
        action_data: { 
          restaurant_name: b.restaurant_name, 
          restaurant_id: b.restaurant_id, 
          booking_id: bookingId 
        }
      };
      setMessages(prev => [...prev, successMsg]);
      addMessage(successMsg);

      // Gửi tín hiệu báo cho chatbot biết để xóa state
      setTimeout(() => {
        handleSend('', { action: 'booking_success' });
      }, 500);

    } catch (err: any) {
      const errMsg: ChatMessageType = {
        id: generateMessageId(),
        role: 'bot',
        content: `⚠️ **Lỗi đặt bàn tự động:** ${err.message}\n\nVui lòng thử lại hoặc nhấn nút "Kiểm tra & Sửa" để đặt thủ công.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
      addMessage(errMsg);
    }
  };

  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const session = getChatSession();
      if (session) {
        setMessages(session.messages);
      } else {
        const welcomeMsg: ChatMessageType = {
          id: generateMessageId(),
          role: 'bot',
          content: 'Xin chào! 👋 Mình là trợ lý đặt bàn AI.\n\nMình có thể giúp bạn:\n• 🔍 Tìm nhà hàng theo khu vực, ẩm thực\n• 🍜 Gợi ý món ăn\n• 📅 Đặt bàn nhanh chóng',
          timestamp: Date.now(),
        };
        setMessages([welcomeMsg]);
        addMessage(welcomeMsg);
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      const botMsgId = generateMessageId();
      
      // Lấy user_id từ localStorage nếu đã đăng nhập
      let userId: number | undefined = undefined;
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          userId = user.id;
        } catch (e) {
          console.error("Error parsing user from localStorage:", e);
        }
      }

      const botMsg: ChatMessageType = {
        id: botMsgId,
        role: 'bot',
        content: '',
        timestamp: Date.now(),
        action: 'NONE',
      };

      setMessages((prev) => [...prev, botMsg]);

      const stream = askChatbotStream({
        message: question,
        session_key: session?.session_key,
        postback: postbackPayload,
        user_id: userId, // Truyền user_id sang chatbot service
      });

      let fullContent = '';
      let finalAction = 'SHOW_INFO';
      let finalData = {};

      for await (const chunk of stream) {
        if (chunk.type === 'tool_start') {
          // Giữ bouncing dots khi đang gọi tool
        } else if (chunk.type === 'text') {
          fullContent += chunk.content || '';
          setMessages((prev) =>
            prev.map(m => m.id === botMsgId ? { ...m, content: fullContent } : m)
          );
        } else if (chunk.type === 'final') {
          finalAction = chunk.action || 'SHOW_INFO';
          finalData = chunk.action_data || {};
          setMessages((prev) =>
            prev.map(m => m.id === botMsgId ? {
              ...m,
              action: finalAction as any,
              action_data: finalData
            } : m)
          );
        }
      }

      // Auto-open panel for specific actions
      if (finalAction === 'SHOW_RESTAURANTS' && finalData.restaurants) {
        setActivePanel({ type: 'restaurants', items: finalData.restaurants, title: 'Gợi ý nhà hàng' });
      } else if (finalAction === 'SHOW_DISHES' && finalData.dishes) {
        setActivePanel({ type: 'dishes', items: finalData.dishes, title: 'Gợi ý món ăn' });
      } else if (finalAction === 'CONFIRM_BOOKING' && finalData.booking) {
        // Thực hiện đặt bàn ngầm (Background booking)
        handleAutoConfirm(finalData.booking);
      }

      addMessage({
        ...botMsg,
        content: fullContent,
        action: finalAction as any,
        action_data: finalData
      });

    } catch (error) {
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

  const handleClear = () => {
    if (confirm('Xóa toàn bộ lịch sử chat?')) {
      clearChatHistory();
      const welcomeMsg: ChatMessageType = {
        id: generateMessageId(),
        role: 'bot',
        content: 'Đã xóa lịch sử. Mình có thể giúp gì cho bạn? 😊',
        timestamp: Date.now(),
      };
      setMessages([welcomeMsg]);
      addMessage(welcomeMsg);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-6 right-6 w-96 h-[650px] flex flex-col overflow-hidden z-50 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
      style={{
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f172a 100%)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.1)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3.5 flex items-center justify-between flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.1) 100%)',
          borderBottom: '1px solid rgba(245,158,11,0.15)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              boxShadow: '0 0 16px rgba(245,158,11,0.4)',
            }}
          >
            🤖
          </div>
          <div>
            <h3 className="font-bold text-white text-sm tracking-tight">Trợ lý Đặt Bàn AI</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <p className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Sẵn sàng hỗ trợ 24/7
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            className="p-2 rounded-xl transition-all hover:bg-white/10 active:scale-90"
            title="Xóa lịch sử"
          >
            <svg className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-all hover:bg-white/10 active:scale-90"
          >
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-3 py-4 space-y-4"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
      >
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onSendMessage={handleSend}
            onOpenPanel={(content) => {
              setActiveBooking(null);
              setActivePanel(content);
            }}
            onOpenBooking={(data) => {
              setActivePanel(null);
              setActiveBooking(data);
            }}
            onConfirmBooking={(booking) => {
              handleAutoConfirm(booking);
            }}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="p-3 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
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
            placeholder="Nhập tin nhắn..."
            className="flex-1 px-4 py-2.5 rounded-xl text-sm transition-all outline-none"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.9)',
              caretColor: '#f59e0b',
            }}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            style={{
              background: input.trim() && !isLoading
                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                : 'rgba(255,255,255,0.08)',
            }}
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>

      {/* Overlays */}
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
          initialTime={activeBooking.time}
          onClose={() => setActiveBooking(null)}
          onSuccess={(_bookingId) => {
            setActiveBooking(null);
            const successMsg: ChatMessageType = {
              id: generateMessageId(),
              role: 'bot',
              content: `✅ Đặt bàn thành công tại **${activeBooking.name}**!\n\nBạn có thể xem và quản lý đơn trong mục **Lịch sử đặt bàn**. 🍽️`,
              timestamp: Date.now(),
              action: 'BOOKING_SUCCESS',
              action_data: {
                restaurant_name: activeBooking.name,
                restaurant_id: activeBooking.id,
                booking_id: _bookingId,
              },
            };
            setMessages((prev) => [...prev, successMsg]);
            addMessage(successMsg);

            // Gửi tín hiệu báo cho chatbot biết để xóa state
            setTimeout(() => {
              handleSend('', { action: 'booking_success' });
            }, 500);
          }}
        />
      )}
    </div>
  );
}