// src/components/bookings/BookingCard.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, Clock, MapPin, ChevronRight, MessageSquare, Trash2, Info, CheckCircle } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { type BookingListItem } from '@/lib/api';
import { buildImageUrl, PLACEHOLDER_IMAGE } from '@/lib/imageUtils';

interface BookingCardProps {
  booking: BookingListItem;
  onViewDetail: (id: number) => void;
  onCancel: (id: number) => void;
  onReview?: (booking: BookingListItem) => void;
  onViewReview?: (booking: BookingListItem) => void;
  isHighlighted?: boolean;
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

export const BookingCard: React.FC<BookingCardProps> = ({ 
  booking, 
  onViewDetail, 
  onCancel,
  onReview,
  onViewReview,
  isHighlighted = false
}) => {
  const navigate = useNavigate();
  // We'll try to use a restaurant image if available in the booking object (needs API/MyBookings update)
  const imageUrl = (booking as any).restaurant_image_url 
    ? buildImageUrl((booking as any).restaurant_image_url) 
    : PLACEHOLDER_IMAGE;

  return (
    <div 
      id={`booking-${booking.id}`}
      className={`group bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 flex flex-col md:flex-row ${
        isHighlighted ? 'animate-highlight ring-2 ring-orange-500' : ''
      }`}
    >
      {/* Visual Side/Top */}
      <div 
        className="md:w-64 h-48 md:h-auto relative overflow-hidden flex-shrink-0 cursor-pointer"
        onClick={() => navigate(`/restaurant/${booking.restaurant}`)}
      >
        <img 
          src={imageUrl} 
          alt={booking.restaurant_name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
        <div className="absolute top-3 left-3">
          <StatusBadge status={booking.status as any} />
        </div>
      </div>

      {/* Content Side */}
      <div className="flex-1 p-5 md:p-6 flex flex-col">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="flex-1">
            <h3 
              onClick={() => navigate(`/restaurant/${booking.restaurant}`)}
              className="text-xl font-black text-slate-900 hover:text-blue-600 transition-colors line-clamp-1 mb-1 cursor-pointer decoration-2 underline-offset-4 hover:underline"
            >
              {booking.restaurant_name}
            </h3>
            <div className="flex items-center gap-1.5 text-slate-500 text-sm">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="line-clamp-1">{booking.restaurant_address}</span>
            </div>
          </div>
          <div className="text-right hidden sm:block">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Mã đặt bàn</div>
             <div className="text-sm font-mono font-bold text-slate-700">#BK-{booking.id.toString().padStart(5, '0')}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6 py-4 border-y border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Ngày đặt</div>
              <div className="text-sm font-bold text-slate-700">{formatShortDate(booking.booking_date)}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Giờ đặt</div>
              <div className="text-sm font-bold text-slate-700">{booking.time_slot_display}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Số người</div>
              <div className="text-sm font-bold text-slate-700">{booking.number_of_guests} khách</div>
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => onViewDetail(booking.id)}
              className="px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1.5 group/btn"
            >
              <Info className="w-4 h-4" />
              Chi tiết
            </button>
            
            {booking.status === 'COMPLETED' && !booking.has_review && onReview && (
              <button
                onClick={() => onReview(booking)}
                className="px-4 py-2 text-sm font-bold text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-500 hover:text-white transition-all flex items-center gap-1.5"
              >
                <MessageSquare className="w-4 h-4" />
                Đánh giá
              </button>
            )}

            {booking.has_review && (
              <button
                onClick={() => onViewReview?.(booking)}
                className="px-4 py-2 text-sm font-bold text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                Đã đánh giá
              </button>
            )}
          </div>

          {booking.status === 'PENDING' && (
            <button
              onClick={() => onCancel(booking.id)}
              className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-1.5 ml-auto"
            >
              <Trash2 className="w-4 h-4" />
              Hủy đặt bàn
            </button>
          )}

          <button 
             onClick={() => onViewDetail(booking.id)}
             className="md:hidden w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-400"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingCard;