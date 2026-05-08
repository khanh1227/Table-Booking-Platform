import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RestaurantCard, DishCard, PrefillBooking } from '../../types/chatbot';
import BookingForm from '../bookings/BookingForm';

import { buildImageUrl, PLACEHOLDER_IMAGE } from '../../lib/imageUtils';
import { getRestaurantImage } from '../../lib/restaurantDisplay';
import RestaurantCard from '../restaurant/RestaurantCard';

export type PanelContent =
  | { type: 'restaurants'; items: RestaurantCard[]; title: string }
  | { type: 'dishes'; items: DishCard[]; title: string };

type Props = {
  content: PanelContent;
  onClose: () => void;
};

export default function ChatFloatingPanel({ content, onClose }: Props) {
  const navigate = useNavigate();
  const [bookingRestaurant, setBookingRestaurant] = useState<{ id: number; name: string; address: string } | null>(null);
  const [bookingInitials, setBookingInitials] = useState<{ date?: string; guests?: string; time?: string }>({});
  const [bookingSuccess, setBookingSuccess] = useState<{ restaurantName: string; bookingId: number } | null>(null);

  const handleBookClick = (id: number, name: string, address: string, initialDate?: string, initialGuests?: string, initialTime?: string) => {
    const access = localStorage.getItem('access');
    if (!access) {
      alert('Vui lòng đăng nhập để tiếp tục Đặt Bàn!');
      navigate('/login');
      return;
    }
    setBookingInitials({ date: initialDate, guests: initialGuests, time: initialTime });
    setBookingRestaurant({ id, name, address });
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[140] md:hidden" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed z-[150] bottom-6 right-[420px] md:w-[400px] w-full max-h-[650px] flex flex-col overflow-hidden animate-slideInLeft"
        style={{
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.08)',
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3.5 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h3 className="font-bold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {content.title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl transition-all hover:bg-white/10 active:scale-90"
          >
            <svg className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>

          {/* ── Restaurants ── */}
          {content.type === 'restaurants' && (
            <div className="p-3 space-y-3">
              {content.items.map((rest) => {
                const img = buildImageUrl(rest.image_url);
                const isPlaceholder = img === PLACEHOLDER_IMAGE;
                return (
                  <div
                    key={rest.id}
                    className="rounded-2xl overflow-hidden transition-all group"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {/* Image */}
                    <div className="relative h-36 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <img 
                        src={img} 
                        alt={rest.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                        onError={(e) => {
                          if (e.currentTarget.src !== PLACEHOLDER_IMAGE) {
                            e.currentTarget.src = PLACEHOLDER_IMAGE;
                            const fallbackIcon = e.currentTarget.parentElement?.querySelector('.img-fallback-icon');
                            if (fallbackIcon) fallbackIcon.classList.remove('hidden');
                          }
                        }}
                      />
                      <div className={`absolute inset-0 flex items-center justify-center img-fallback-icon ${!isPlaceholder ? 'hidden' : ''}`}>
                        <span className="text-5xl opacity-20">🏠</span>
                      </div>
                      {/* Rating badge */}
                      <div
                        className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
                        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', color: '#fbbf24' }}
                      >
                        ⭐ {parseFloat(String(rest.rating)).toFixed(1)}
                      </div>
                      {rest.price_label && (
                        <div
                          className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold"
                          style={{ background: 'rgba(245,158,11,0.85)', color: 'white' }}
                        >
                          {rest.price_label}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h4 className="font-bold text-sm mb-1.5" style={{ color: 'rgba(255,255,255,0.92)' }}>{rest.name}</h4>
                      <div className="space-y-1 mb-3">
                        {rest.address && (
                          <p className="text-[11px] flex items-center gap-1.5 line-clamp-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            <span className="text-blue-400">📍</span> {rest.address}
                          </p>
                        )}
                        {rest.opening_hours && (
                          <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            <span className="text-green-400">🕐</span> {rest.opening_hours}
                          </p>
                        )}
                        {rest.description && (
                          <p className="text-[11px] line-clamp-2 italic" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {rest.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { onClose(); navigate(`/restaurant/${rest.id}`); }}
                          className="flex-1 py-2 text-[11px] font-bold rounded-xl transition-all active:scale-95"
                          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          Chi tiết
                        </button>
                        <button
                          onClick={() => handleBookClick(rest.id, rest.name, rest.address || '')}
                          className="flex-1 py-2 text-[11px] font-bold rounded-xl transition-all active:scale-95"
                          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}
                        >
                          Đặt ngay
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Dishes ── */}
          {content.type === 'dishes' && (
            <div className="p-3 grid grid-cols-2 gap-3">
              {content.items.map((dish) => {
                const img = buildImageUrl(dish.image_url);
                const isPlaceholder = img === PLACEHOLDER_IMAGE;
                return (
                  <div
                    key={dish.id}
                    className="rounded-xl overflow-hidden cursor-pointer transition-all group"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onClick={() => { onClose(); navigate(`/restaurant/${dish.restaurant.id}`); }}
                    title="Nhấn để tới nhà hàng"
                  >
                    <div className="h-28 relative overflow-hidden flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <img 
                        src={img} 
                        alt={dish.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                        onError={(e) => {
                          if (e.currentTarget.src !== PLACEHOLDER_IMAGE) {
                            e.currentTarget.src = PLACEHOLDER_IMAGE;
                            const fallbackIcon = e.currentTarget.parentElement?.querySelector('.img-fallback-icon');
                            if (fallbackIcon) fallbackIcon.classList.remove('hidden');
                          }
                        }}
                      />
                      <div className={`absolute inset-0 flex items-center justify-center img-fallback-icon ${!isPlaceholder ? 'hidden' : ''}`}>
                        <span className="text-4xl opacity-30 group-hover:scale-110 transition-transform">🍴</span>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <h4 className="text-xs font-bold line-clamp-2 h-8 leading-tight" style={{ color: 'rgba(255,255,255,0.88)' }}>{dish.name}</h4>
                      <p className="text-sm font-extrabold mt-1" style={{ color: '#f59e0b' }}>
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(dish.price)}
                      </p>
                      <p className="text-[10px] mt-1 truncate flex items-center gap-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        <span>🏠</span> {dish.restaurant?.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Booking Form */}
      {bookingRestaurant && (
        <BookingForm
          restaurant={bookingRestaurant as any}
          initialDate={bookingInitials.date || ''}
          initialGuests={bookingInitials.guests || '2'}
          initialTime={bookingInitials.time || ''}
          onClose={() => setBookingRestaurant(null)}
          onSuccess={(_bookingId) => {
            const name = bookingRestaurant.name;
            setBookingRestaurant(null);
            setBookingSuccess({ restaurantName: name, bookingId: _bookingId });
          }}
        />
      )}

      {/* Booking Success */}
      {bookingSuccess && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div
            className="rounded-3xl p-8 max-w-sm w-full text-center animate-fadeIn"
            style={{
              background: 'linear-gradient(180deg, #1a1a2e, #16213e)',
              border: '1px solid rgba(16,185,129,0.3)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            }}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-5"
              style={{ background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.3)' }}
            >✅</div>
            <h3 className="font-bold text-xl mb-2" style={{ color: '#34d399' }}>Đặt bàn thành công!</h3>
            <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Tại <span className="font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>{bookingSuccess.restaurantName}</span>
            </p>
            <p className="text-xs mb-7" style={{ color: 'rgba(255,255,255,0.35)' }}>Chúc bạn có bữa ăn ngon miệng! 🍽️</p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => { onClose(); navigate(`/my-bookings?highlight=${bookingSuccess.bookingId}`); }}
                className="w-full py-3.5 font-bold text-sm rounded-2xl transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', boxShadow: '0 8px 24px rgba(16,185,129,0.3)' }}
              >
                Xem chi tiết đơn hàng
              </button>
              <button
                onClick={() => { setBookingSuccess(null); onClose(); }}
                className="w-full py-2.5 text-xs font-semibold transition-colors"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
