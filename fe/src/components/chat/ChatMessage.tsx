// components/chat/ChatMessage.tsx
import { useState } from 'react';
import { buildImageUrl } from '../../lib/imageUtils';
import { getRestaurantImage } from '../../lib/restaurantDisplay';
import { useNavigate } from 'react-router-dom';
import type { ChatMessage as ChatMessageType, RestaurantCard, DishCard, PrefillBooking } from '../../types/chatbot';
import ChatFloatingPanel, { type PanelContent } from './ChatFloatingPanel';

type Props = {
  message: ChatMessageType;
  onSendMessage?: (text: string, postback?: any) => void;
  onOpenPanel?: (content: PanelContent) => void;
  onOpenBooking?: (data: { id: number; name: string; address: string; date: string; guests: string; time: string }) => void;
  onConfirmBooking?: (booking: PrefillBooking) => void;
};

export default function ChatMessage({ message, onSendMessage, onOpenPanel, onOpenBooking, onConfirmBooking }: Props) {
  const navigate = useNavigate();
  const isUser = message.role === 'user';
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);

  // Render **bold** markdown
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} style={{ color: isUser ? '#fde68a' : '#f59e0b', fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleDirectBook = (booking: PrefillBooking) => {
    const access = localStorage.getItem('access');
    if (!access) {
      alert('Vui lòng đăng nhập để tiếp tục Đặt Bàn!');
      navigate('/login');
      return;
    }
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
      } catch { /* */ }
    }
    if (!booking.restaurant_id) {
      alert('Chatbot chưa nhận diện được nhà hàng. Vui lòng chọn từ danh sách gợi ý!');
      return;
    }
    onOpenBooking?.({
      id: booking.restaurant_id,
      name: booking.restaurant_name || 'Nhà hàng',
      address: '',
      date: booking.booking_date || booking.booking_date_raw || '',
      guests: booking.number_of_guests ? String(booking.number_of_guests) : '2',
      time: booking.time_slot_label || booking.time_raw || '',
    });
  };

  const time = new Date(message.timestamp).toLocaleTimeString('vi-VN', {
    hour: '2-digit', minute: '2-digit',
  });

  const renderActionContent = () => {
    if (!message.action || !message.action_data) return null;
    const getImg = (url: string) => buildImageUrl(url);

    switch (message.action) {
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
            className="mt-2 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group"
            style={{
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.25)',
              color: '#fbbf24',
            }}
          >
            <div className="flex -space-x-1.5 flex-shrink-0">
              {rests.slice(0, 3).map((r, i) => {
                const img = getImg(r.image_url || '');
                const hasImg = img && img !== '/images/placeholder.png';
                return (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-[10px] bg-white/10"
                    style={{ border: '1.5px solid rgba(245,158,11,0.4)', zIndex: 3 - i }}
                  >
                    {hasImg ? (
                      <img src={img} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    ) : '🏠'}
                  </div>
                );
              })}
            </div>
            <span className="flex-1 text-left">{rests.length} nhà hàng gợi ý · Nhấn để xem</span>
            <svg className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        );
      }

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
            className="mt-2 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group"
            style={{
              background: 'rgba(251,146,60,0.12)',
              border: '1px solid rgba(251,146,60,0.25)',
              color: '#fb923c',
            }}
          >
            <div className="flex -space-x-1.5 flex-shrink-0">
              {dishes.slice(0, 3).map((d, i) => {
                const img = getImg(d.image_url || '');
                const hasImg = img && img !== '/images/placeholder.png';
                return (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-[10px] bg-white/10"
                    style={{ border: '1.5px solid rgba(251,146,60,0.4)', zIndex: 3 - i }}
                  >
                    {hasImg ? (
                      <img src={img} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    ) : '🍴'}
                  </div>
                );
              })}
            </div>
            <span className="flex-1 text-left">{dishes.length} món ăn gợi ý · Nhấn để xem</span>
            <svg className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        );
      }

      case 'PREFILL_BOOKING': {
        const booking: PrefillBooking = message.action_data.booking || {};
        const candidates: RestaurantCard[] = message.action_data.restaurant_candidates || [];

        if (candidates.length > 0 && !booking.restaurant_id) {
          return (
            <div className="mt-2 space-y-2">
              <div className="flex gap-2 flex-wrap">
                {booking.booking_date && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                    📅 {booking.booking_date}
                  </span>
                )}
                {booking.number_of_guests && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                    👥 {booking.number_of_guests} người
                  </span>
                )}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Chọn nhà hàng:</p>
              <div className="flex flex-col gap-1.5">
                {candidates.map((r) => {
                  const img = getRestaurantImage(r as any);
                  return (
                    <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-white/10">
                        {img && img !== '/images/placeholder.png' ? (
                          <img src={img} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        ) : (
                          <span>🏠</span>
                        )}
                      </div>
                      <button
                        onClick={() => window.open(`/restaurant/${r.id}`, '_blank')}
                        className="flex-1 flex flex-col items-start text-left"
                      >
                        <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>{r.name}</span>
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>⭐ {r.rating.toFixed(1)} · {r.address}</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCandidateId(r.id);
                          onSendMessage?.('', {
                            intent: 'book_table',
                            entities: { selected_restaurant_id: r.id, restaurant_id: r.id, RESTAURANT: r.name, restaurant_selected: true },
                          });
                        }}
                        className="px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all flex-shrink-0"
                        style={{
                          background: selectedCandidateId === r.id ? '#10b981' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                          color: 'white',
                        }}
                      >
                        {selectedCandidateId === r.id ? '✓ Đã chọn' : 'Chọn'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        return (
          <div className="mt-3 rounded-2xl overflow-hidden shadow-2xl animate-fadeIn"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(245,158,11,0.2)',
              backdropFilter: 'blur(10px)'
            }}>
            {/* Card Header/Info */}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: '#fbbf24' }}>Xác nhận thông tin</p>
                  <button
                    onClick={() => { if (booking.restaurant_id) navigate(`/restaurant/${booking.restaurant_id}`); }}
                    className="text-sm font-extrabold text-white leading-tight hover:text-amber-400 transition-colors text-left"
                  >
                    {booking.restaurant_name ?? 'Nhà hàng chưa xác định'}
                  </button>
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg" style={{ background: 'rgba(245,158,11,0.1)' }}>
                  📅
                </div>
              </div>

              <div className="flex items-center gap-4 py-2 border-y border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] opacity-40">👥</span>
                  <span className="text-xs font-semibold text-white/80">{booking.number_of_guests ?? '?'} người</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] opacity-40">🕒</span>
                  <span className="text-xs font-bold text-amber-400">{booking.time_slot_label || booking.time_raw || 'Chưa chọn giờ'}</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] opacity-40">📆</span>
                  <span className="text-xs font-semibold text-white/80">{booking.booking_date || booking.booking_date_raw || 'Hôm nay'}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex border-t border-white/5 p-2 gap-2 bg-black/20">
              <button
                onClick={() => handleDirectBook(booking)}
                className="flex-1 py-2.5 text-[11px] font-bold rounded-xl transition-all hover:bg-white/5 active:scale-95"
                style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Kiểm tra & Sửa
              </button>
              <button
                onClick={() => onConfirmBooking?.(booking)}
                className="flex-[1.4] py-2.5 text-[11px] font-black rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: 'white',
                  boxShadow: '0 4px 15px rgba(245,158,11,0.3)'
                }}
              >
                Xác nhận Đặt ngay ⚡
              </button>
            </div>
          </div>
        );
      }

      case 'BOOKING_SUCCESS': {
        const restaurantName = message.action_data?.restaurant_name || 'nhà hàng';
        return (
          <div className="mt-2 rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: 'rgba(16,185,129,0.2)' }}>✅</div>
              <div>
                <p className="text-xs font-bold" style={{ color: '#34d399' }}>Đặt bàn thành công!</p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{restaurantName}</p>
              </div>
            </div>
            <button
              onClick={() => {
                const bid = message.action_data?.booking_id;
                navigate(bid ? `/my-bookings?highlight=${bid}` : '/my-bookings');
              }}
              className="w-full py-2 text-xs font-bold rounded-lg transition-all active:scale-95"
              style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}
            >
              Xem đơn đặt bàn →
            </button>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className={`flex gap-2.5 w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs mt-0.5"
        style={
          isUser
            ? { background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }
            : { background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 10px rgba(245,158,11,0.3)' }
        }
      >
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-1 max-w-[82%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Bubble */}
        {message.content !== undefined && (
          <div
            className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
            style={
              isUser
                ? {
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: 'white',
                  borderRadius: '18px 18px 4px 18px',
                }
                : {
                  background: '#1e2d40',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: '#d4dff0',
                  borderRadius: '18px 18px 18px 4px',
                }
            }
          >
            {message.content ? (
              <p className="whitespace-pre-wrap break-words">{renderFormattedText(message.content)}</p>
            ) : (
              <div className="flex gap-1.5 py-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#f59e0b', animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#f59e0b', animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#f59e0b', animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        )}

        {/* Action pill / card */}
        {!isUser && renderActionContent()}

        {/* Timestamp */}
        <span className="text-[10px] px-1" style={{ color: 'rgba(255,255,255,0.25)' }}>{time}</span>
      </div>
    </div>
  );
}