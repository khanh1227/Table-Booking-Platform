// components/chat/ChatMessage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChatMessage as ChatMessageType, RestaurantCard, DishCard, PrefillBooking } from '../../types/chatbot';
import ChatFloatingPanel, { type PanelContent } from './ChatFloatingPanel';
import BookingForm from '../bookings/BookingForm';

type Props = {
  message: ChatMessageType;
  onSendMessage?: (text: string, postback?: any) => void;
  onOpenPanel?: (content: PanelContent) => void;
  onOpenBooking?: (data: { id: number; name: string; address: string; date: string; guests: string }) => void;
};

export default function ChatMessage({ message, onSendMessage, onOpenPanel, onOpenBooking }: Props) {
  const navigate = useNavigate();
  const isUser = message.role === 'user';
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);

  // Helper to parse **bold text**
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className={`font-semibold ${isUser ? 'text-white' : 'text-amber-400'}`}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleDirectBook = (booking: PrefillBooking) => {
    // Check auth directly
    const access = localStorage.getItem("access");
    if (!access) {
      alert("Vui lòng đăng nhập để tiếp tục Đặt Bàn!");
      navigate("/login");
      return;
    }
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role !== "CUSTOMER") {
          alert("Chỉ khách hàng mới có thể đặt bàn");
          return;
        }
      } catch {
        // ...
      }
    }
    if (!booking.restaurant_id) {
      alert("Chatbot chưa nhận diện được nhà hàng nào, bạn vui lòng chọn nhà hàng từ danh sách gợi ý hoặc nói rõ tên nhà hàng!");
      return;
    }
    if (onOpenBooking) {
      onOpenBooking({
        id: booking.restaurant_id,
        name: booking.restaurant_name || "Nhà hàng",
        address: "",
        date: booking.booking_date || booking.booking_date_raw || "",
        guests: booking.number_of_guests ? String(booking.number_of_guests) : "2"
      });
    }
  };

  const time = new Date(message.timestamp).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const renderActionContent = () => {
    if (!message.action || !message.action_data) return null;

    switch (message.action) {

      // ── Nhà hàng: pill nhỏ trong chat ────────────────────────────────────────
      case 'SHOW_RESTAURANTS': {
        const rests: RestaurantCard[] = message.action_data.restaurants || [];
        if (rests.length === 0) return null;
        return (
          <button
            onClick={() => onOpenPanel?.({
              type: 'restaurants',
              items: rests,
              title: `🏠 ${rests.length} nhà hàng gợi ý`,
            })}
            className="mt-2 flex items-center gap-2 bg-gray-800 hover:bg-gray-750 border border-gray-600 hover:border-blue-500/60 text-gray-200 rounded-xl px-3 py-2 text-xs font-medium transition-all group w-full"
          >
            <div className="flex -space-x-1.5 flex-shrink-0">
              {rests.slice(0, 3).map((_, i) => (
                <div key={i} className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 border border-gray-800 flex items-center justify-center text-[8px]">🏠</div>
              ))}
            </div>
            <span className="flex-1 text-left">{rests.length} nhà hàng gợi ý</span>
            <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        );
      }

      // ── Món ăn: pill nhỏ trong chat ──────────────────────────────────────────
      case 'SHOW_DISHES': {
        const dishes: DishCard[] = message.action_data.dishes || [];
        if (dishes.length === 0) return null;
        return (
          <button
            onClick={() => onOpenPanel?.({
              type: 'dishes',
              items: dishes,
              title: `🍴 ${dishes.length} món ăn gợi ý`,
            })}
            className="mt-2 flex items-center gap-2 bg-gray-800 hover:bg-gray-750 border border-gray-600 hover:border-orange-500/60 text-gray-200 rounded-xl px-3 py-2 text-xs font-medium transition-all group w-full"
          >
            <div className="flex -space-x-1.5 flex-shrink-0">
              {dishes.slice(0, 3).map((_, i) => (
                <div key={i} className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 border border-gray-800 flex items-center justify-center text-[8px]">🍴</div>
              ))}
            </div>
            <span className="flex-1 text-left">{dishes.length} món ăn gợi ý</span>
            <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-orange-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        );
      }

      // ── Booking: pill xanh nhỏ + nút mở panel ─────────────────────────────────
      case 'PREFILL_BOOKING': {
        const booking: PrefillBooking = message.action_data.booking || {};
        const candidates: RestaurantCard[] = message.action_data.restaurant_candidates || [];

        if (candidates.length > 0 && !booking.restaurant_id) {
          return (
            <div className="mt-2 space-y-2 w-full">
              <div className="flex flex-wrap gap-2 mb-2">
                {booking.booking_date && <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-xs">📅 {booking.booking_date}</span>}
                {booking.number_of_guests && <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-xs">👥 {booking.number_of_guests} người</span>}
              </div>

              <p className="text-xs text-gray-400">Chọn nhà hàng:</p>
              <div className="flex flex-col gap-2">
                {candidates.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 p-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors group">
                    <button
                      onClick={() => window.open(`/restaurant/${r.id}`, '_blank')}
                      className="flex-1 flex flex-col items-start gap-1 text-left"
                      title="Xem chi tiết nhà hàng"
                    >
                      <span className="text-sm font-semibold text-gray-200 group-hover:text-blue-400">🏠 {r.name}</span>
                      <span className="text-xs text-gray-400 font-normal">⭐ {r.rating.toFixed(1)} · {r.address}</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCandidateId(r.id);
                        onSendMessage?.("", {
                          intent: "book_table",
                          entities: {
                            selected_restaurant_id: r.id,
                            restaurant_id: r.id,
                            RESTAURANT: r.name,
                            restaurant_selected: true,
                          },
                        });
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md shadow transition-colors shrink-0 ${selectedCandidateId === r.id ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"
                        }`}
                    >
                      {selectedCandidateId === r.id ? "✓ Đã chọn" : "Chọn"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        return (
          <div className="mt-2 bg-blue-950/50 border border-blue-500/40 rounded-xl p-3 w-full">
            {/* Mini preview */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📅</span>
              <span className="text-blue-300 text-xs font-medium">
                {booking.restaurant_name ?? 'Đặt bàn'}
                {booking.number_of_guests ? ` · ${booking.number_of_guests} người` : ''}
                {(booking.booking_date || booking.booking_date_raw) ? ` · ${booking.booking_date || booking.booking_date_raw}` : ''}
              </span>
            </div>
            <button
              onClick={() => handleDirectBook(booking)}
              className="w-full py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              Tiến hành Đặt Bàn Ngay
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
      {/* Message row */}
      <div className={`flex gap-3 w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${isUser
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
            : 'bg-gradient-to-br from-gray-700 to-gray-800 text-gray-200 shadow-md border border-gray-600'
            }`}
        >
          {isUser ? '👤' : '🤖'}
        </div>

        {/* Message Content */}
        <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>

          {/* Text Bubble */}
          {(message.content || message.action === 'NONE') && (
            <div
              className={`px-4 py-2.5 rounded-2xl ${isUser
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-gray-800 text-gray-100 rounded-tl-sm border border-gray-700/50'
                }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {renderFormattedText(message.content || "")}
              </p>
            </div>
          )}

          {/* Action pill / card */}
          {!isUser && renderActionContent()}

          {/* Time & Confidence */}
          <div className="flex items-center gap-2 px-1 mt-0.5">
            <span className="text-[11px] text-gray-500">{time}</span>
            {!isUser && message.confidence !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${message.confidence > 0.8
                  ? 'bg-green-500/10 text-green-500'
                  : message.confidence > 0.5
                    ? 'bg-yellow-500/10 text-yellow-500'
                    : 'bg-red-500/10 text-red-500'
                  }`}
                title="PhoBERT Confidence"
              >
                {Math.round(message.confidence * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>

    </>
  );
}