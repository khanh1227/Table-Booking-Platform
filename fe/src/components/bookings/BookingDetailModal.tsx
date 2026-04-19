import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Users, 
  Clock, 
  MapPin, 
  Phone, 
  X, 
  Navigation, 
  QrCode, 
  Info,
  History,
  AlertTriangle
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { CancelConfirmDialog } from './CancelConfirmDialog';
import { fetchBooking, cancelBooking } from '@/lib/api';
import type { Booking } from '@/lib/api';

interface BookingDetailModalProps {
  bookingId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelSuccess: () => void;
}

function formatBookingDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function formatDateTime(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({ 
  bookingId, 
  isOpen, 
  onClose, 
  onCancelSuccess 
}) => {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (isOpen && bookingId) {
      loadBookingDetail();
    }
  }, [isOpen, bookingId]);

  const loadBookingDetail = async () => {
    if (!bookingId) return;
    
    setLoading(true);
    setError('');
    
    try {
      const data = await fetchBooking(bookingId);
      setBooking(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!bookingId) return;
    
    setCancelling(true);
    
    try {
      await cancelBooking(bookingId);
      setShowCancelDialog(false);
      onClose();
      onCancelSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Hủy booking thất bại');
    } finally {
      setCancelling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
        <div className="bg-white rounded-[2.5rem] max-w-2xl w-full shadow-2xl shadow-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
          {/* Header Area */}
          <div className="relative px-8 pt-10 pb-6 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100 flex-shrink-0">
            <button
              onClick={onClose}
              className="absolute top-8 right-8 p-2.5 bg-white shadow-lg shadow-slate-200/50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all hover:scale-110 active:scale-95 z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                 <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                   Mã đặt bàn
                 </span>
                 <span className="text-slate-400 font-mono text-xs font-bold">
                   #BK-{bookingId?.toString().padStart(5, '0')}
                 </span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                Chi tiết trải nghiệm
              </h2>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold animate-pulse uppercase tracking-[0.2em] text-[10px]">Đang lấy dữ liệu...</p>
              </div>
            )}

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 flex items-start gap-4">
                 <div className="w-10 h-10 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 flex-shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                 </div>
                 <div>
                    <h4 className="font-bold text-rose-900">Đã xảy ra lỗi</h4>
                    <p className="text-rose-600 text-sm font-medium">{error}</p>
                 </div>
              </div>
            )}

            {booking && !loading && (
              <div className="space-y-8 pb-4">
                {/* Visual Status & QR Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="bg-slate-900 rounded-[2rem] p-6 text-white relative overflow-hidden group shadow-xl shadow-slate-200/50">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-blue-600/30 transition-colors"></div>
                      <div className="relative z-10 flex flex-col h-full justify-between">
                         <div className="mb-4">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Trạng thái hiện tại</p>
                            <div className="inline-block scale-110 origin-left">
                               <StatusBadge status={booking.status} />
                            </div>
                         </div>
                         <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-300">Thời gian tạo đơn</p>
                            <p className="text-xs text-slate-500 font-medium italic">{formatDateTime(booking.created_at)}</p>
                         </div>
                      </div>
                   </div>

                   <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-6 text-white flex items-center gap-6 shadow-xl shadow-blue-200/50">
                      <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shrink-0">
                         <QrCode className="w-12 h-12 text-white" />
                      </div>
                      <div>
                         <h4 className="font-black text-lg leading-tight mb-1">Mã Check-in</h4>
                         <p className="text-xs text-blue-100 font-medium opacity-80">Quét mã tại quầy lễ tân khi đến nhà hàng</p>
                      </div>
                   </div>
                </div>

                {/* Restaurant Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                        <Info className="w-4 h-4" />
                     </div>
                     <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Thông tin nhà hàng</h3>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6">
                    <h4 className="text-xl font-black text-slate-900 mb-2 truncate">{booking.restaurant_name}</h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2.5 text-slate-600">
                        <MapPin className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                        <span className="text-sm font-medium leading-relaxed">{booking.restaurant_address}</span>
                      </div>
                      {booking.restaurant_phone && (
                        <div className="flex items-center gap-2.5">
                          <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                          <a 
                            href={`tel:${booking.restaurant_phone}`} 
                            className="bg-blue-600/5 hover:bg-blue-600 text-blue-600 hover:text-white px-3 py-1 rounded-full text-sm font-bold transition-all"
                          >
                            {booking.restaurant_phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detail Information Grid */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                        <Calendar className="w-4 h-4" />
                     </div>
                     <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Chi tiết lịch hẹn</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">Ngày dự kiến</p>
                        <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                           <Calendar className="w-3.5 h-3.5" />
                           {formatBookingDate(booking.booking_date).split(',')[1] || formatBookingDate(booking.booking_date)}
                        </div>
                     </div>
                     <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">Giờ vàng</p>
                        <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                           <Clock className="w-3.5 h-3.5" />
                           {booking.time_slot_info.display}
                        </div>
                     </div>
                     <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">Số thực khách</p>
                        <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                           <Users className="w-3.5 h-3.5" />
                           {booking.number_of_guests} khách
                        </div>
                     </div>
                  </div>
                </div>

                {/* Special Request */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm font-black text-slate-900 uppercase tracking-widest">
                     <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                        <Navigation className="w-4 h-4" />
                     </div>
                     <span>Lời nhắn & Yêu cầu</span>
                  </div>
                  <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-3xl p-6 italic text-slate-700 font-medium">
                    {booking.special_request || "Không có yêu cầu đặc biệt nào đi kèm."}
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm font-black text-slate-900 uppercase tracking-widest">
                     <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
                        <History className="w-4 h-4" />
                     </div>
                     <span>Lịch sử thay đổi</span>
                  </div>
                  <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                     <div className="relative">
                        <div className="absolute -left-8 top-1.5 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center z-10 shadow-sm">
                           <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        </div>
                        <p className="text-xs font-black text-slate-900">Đơn hàng đã được khởi tạo</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(booking.created_at)}</p>
                     </div>
                     {booking.confirmed_at && (
                       <div className="relative">
                          <div className="absolute -left-8 top-1.5 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center z-10 shadow-sm">
                             <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          </div>
                          <p className="text-xs font-black text-slate-900">Yêu cầu đã được xác nhận</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(booking.confirmed_at)}</p>
                       </div>
                     )}
                     <div className="relative opacity-60">
                        <div className="absolute -left-8 top-1.5 w-6 h-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center z-10">
                           <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                        </div>
                        <p className="text-xs font-bold text-slate-600">Trạng thái hiện tại: {booking.status_display}</p>
                     </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex-shrink-0 flex gap-4">
             <button
                onClick={onClose}
                className="flex-1 px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all font-black uppercase tracking-widest text-xs shadow-sm"
             >
                Đóng
             </button>
             
             {booking?.can_cancel && (
                <button
                   onClick={() => setShowCancelDialog(true)}
                   className="flex-[1.5] px-8 py-4 bg-rose-600 text-white rounded-2xl hover:bg-rose-700 transition-all shadow-xl shadow-rose-200 font-black uppercase tracking-widest text-xs hover:-translate-y-1 active:translate-y-0"
                >
                   Hủy yêu cầu ngay
                </button>
             )}
          </div>
        </div>
      </div>

      <CancelConfirmDialog
        isOpen={showCancelDialog}
        onConfirm={handleCancel}
        onCancel={() => setShowCancelDialog(false)}
        loading={cancelling}
      />
    </>
  );
};

export default BookingDetailModal;