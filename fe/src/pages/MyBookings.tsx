// src/pages/MyBookings.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Plus, AlertCircle, ArrowLeft, History, CalendarDays } from 'lucide-react';
import { BookingCard } from '@/components/bookings/BookingCard';
import { BookingFilters } from '@/components/bookings/BookingFilters';
import { BookingDetailModal } from '@/components/bookings/BookingDetailModal';
import { CancelConfirmDialog } from '@/components/bookings/CancelConfirmDialog';
import { Toast } from '@/components/bookings/Toast';
import { fetchBookings, cancelBooking, fetchRestaurantImages, expireUnpaidBookings, fetchProfile } from '@/lib/api';
import type { BookingListItem } from '@/lib/api';
import ReviewForm from '@/components/reviews/ReviewForm';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';

/* ─────────────────────────────────────────────────────────────────
   Inject once: Google Font + scoped CSS
───────────────────────────────────────────────────────────────── */
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap';
  document.head.appendChild(link);

  const css = `
  .bk-root {
    font-family: 'Outfit', sans-serif;
    background: #F5F3EF;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    color: #1A1A1A;
  }

  .bk-wrap {
    width: 100%;
    max-width: 980px;
    margin: 0 auto;
    padding: 32px 20px 60px;
  }

  /* ── Topbar ── */
  .bk-topbar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 24px;
  }
  .bk-topbar-left { display: flex; flex-direction: column; gap: 4px; }

  .bk-back-btn {
    display: inline-flex; align-items: center; gap: 5px;
    background: none; border: none; cursor: pointer;
    font-family: 'Outfit', sans-serif;
    font-size: 12px; font-weight: 500;
    color: #999; letter-spacing: 0.03em; padding: 0;
    transition: color 0.15s; margin-bottom: 4px;
  }
  .bk-back-btn:hover { color: #C95C1A; }
  .bk-back-btn svg { transition: transform 0.15s; }
  .bk-back-btn:hover svg { transform: translateX(-3px); }

  .bk-title {
    font-size: clamp(22px, 4vw, 28px);
    font-weight: 800; letter-spacing: -0.03em;
    color: #1A1A1A; margin: 0; line-height: 1.15;
  }
  .bk-title-accent { color: #C95C1A; }

  .bk-subtitle { font-size: 13px; color: #999; font-weight: 400; margin: 0; }

  .bk-new-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 10px 20px;
    background: #C95C1A; color: #fff;
    border: none; border-radius: 10px;
    font-family: 'Outfit', sans-serif;
    font-size: 13px; font-weight: 600; cursor: pointer;
    transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
    box-shadow: 0 2px 12px rgba(201,92,26,0.25);
    white-space: nowrap;
  }
  .bk-new-btn:hover {
    background: #B04D12;
    transform: translateY(-1px);
    box-shadow: 0 5px 18px rgba(201,92,26,0.35);
  }
  .bk-new-btn:active { transform: translateY(0); }

  /* ── Stat chips ── */
  .bk-chips {
    display: flex; gap: 7px; flex-wrap: wrap;
    margin-bottom: 18px;
  }
  .bk-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    background: #fff; border: 1px solid #E8E4DD;
    font-size: 12px; font-weight: 600; color: #555;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .bk-chip-dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  }
  .bk-chip-dot.orange { background: #C95C1A; }
  .bk-chip-dot.green  { background: #16A34A; }
  .bk-chip-dot.gray   { background: #9CA3AF; }
  .bk-chip-dot.blue   { background: #2563EB; }
  .bk-chip-dot.wallet { background: #059669; }

  .bk-wallet-chip {
    background: #ECFDF5;
    border: 1px solid #10B981;
    color: #065F46;
  }

  /* ── Filter card ── */
  .bk-filter-card {
    background: #fff;
    border: 1px solid #E8E4DD;
    border-radius: 12px;
    padding: 14px 18px;
    margin-bottom: 22px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }
  .bk-filter-label {
    font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: #C95C1A; margin-bottom: 10px;
  }

  /* ── Section header ── */
  .bk-section-hd {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 10px;
  }
  .bk-section-icon {
    width: 26px; height: 26px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .bk-section-icon.upcoming { background: #FEF0E7; color: #C95C1A; }
  .bk-section-icon.past     { background: #F3F4F6; color: #6B7280; }
  .bk-section-title {
    font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.09em; color: #444;
  }
  .bk-section-count { font-size: 11px; font-weight: 500; color: #bbb; }
  .bk-section-line { flex: 1; height: 1px; background: #E8E4DD; }

  /* ── Cards list ── */
  .bk-cards {
    display: flex; flex-direction: column;
    gap: 8px; margin-bottom: 24px;
  }
  .bk-cards > * {
    opacity: 0; transform: translateY(5px);
    animation: bkFadeUp 0.28s ease forwards;
  }
  .bk-cards > *:nth-child(1) { animation-delay: 0.04s; }
  .bk-cards > *:nth-child(2) { animation-delay: 0.08s; }
  .bk-cards > *:nth-child(3) { animation-delay: 0.12s; }
  .bk-cards > *:nth-child(4) { animation-delay: 0.16s; }
  .bk-cards > *:nth-child(5) { animation-delay: 0.20s; }
  .bk-cards > *:nth-child(n+6) { animation-delay: 0.23s; }
  @keyframes bkFadeUp { to { opacity: 1; transform: translateY(0); } }

  /* Past faded until hover */
  .bk-past-cards {
    opacity: 0.5;
    filter: saturate(0.5) grayscale(0.2);
    transition: opacity 0.25s, filter 0.25s;
  }
  .bk-past-cards:hover { opacity: 1; filter: none; }

  /* ── Loading ── */
  .bk-loading {
    display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 12px;
    padding: 52px 0;
    background: #fff; border-radius: 12px;
    border: 1px solid #E8E4DD;
  }
  .bk-spinner {
    width: 32px; height: 32px;
    border: 3px solid #F0EDE8;
    border-top-color: #C95C1A;
    border-radius: 50%;
    animation: bkSpin 0.7s linear infinite;
  }
  @keyframes bkSpin { to { transform: rotate(360deg); } }
  .bk-loading-txt { font-size: 13px; color: #aaa; font-weight: 500; }

  /* ── Error ── */
  .bk-error {
    display: flex; align-items: flex-start; gap: 11px;
    padding: 13px 16px;
    background: #FEF2F2;
    border: 1px solid #FECACA;
    border-left: 3px solid #DC2626;
    border-radius: 10px; margin-bottom: 18px;
  }
  .bk-error-icon { color: #DC2626; flex-shrink: 0; margin-top: 1px; }
  .bk-error-title { font-size: 13px; font-weight: 700; color: #DC2626; margin-bottom: 1px; }
  .bk-error-msg   { font-size: 12px; color: #7F1D1D; opacity: 0.8; }

  /* ── Empty state ── */
  .bk-empty {
    background: #fff;
    border: 1px solid #E8E4DD;
    border-radius: 14px;
    padding: 52px 24px;
    text-align: center;
  }
  .bk-empty-icon-wrap {
    width: 60px; height: 60px;
    margin: 0 auto 18px;
    border-radius: 16px;
    background: #FEF0E7;
    display: flex; align-items: center; justify-content: center;
    color: #C95C1A;
  }
  .bk-empty-title {
    font-size: 17px; font-weight: 800;
    color: #1A1A1A; margin-bottom: 6px; letter-spacing: -0.02em;
  }
  .bk-empty-sub {
    font-size: 13px; color: #999;
    max-width: 270px; margin: 0 auto; line-height: 1.6;
  }
  .bk-empty-btn {
    display: inline-flex; align-items: center; gap: 7px;
    margin-top: 20px; padding: 10px 22px;
    background: #C95C1A; color: #fff;
    border: none; border-radius: 10px;
    font-family: 'Outfit', sans-serif;
    font-size: 13px; font-weight: 600; cursor: pointer;
    transition: background 0.18s, transform 0.12s;
    box-shadow: 0 3px 14px rgba(201,92,26,0.25);
  }
  .bk-empty-btn:hover { background: #B04D12; transform: translateY(-1px); }

  /* ── Page fade in ── */
  .bk-fadein {
    opacity: 0;
    animation: bkPageIn 0.3s ease 0.05s forwards;
  }
  @keyframes bkPageIn { to { opacity: 1; } }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

/* ─────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────── */
interface FilterParams {
  status?: string;
  start_date?: string;
  end_date?: string;
}

/* ─────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────── */
const MyBookings: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  useEffect(() => { injectStyles(); }, []);

  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<FilterParams>({});
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [bookingToReview, setBookingToReview] = useState<BookingListItem | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [customerBalance, setCustomerBalance] = useState<number>(0);

  useEffect(() => {
    if (!highlightId || loading || bookings.length === 0) return;
    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(`booking-${highlightId}`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      if (++attempts < 20) setTimeout(tryScroll, 100);
    };
    const t = setTimeout(tryScroll, 300);
    return () => clearTimeout(t);
  }, [highlightId, loading, bookings]);

  useEffect(() => { 
    // Tự động dọn dẹp các đơn hết hạn cọc trước khi tải danh sách
    expireUnpaidBookings().finally(() => {
      loadBookings(); 
    });
    // Tải thông tin số dư
    fetchProfile().then(data => {
      if (data.customer) setCustomerBalance(Number(data.customer.credit_balance || 0));
    }).catch(() => {});
  }, []);

  const loadBookings = async (newFilters?: FilterParams) => {
    setLoading(true); setError('');
    try {
      const data = await fetchBookings({ ...(newFilters || filters), is_personal: true });
      const withImages = await Promise.all(
        data.map(async (b) => {
          try {
            const imgs = await fetchRestaurantImages(String(b.restaurant));
            return { ...b, restaurant_image_url: imgs?.[0]?.image_url ?? null };
          } catch { return b; }
        })
      );
      setBookings(withImages);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Unauthorized')) { navigate('/login'); return; }
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  const handleFilterChange = (f: FilterParams) => { setFilters(f); loadBookings(f); };

  const { upcomingBookings, pastBookings } = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return bookings.reduce(
      (acc, b) => {
        const past =
          new Date(b.booking_date) < now ||
          ['COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW'].includes(b.status);
        past ? acc.pastBookings.push(b) : acc.upcomingBookings.push(b);
        return acc;
      },
      { upcomingBookings: [] as BookingListItem[], pastBookings: [] as BookingListItem[] }
    );
  }, [bookings]);

  const handleViewDetail = (id: number) => { setSelectedBookingId(id); setDetailModalOpen(true); };
  const handleCancelClick = (id: number) => { setBookingToCancel(id); setCancelDialogOpen(true); };

  const handleCancelConfirm = async () => {
    if (!bookingToCancel) return;
    setCancelling(true);
    try {
      await cancelBooking(bookingToCancel);
      setCancelDialogOpen(false); setBookingToCancel(null);
      setToast({ message: 'Hủy đặt bàn thành công', type: 'success' });
      loadBookings();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Hủy booking thất bại', type: 'error' });
    } finally { setCancelling(false); }
  };

  const handleReviewClick = (b: BookingListItem) => { setBookingToReview(b); setReviewFormOpen(true); };

  const handleReviewSubmit = async (data: { rating: number; comment: string; images: File[] }) => {
    if (!bookingToReview) return;
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
      const access = localStorage.getItem('access');
      const fd = new FormData();
      fd.append('booking', String(bookingToReview.id));
      fd.append('restaurant', String(bookingToReview.restaurant));
      fd.append('rating', String(data.rating));
      if (data.comment) fd.append('comment', data.comment);
      data.images.forEach(img => fd.append('images', img));
      const res = await fetch(`${API_BASE}/api/reviews/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}` },
        body: fd,
      });
      if (res.ok) {
        setToast({ message: 'Cảm ơn bạn đã đánh giá!', type: 'success' });
        loadBookings();
      } else {
        const errData = await res.json();
        setToast({ message: String(Object.values(errData).flat()[0]) || 'Gửi đánh giá thất bại', type: 'error' });
      }
    } catch { setToast({ message: 'Lỗi kết nối máy chủ', type: 'error' }); }
    finally { setReviewFormOpen(false); setBookingToReview(null); }
  };

  const handleViewReview = (b: BookingListItem) => {
    if (b.review_details)
      setToast({ message: `Đánh giá (${b.review_details.rating}★): "${b.review_details.comment}"`, type: 'success' });
  };

  const completedCount = bookings.filter(b => b.status === 'COMPLETED').length;
  const cancelledCount = bookings.filter(b => ['CANCELLED', 'REJECTED', 'NO_SHOW'].includes(b.status)).length;

  /* ── Render ── */
  return (
    <div className="bk-root">
      <Header />

      <div style={{ flex: 1 }}>
        <div className="bk-wrap bk-fadein">

          {/* Topbar */}
          <div className="bk-topbar">
            <div className="bk-topbar-left">
              <button className="bk-back-btn" onClick={() => navigate('/')}>
                <ArrowLeft size={12} />
                Trang chủ
              </button>
              <h1 className="bk-title">
                Đặt bàn <span className="bk-title-accent">của tôi</span>
              </h1>
              <p className="bk-subtitle">Quản lý và theo dõi lịch sử đặt bàn</p>
            </div>
            <button className="bk-new-btn" onClick={() => navigate('/')}>
              <Plus size={14} />
              Đặt bàn mới
            </button>
          </div>

          {/* Stats chips */}
          {!loading && bookings.length > 0 && (
            <div className="bk-chips">
              <span className="bk-chip"><span className="bk-chip-dot orange" />{upcomingBookings.length} sắp tới</span>
              <span className="bk-chip"><span className="bk-chip-dot green" />{completedCount} hoàn thành</span>
              <span className="bk-chip"><span className="bk-chip-dot gray" />{cancelledCount} đã hủy</span>
              <span className="bk-chip"><span className="bk-chip-dot blue" />{bookings.length} tổng</span>
              {customerBalance > 0 && (
                <span className="bk-chip bk-wallet-chip" title="Số dư có thể dùng để thanh toán cọc">
                  <span className="bk-chip-dot wallet" />
                  Số dư: {new Intl.NumberFormat('vi-VN').format(customerBalance)}đ
                </span>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="bk-filter-card">
            <div className="bk-filter-label">Bộ lọc</div>
            <BookingFilters onFilterChange={handleFilterChange} />
          </div>

          {/* Loading */}
          {loading && (
            <div className="bk-loading">
              <div className="bk-spinner" />
              <p className="bk-loading-txt">Đang tải đặt bàn của bạn…</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bk-error">
              <AlertCircle size={15} className="bk-error-icon" />
              <div>
                <div className="bk-error-title">Không thể tải dữ liệu</div>
                <div className="bk-error-msg">{error}</div>
              </div>
            </div>
          )}

          {/* Content */}
          {!loading && !error && (
            <>
              {bookings.length === 0 ? (
                <div className="bk-empty">
                  <div className="bk-empty-icon-wrap"><Calendar size={26} /></div>
                  <div className="bk-empty-title">Chưa có đặt bàn nào</div>
                  <p className="bk-empty-sub">
                    Bắt đầu hành trình ẩm thực — tìm nhà hàng yêu thích và đặt bàn ngay hôm nay.
                  </p>
                  <button className="bk-empty-btn" onClick={() => navigate('/')}>
                    <Plus size={13} /> Khám phá nhà hàng
                  </button>
                </div>
              ) : (
                <>
                  {upcomingBookings.length > 0 && (
                    <div>
                      <div className="bk-section-hd">
                        <div className="bk-section-icon upcoming"><CalendarDays size={13} /></div>
                        <span className="bk-section-title">Sắp tới</span>
                        <span className="bk-section-count">({upcomingBookings.length})</span>
                        <div className="bk-section-line" />
                      </div>
                      <div className="bk-cards">
                        {upcomingBookings.map(b => (
                          <BookingCard key={b.id} booking={b}
                            onViewDetail={handleViewDetail} onCancel={handleCancelClick}
                            onReview={handleReviewClick} onViewReview={handleViewReview}
                            isHighlighted={String(b.id) === highlightId} />
                        ))}
                      </div>
                    </div>
                  )}

                  {pastBookings.length > 0 && (
                    <div>
                      <div className="bk-section-hd">
                        <div className="bk-section-icon past"><History size={13} /></div>
                        <span className="bk-section-title" style={{ color: '#888' }}>Lịch sử</span>
                        <span className="bk-section-count">({pastBookings.length})</span>
                        <div className="bk-section-line" />
                      </div>
                      <div className="bk-past-cards bk-cards">
                        {pastBookings.map(b => (
                          <BookingCard key={b.id} booking={b}
                            onViewDetail={handleViewDetail} onCancel={handleCancelClick}
                            onReview={handleReviewClick} onViewReview={handleViewReview}
                            isHighlighted={String(b.id) === highlightId} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <BookingDetailModal
        bookingId={selectedBookingId} isOpen={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedBookingId(null); }}
        onCancelSuccess={() => { setToast({ message: 'Hủy đặt bàn thành công', type: 'success' }); loadBookings(); }}
      />
      <CancelConfirmDialog
        isOpen={cancelDialogOpen} onConfirm={handleCancelConfirm}
        onCancel={() => { setCancelDialogOpen(false); setBookingToCancel(null); }}
        loading={cancelling}
      />
      {reviewFormOpen && bookingToReview && (
        <ReviewForm
          bookingId={bookingToReview.id} restaurantName={bookingToReview.restaurant_name}
          onClose={() => { setReviewFormOpen(false); setBookingToReview(null); }}
          onSubmit={handleReviewSubmit}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <Footer />
    </div>
  );
};

export default MyBookings;