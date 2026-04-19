// src/pages/MyBookings.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Plus, Loader2, AlertCircle, ArrowLeft, History, CalendarDays } from 'lucide-react';
import { BookingCard } from '@/components/bookings/BookingCard';
import { BookingFilters } from '@/components/bookings/BookingFilters';
import { BookingDetailModal } from '@/components/bookings/BookingDetailModal';
import { CancelConfirmDialog } from '@/components/bookings/CancelConfirmDialog';
import { Toast } from '@/components/bookings/Toast';
import { fetchBookings, cancelBooking, fetchRestaurantImages } from '@/lib/api';
import type { BookingListItem } from '@/lib/api';
import ReviewForm from '@/components/reviews/ReviewForm';
import Header from "@/components/common/Header";
import Footer from "@/components/common/Footer";

interface FilterParams {
  status?: string;
  start_date?: string;
  end_date?: string;
}

const MyBookings: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  
  // Main state
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<FilterParams>({});
  
  // Modal state
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  
  // Review form state
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [bookingToReview, setBookingToReview] = useState<BookingListItem | null>(null);
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Scroll to highlighted booking
  useEffect(() => {
    if (highlightId && !loading && bookings.length > 0) {
      // Small timeout to ensure DOM is rendered
      const timer = setTimeout(() => {
        const element = document.getElementById(`booking-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [highlightId, loading, bookings]);

  // Load bookings on mount
  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async (newFilters?: FilterParams) => {
    setLoading(true);
    setError('');
    
    try {
      const data = await fetchBookings(newFilters || filters);
      
      const bookingsWithImages = await Promise.all(data.map(async (booking) => {
        try {
          const images = await fetchRestaurantImages(String(booking.restaurant));
          const firstImg = images?.[0]?.image_url || null;
          return { ...booking, restaurant_image_url: firstImg };
        } catch {
          return booking;
        }
      }));

      setBookings(bookingsWithImages);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Unauthorized')) {
        navigate('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters: FilterParams) => {
    setFilters(newFilters);
    loadBookings(newFilters);
  };

  // Group bookings
  const { upcomingBookings, pastBookings } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return bookings.reduce((acc, booking) => {
      const bookingDate = new Date(booking.booking_date);
      const isPast = bookingDate < now || ['COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW'].includes(booking.status);
      
      if (isPast) {
        acc.pastBookings.push(booking);
      } else {
        acc.upcomingBookings.push(booking);
      }
      return acc;
    }, { upcomingBookings: [] as BookingListItem[], pastBookings: [] as BookingListItem[] });
  }, [bookings]);

  const handleViewDetail = (id: number) => {
    setSelectedBookingId(id);
    setDetailModalOpen(true);
  };

  const handleCancelClick = (id: number) => {
    setBookingToCancel(id);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!bookingToCancel) return;
    
    setCancelling(true);
    
    try {
      await cancelBooking(bookingToCancel);
      setCancelDialogOpen(false);
      setBookingToCancel(null);
      setToast({ message: 'Hủy đặt bàn thành công', type: 'success' });
      loadBookings();
    } catch (err) {
      setToast({ 
        message: err instanceof Error ? err.message : 'Hủy booking thất bại', 
        type: 'error' 
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleReviewClick = (booking: BookingListItem) => {
    setBookingToReview(booking);
    setReviewFormOpen(true);
  };

  const handleReviewSubmit = async (data: { rating: number; comment: string; images: File[] }) => {
    if (!bookingToReview) return;
    
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
      const access = localStorage.getItem('access');
      
      const formData = new FormData();
      formData.append('booking', String(bookingToReview.id));
      formData.append('restaurant', String(bookingToReview.restaurant));
      formData.append('rating', String(data.rating));
      if (data.comment) formData.append('comment', data.comment);
      
      data.images.forEach(img => formData.append('images', img));

      const res = await fetch(`${API_BASE}/api/reviews/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access}`
          // Don't set Content-Type header when sending FormData!
        },
        body: formData
      });

      if (res.ok) {
        setToast({ message: 'Cảm ơn bạn đã đánh giá!', type: 'success' });
        loadBookings();
      } else {
        const errData = await res.json();
        const errorMsg = String(Object.values(errData).flat()[0]) || 'Gửi đánh giá thất bại';
        setToast({ message: errorMsg, type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Lỗi kết nối máy chủ', type: 'error' });
    } finally {
      setReviewFormOpen(false);
      setBookingToReview(null);
    }
  };

  const handleViewReview = (booking: BookingListItem) => {
    if (booking.review_details) {
      setToast({ 
        message: `Đánh giá của bạn (${booking.review_details.rating} sao): "${booking.review_details.comment}"`, 
        type: 'success' 
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Header />
      <div className="flex-grow py-12">
        <div className="max-w-6xl mx-auto px-4">
          {/* Navigation & Title */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-bold text-sm mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại trang chủ
            </button>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Lịch sử đặt bàn</h1>
            <p className="text-slate-500 mt-2 font-medium">Theo dõi và quản lý những trải nghiệm ẩm thực của bạn</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="group px-8 py-4 bg-slate-900 text-white rounded-2xl hover:bg-blue-600 transition-all duration-300 font-bold flex items-center gap-3 shadow-xl shadow-slate-200"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            Đặt bàn mới ngay
          </button>
        </div>

        {/* Filters */}
        <BookingFilters onFilterChange={handleFilterChange} />

        {/* State Indicators */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <p className="text-slate-500 font-bold animate-pulse">Đang tải dữ liệu của bạn...</p>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-700 mb-8 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0 text-rose-600">
                <AlertCircle className="w-6 h-6" />
            </div>
            <div>
                <div className="font-bold">Đã có lỗi xảy ra</div>
                <div className="text-sm opacity-80">{error}</div>
            </div>
          </div>
        )}

        {/* Dynamic Content */}
        {!loading && !error && (
          <>
            {bookings.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-16 text-center">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                    <Calendar className="w-12 h-12" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3">Bạn chưa có đặt bàn nào</h3>
                <p className="text-slate-500 mb-8 max-w-sm mx-auto font-medium">
                  Hãy bắt đầu hành trình ẩm thực của bạn bằng cách chọn nhà hàng yêu thích và đặt bàn ngay.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="px-8 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-bold inline-flex items-center gap-2 shadow-lg shadow-blue-200"
                >
                  <Plus className="w-5 h-5" />
                  Đặt bàn ngay
                </button>
              </div>
            ) : (
              <div className="space-y-12">
                {/* Upcoming */}
                {upcomingBookings.length > 0 && (
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <CalendarDays className="w-5 h-5" />
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Đặt bàn sắp tới</h2>
                    </div>
                    <div className="space-y-6">
                      {upcomingBookings.map((booking) => (
                        <BookingCard
                          key={booking.id}
                          booking={booking}
                          onViewDetail={handleViewDetail}
                          onCancel={handleCancelClick}
                          onReview={handleReviewClick}
                          onViewReview={handleViewReview}
                          isHighlighted={String(booking.id) === highlightId}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Past */}
                {pastBookings.length > 0 && (
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-600">
                        <History className="w-5 h-5" />
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Lịch sử và Khác</h2>
                    </div>
                    <div className="space-y-6 opacity-80 hover:opacity-100 transition-opacity">
                      {pastBookings.map((booking) => (
                        <BookingCard
                          key={booking.id}
                          booking={booking}
                          onViewDetail={handleViewDetail}
                          onCancel={handleCancelClick}
                          onReview={handleReviewClick}
                          onViewReview={handleViewReview}
                          isHighlighted={String(booking.id) === highlightId}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      <BookingDetailModal
        bookingId={selectedBookingId}
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedBookingId(null);
        }}
        onCancelSuccess={() => {
          setToast({ message: 'Hủy đặt bàn thành công', type: 'success' });
          loadBookings();
        }}
      />

      {/* Cancel Confirm Dialog */}
      <CancelConfirmDialog
        isOpen={cancelDialogOpen}
        onConfirm={handleCancelConfirm}
        onCancel={() => {
          setCancelDialogOpen(false);
          setBookingToCancel(null);
        }}
        loading={cancelling}
      />

      {/* Review Form Modal */}
      {reviewFormOpen && bookingToReview && (
        <ReviewForm
          bookingId={bookingToReview.id}
          restaurantName={bookingToReview.restaurant_name}
          onClose={() => {
            setReviewFormOpen(false);
            setBookingToReview(null);
          }}
          onSubmit={handleReviewSubmit}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      </div>
      <Footer />
    </div>
  );
};

export default MyBookings;