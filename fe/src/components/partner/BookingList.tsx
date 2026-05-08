// src/components/partner/BookingList.tsx
import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, Clock, Calendar, Users, MapPin, Phone, Loader2 } from 'lucide-react';
import { 
  fetchBookings, 
  confirmBooking, 
  rejectBooking, 
  completeBooking, 
  markNoShow,
  type BookingListItem 
} from '@/lib/api';

type FilterStatus = 'ALL' | 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

interface BookingListProps {
  restaurantId?: string | null;
  highlightId?: string | null;
}

export default function BookingList({ restaurantId, highlightId }: BookingListProps) {
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Rejection modal
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Scroll to highlighted booking
  useEffect(() => {
    if (highlightId && !loading && bookings.length > 0) {
      // Small timeout to ensure DOM is rendered
      const timer = setTimeout(() => {
        const element = document.getElementById(`partner-booking-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [highlightId, loading, bookings]);

  useEffect(() => {
    loadBookings();
  }, [restaurantId]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError('');
      // Partner sẽ thấy bookings của tất cả restaurants thuộc partner
      const data = await fetchBookings({
        order_by: '-created_at',
        restaurant_id: restaurantId ? Number(restaurantId) : undefined,
        page_size: 50,
      });
      setBookings(data);
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi tải danh sách booking');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (bookingId: number) => {
    // Logic removed because bookings are auto-confirmed
  };

  const handleReject = (bookingId: number) => {
    setRejectId(bookingId);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const submitReject = async () => {
    if (!rejectId) return;
    
    setActionLoading(`reject-${rejectId}`);
    try {
      await rejectBooking(rejectId, rejectReason);
      setShowRejectModal(false);
      await loadBookings();
    } catch (err: any) {
      alert(err.message || 'Từ chối booking thất bại');
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (bookingId: number) => {
    setActionLoading(`complete-${bookingId}`);
    try {
      await completeBooking(bookingId);
      await loadBookings();
    } catch (err: any) {
      alert(err.message || 'Đánh dấu hoàn thành thất bại');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNoShow = async (bookingId: number) => {
    if (!confirm('Đánh dấu khách không đến?')) return;
    
    setActionLoading(`noshow-${bookingId}`);
    try {
      await markNoShow(bookingId);
      await loadBookings();
    } catch (err: any) {
      alert(err.message || 'Đánh dấu no-show thất bại');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredBookings = filter === 'ALL'
    ? bookings
    : bookings.filter((b) => b.status === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'COMPLETED':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'CANCELLED':
        return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
      case 'REJECTED':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'NO_SHOW':
        return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
      default: // PENDING
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  const isExpired = (bookingDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bDate = new Date(bookingDate);
    bDate.setHours(0, 0, 0, 0);
    return bDate < today;
  };

  return (
    <div>
      {/* Filter Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-4">Danh sách booking</h2>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'ALL', label: 'Tất cả' },
            { value: 'PENDING', label: 'Chờ xác nhận' },
            { value: 'CONFIRMED', label: 'Đã xác nhận' },
            { value: 'COMPLETED', label: 'Hoàn thành' },
            { value: 'REJECTED', label: 'Đã từ chối' },
            { value: 'CANCELLED', label: 'Đã hủy' },
            { value: 'NO_SHOW', label: 'Không đến' },
          ].map((status) => (
            <button
              key={status.value}
              onClick={() => setFilter(status.value as FilterStatus)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === status.value
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-12 text-center">
          <p className="text-slate-400">Không có booking nào</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              id={`partner-booking-${booking.id}`}
              className={`bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition ${
                highlightId && String(booking.id) === highlightId ? 'animate-highlight ring-2 ring-orange-500' : ''
              }`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Restaurant & Customer Info */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">
                    {booking.restaurant_name}
                  </h3>
                  
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-start gap-2 text-slate-300">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
                      <span>{booking.restaurant_address}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-700 pt-4 space-y-2 text-sm">
                    <p className="text-slate-300">
                      <span className="text-slate-400">Khách:</span>{' '}
                      <span className="font-medium">{booking.customer_name}</span>
                    </p>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span>{booking.customer_phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span>{booking.number_of_guests} người</span>
                    </div>
                  </div>
                </div>

                {/* Right Column - Booking Details & Actions */}
                <div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{formatDate(booking.booking_date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>{booking.time_slot_display}</span>
                    </div>
                    <p className="text-slate-400 text-xs">
                      Đặt lúc: {new Intl.DateTimeFormat('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }).format(new Date(booking.created_at))}
                    </p>
                  </div>

                   {/* Status Badge */}
                  <div className={`p-3 rounded-lg border text-center font-medium text-sm mb-4 relative overflow-hidden ${getStatusColor(booking.status)}`}>
                    {booking.status_display}
                    {isExpired(booking.booking_date) && ['PENDING', 'CONFIRMED'].includes(booking.status) && (
                      <span className="absolute top-0 right-0 bg-red-600 text-white text-[8px] px-1.5 py-0.5 font-black uppercase tracking-tighter rounded-bl-md">
                        Quá hạn
                      </span>
                    )}
                    {booking.status === 'REJECTED' && booking.rejection_reason && (
                      <p className="text-[10px] mt-1 opacity-80 italic">Lý do: {booking.rejection_reason}</p>
                    )}
                  </div>

                  {/* Deposit Status - Hide if expired and not paid */}
                  {(booking.status === 'CONFIRMED' || booking.status === 'PENDING') && !(isExpired(booking.booking_date) && !booking.is_deposit_paid) && (
                    <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Tiền cọc:</span>
                        <span className={`font-bold ${booking.is_deposit_paid ? 'text-green-400' : 'text-orange-400'}`}>
                          {booking.is_deposit_paid ? 'Đã thanh toán' : 'Chờ thanh toán'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-white mt-1">
                        {new Intl.NumberFormat('vi-VN').format(Number(booking.deposit_amount))}đ
                      </p>
                      
                      {!booking.is_deposit_paid && booking.deposit_expires_at && !isExpired(booking.booking_date) && (
                        <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Hết hạn cọc: {new Date(booking.deposit_expires_at).toLocaleTimeString('vi-VN')}
                        </p>
                      )}
                    </div>
                  )}

                   {booking.status === 'PENDING' && (
                    <div className="flex gap-2">
                      {!isExpired(booking.booking_date) ? (
                        <>
                          <button
                            onClick={() => handleConfirm(booking.id)}
                            disabled={actionLoading === `confirm-${booking.id}`}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition text-sm font-medium disabled:opacity-50 border border-emerald-500/20"
                          >
                            {actionLoading === `confirm-${booking.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Xác nhận đơn
                          </button>
                          <button
                            onClick={() => handleReject(booking.id)}
                            disabled={actionLoading === `reject-${booking.id}`}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition text-sm font-medium disabled:opacity-50"
                          >
                            {actionLoading === `reject-${booking.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            Từ chối
                          </button>
                        </>
                      ) : (
                        <div className="flex-1 text-center py-3 bg-slate-900/30 rounded-xl border border-slate-800/50 text-slate-600 text-[10px] font-black uppercase tracking-widest italic">
                          Hệ thống đã tự hủy đơn quá hạn
                        </div>
                      )}
                    </div>
                  )}

                   {booking.status === 'CONFIRMED' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        {!isExpired(booking.booking_date) ? (
                          <>
                            <button
                              onClick={() => handleComplete(booking.id)}
                              disabled={actionLoading === `complete-${booking.id}`}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition text-sm font-medium disabled:opacity-50"
                            >
                              {actionLoading === `complete-${booking.id}` ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                              Hoàn thành
                            </button>
                            <button
                              onClick={() => handleNoShow(booking.id)}
                              disabled={actionLoading === `noshow-${booking.id}`}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition text-sm font-medium disabled:opacity-50"
                            >
                              {actionLoading === `noshow-${booking.id}` ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                              No-show
                            </button>
                          </>
                        ) : (
                          <div className="flex-1 text-center py-2 bg-slate-900/50 rounded-lg border border-slate-800 text-slate-500 text-xs font-bold uppercase italic">
                            Đã quá hạn xử lý
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleReject(booking.id)}
                        disabled={actionLoading === `reject-${booking.id}`}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400/70 hover:text-red-400 rounded-lg transition text-xs font-medium disabled:opacity-50 border border-red-500/20"
                      >
                        <XCircle className="w-3 h-3" />
                        Hủy đơn này (Từ chối)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REJECTION MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-red-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-xl font-bold text-white">Từ chối đơn đặt bàn</h3>
            </div>
            
            <p className="text-slate-400 text-sm mb-4">
              Vui lòng cho khách hàng biết lý do bạn từ chối đơn này. Khách hàng sẽ nhận được thông báo kèm lý do của bạn.
            </p>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Lý do từ chối
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="VD: Nhà hàng đã hết bàn vào khung giờ này, xin lỗi quý khách..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-sm focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition outline-none min-h-[120px] resize-none"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-700 rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectReason.trim() || actionLoading?.startsWith('reject-')}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-red-500 text-white font-bold rounded-xl transition shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
              >
                {actionLoading?.startsWith('reject-') && <Loader2 className="w-4 h-4 animate-spin" />}
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
