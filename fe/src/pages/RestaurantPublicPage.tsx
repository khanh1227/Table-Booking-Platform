// src/pages/RestaurantPublicPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Phone,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  ImageIcon,
  AlertCircle,
  Heart,
  Share2,
  ArrowLeft,
  Ticket,
  Flag,
  Send,
  Utensils
} from 'lucide-react';
import { fetchRestaurant, apiFetch, getAuthHeaders } from '@/lib/api';
import { buildImageUrl, handleImageError } from '@/lib/imageUtils';
import { getPriceRangeSymbol, getPriceRangeLabel, getPriceRangeColor, getPriceRangeDescription } from '@/lib/restaurantDisplay';
import type { RestaurantDetail } from '@/lib/api';
import ReviewList, { type ReviewData } from '@/components/reviews/ReviewList';
import BookingForm from '@/components/bookings/BookingForm';
import Header from "@/components/common/Header";
import Footer from "@/components/common/Footer";
import VoucherList from '@/components/promotions/VoucherList';

interface ToastState {
  message: string;
  visible: boolean;
}

export default function RestaurantPublicPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const RECENTLY_VIEWED_KEY = "recently_viewed_restaurant_ids_v1";
  const RECENTLY_VIEWED_MAX = 10;

  // Main states
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Gallery modal state
  const [showGallery, setShowGallery] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Menu & UI state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'menu' | 'reviews' | 'info' | 'promotions'>('menu');
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);

  // Booking form states (copied from Home.tsx pattern)
  const [bookingFormOpen, setBookingFormOpen] = useState(false);

  // Toast for share
  const [toast, setToast] = useState<ToastState>({ message: '', visible: false });

  // Report Modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const scrollToMenu = useCallback(() => {
    setActiveTab('menu');
    setTimeout(() => {
      menuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);
  // Load restaurant and reviews on mount
  useEffect(() => {
    if (!id) return;
    loadRestaurant();
    loadReviews();
    loadVouchers();

    // Load current user
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch {
        setCurrentUser(null);
      }
    }
  }, [id]);

  const loadVouchers = async () => {
    if (!id) return;
    try {
      setVouchersLoading(true);
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
      const res = await fetch(`${API_BASE}/api/promotions/vouchers/?restaurant_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        const results = data.results || data;
        // Map to VoucherList format
        const mapped: any[] = results.map((v: any) => ({
          id: v.id.toString(),
          code: v.code,
          title: v.description || v.code,
          description: v.voucher_type === 'PERCENTAGE' ? `Giảm ${v.discount_value}%` : `Giảm ${new Intl.NumberFormat('vi-VN').format(Number(v.discount_value))}đ`,
          discountType: v.voucher_type === 'PERCENTAGE' ? 'PERCENT' : 'FIXED',
          discountValue: Number(v.discount_value),
          maxDiscount: v.max_discount_amount ? Number(v.max_discount_amount) : undefined,
          minSpend: Number(v.min_order_value),
          validUntil: new Date(v.valid_to).toLocaleDateString('vi-VN'),
          isUsed: false,
          restaurantName: v.restaurant_name || undefined
        }));
        setVouchers(mapped);
      }
    } catch (err) {
      console.error('Lỗi tải mã giảm giá:', err);
    } finally {
      setVouchersLoading(false);
    }
  };

  const storeRecentlyViewed = (restaurantId: number) => {
    if (!Number.isFinite(restaurantId) || restaurantId <= 0) return;
    try {
      const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
      const list = raw ? (JSON.parse(raw) as unknown) : [];
      const ids = Array.isArray(list) ? list.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : [];
      const next = [restaurantId, ...ids.filter((x) => x !== restaurantId)].slice(0, RECENTLY_VIEWED_MAX);
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors (private mode, quota exceeded, ...)
    }
  };

  // Gallery keyboard shortcuts
  useEffect(() => {
    if (!showGallery) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentImageIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentImageIndex(prev => Math.min(sortedImages.length - 1, prev + 1));
      } else if (e.key === 'Escape') {
        setShowGallery(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGallery]);

  // Auto-hide toast messages
  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast({ ...toast, visible: false });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  const loadReviews = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
      const res = await fetch(`${API_BASE}/api/reviews/?restaurant=${id}`);
      if (res.ok) {
        const data = await res.json();
        const results = data.results || data;

        // Map backend data to ReviewData interface
        const mappedReviews: ReviewData[] = results.map((r: any) => ({
          id: r.id,
          customerName: r.customer_name,
          rating: r.rating,
          comment: r.comment,
          createdAt: new Date(r.created_at).toLocaleDateString('vi-VN'),
          reply: r.reply ? r.reply.reply_content : undefined,
          images: r.images?.map((img: any) => buildImageUrl(img.image)) || []
        }));

        setReviews(mappedReviews);
      }
    } catch (err) {
      console.error('Lỗi tải đánh giá:', err);
    }
  };

  const recordViewOnServer = async (restaurantId: number) => {
    try {
      const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
      await apiFetch(`${BASE}/api/restaurants/restaurants/${restaurantId}/record-view/`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (err) {
      console.error('Lỗi ghi nhận lịch sử xem:', err);
    }
  };

  const loadRestaurant = async () => {
    try {
      setLoading(true);
      const data = await fetchRestaurant(id!);
      setRestaurant(data);
      storeRecentlyViewed(Number(id));
      recordViewOnServer(Number(id));
      setIsFavorite(data.is_favorite || false);
    } catch (err: any) {
      setError(err.message || 'Không thể tải thông tin nhà hàng');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    const token = localStorage.getItem('access');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
      const res = await fetch(`${API_BASE}/api/restaurants/restaurants/${id}/toggle-favorite/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        setIsFavorite(data.status === 'favorited');
      }
    } catch (err) {
      console.error('Lỗi toggle favorite:', err);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: restaurant?.name,
          url: url
        });
      } catch (err) {
        console.error('Lỗi share:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setToast({ message: 'Đã sao chép link', visible: true });
      } catch (err) {
        console.error('Lỗi copy link:', err);
        setToast({ message: 'Không thể sao chép', visible: true });
      }
    }
  };

  const handleBookTable = useCallback(() => {
    const access = localStorage.getItem('access');
    if (!access) {
      navigate('/login');
      return;
    }
    setBookingFormOpen(true);
  }, [navigate]);

  const handleReportRestaurant = async () => {
    if (!id || !reportReason.trim()) return;

    const token = localStorage.getItem('access');
    if (!token) {
      navigate('/login');
      return;
    }

    setReporting(true);
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
      const res = await fetch(`${API_BASE}/api/restaurants/restaurants/${id}/report/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reportReason.trim() })
      });

      if (res.ok) {
        setToast({ message: 'Báo cáo của bạn đã được gửi. Cảm ơn bạn!', visible: true });
        setShowReportModal(false);
        setReportReason('');
      } else {
        const data = await res.json();
        alert(data.error || 'Gửi báo cáo thất bại');
      }
    } catch (err) {
      console.error('Lỗi gửi báo cáo:', err);
      alert('Có lỗi xảy ra khi gửi báo cáo');
    } finally {
      setReporting(false);
    }
  };

  const [reportingReviewId, setReportingReviewId] = useState<number | null>(null);
  const [showReviewReportModal, setShowReviewReportModal] = useState(false);
  const [reviewReportReason, setReviewReportReason] = useState('');

  const handleReportReview = async (reviewId: number) => {
    setReportingReviewId(reviewId);
    setShowReviewReportModal(true);
  };

  const submitReviewReport = async () => {
    if (!reportingReviewId || !reviewReportReason.trim()) return;

    const token = localStorage.getItem('access');
    if (!token) {
      navigate('/login');
      return;
    }

    setReporting(true);
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
      const res = await fetch(`${API_BASE}/api/reviews/${reportingReviewId}/report/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reviewReportReason.trim() })
      });

      if (res.ok) {
        setToast({ message: 'Đã gửi báo cáo đánh giá.', visible: true });
        setShowReviewReportModal(false);
        setReviewReportReason('');
        setReportingReviewId(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Báo cáo thất bại');
      }
    } catch (err) {
      console.error('Lỗi báo cáo review:', err);
    } finally {
      setReporting(false);
    }
  };
  // Computed values
  const sortedImages = restaurant?.images
    ? [...restaurant.images].sort((a, b) => a.display_order - b.display_order)
    : [];

  const dishImages = restaurant?.menu_items?.filter(item => item.image_url) || [];

  // Prepare 4 slots for the right side gallery
  const sideSlots = [];
  const galleryForSlots = sortedImages.slice(1, 5);
  sideSlots.push(...galleryForSlots.map((img, idx) => ({
    url: img.image_url,
    type: 'gallery' as const,
    index: idx + 1,
    name: `Ảnh nhà hàng ${idx + 2}`
  })));

  let dishIdxForSlots = 0;
  while (sideSlots.length < 4) {
    if (dishImages[dishIdxForSlots]) {
      sideSlots.push({
        url: dishImages[dishIdxForSlots].image_url,
        type: 'dish' as const,
        index: dishIdxForSlots,
        name: dishImages[dishIdxForSlots].name
      });
      dishIdxForSlots++;
    } else {
      sideSlots.push(null);
    }
  }


  const categories = ['all', ...new Set(
    restaurant?.menu_items
      ?.filter(item => item.category)
      .map(item => String(item.category)) || []
  )];

  const filteredMenuItems = restaurant?.menu_items?.filter(item => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  }) || [];

  const detailedAddress = (() => {
    if (!restaurant) return '';
    const base = (restaurant.address || '').trim();
    const locationParts = [
      restaurant.location?.ward,
      restaurant.location?.district,
      restaurant.location?.city,
    ]
      .map((p) => (p || '').trim())
      .filter(Boolean);

    if (!locationParts.length) return base;

    const baseNorm = base.toLowerCase();
    const missingParts = locationParts.filter(
      (part) => !baseNorm.includes(part.toLowerCase())
    );

    if (!base) return locationParts.join(', ');
    if (!missingParts.length) return base;
    return `${base}, ${missingParts.join(', ')}`;
  })();

  // TODO: Backend should provide current_availability or opening_hours to check if open now
  // For now, we'll show status as "Đang mở" if restaurant exists and is approved
  const isOpenNow = () => {
    return restaurant?.status === 'APPROVED';
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Đang tải thông tin nhà hàng...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Error state
  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-grow flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Không tìm thấy nhà hàng</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              Về trang chủ
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow">
        {/* ==================== HERO SECTION ==================== */}
        <section className="bg-white">
          <div className="container mx-auto px-4 py-6">
            {/* HERO GALLERY WITH FLOATING BUTTONS */}
            <div className="relative mb-8 group/hero">
              {/* Floating Top Bar Buttons */}
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2.5 bg-white/90 hover:bg-white text-gray-800 rounded-xl transition-all shadow-lg backdrop-blur-sm group/back"
                  title="Quay lại"
                >
                  <ArrowLeft className="w-5 h-5 group-hover/back:-translate-x-0.5 transition-transform" />
                </button>
              </div>

              <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <button
                  onClick={handleToggleFavorite}
                  className={`p-2.5 rounded-xl transition-all shadow-lg backdrop-blur-sm ${isFavorite
                      ? 'bg-red-600 text-white'
                      : 'bg-white/90 hover:bg-white text-gray-800'
                    }`}
                  title="Yêu thích"
                >
                  <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                </button>

                <button
                  onClick={handleShare}
                  className="p-2.5 bg-white/90 hover:bg-white text-gray-800 rounded-xl transition-all shadow-lg backdrop-blur-sm"
                  title="Chia sẻ"
                >
                  <Share2 className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setShowReportModal(true)}
                  className="p-2.5 bg-white/90 hover:bg-white text-gray-800 rounded-xl transition-all shadow-lg backdrop-blur-sm"
                  title="Báo cáo"
                >
                  <Flag className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col lg:flex-row gap-2 h-auto lg:h-[440px] overflow-hidden rounded-2xl shadow-xl border border-gray-100 relative bg-white">
                {/* Main Large Image (Left - Takes remaining space and fills height) */}
                <div
                  className="flex-1 relative group cursor-pointer overflow-hidden bg-gray-50 min-h-[300px]"
                  onClick={() => { setCurrentImageIndex(0); setShowGallery(true); }}
                >
                  <img
                    src={buildImageUrl(sortedImages[0]?.image_url)}
                    alt={restaurant.name}
                    className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    onError={handleImageError}
                  />
                </div>

                {/* Right Side Grid - Forced Square Slots (Lock height/width) */}
                <div className="hidden lg:grid w-[440px] grid-cols-2 grid-rows-2 gap-2 flex-shrink-0">
                  {sideSlots.map((slot, i) => {
                    return (
                      <div
                        key={i}
                        className="relative cursor-pointer group overflow-hidden bg-gray-50 aspect-square"
                        onClick={() => {
                          if (slot && slot.type === 'gallery') {
                            setCurrentImageIndex(slot.index);
                            setShowGallery(true);
                          } else {
                            scrollToMenu();
                          }
                        }}
                      >
                        <img
                          src={buildImageUrl(slot?.url)}
                          alt={slot?.name || 'Restaurant photo'}
                          className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-110"
                          onError={handleImageError}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Floating "Show All" Button */}
                <button
                  onClick={() => { setCurrentImageIndex(0); setShowGallery(true); }}
                  className="absolute bottom-4 right-4 z-20 px-4 py-2 bg-white/90 hover:bg-white text-gray-900 rounded-xl text-sm font-bold shadow-xl backdrop-blur-md border border-gray-200 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 group/btn"
                >
                  <ImageIcon className="w-4 h-4 text-red-600 group-hover/btn:scale-110 transition-transform" />
                  <span>Xem tất cả ({sortedImages.length})</span>
                </button>
              </div>
            </div>

            {/* TWO-COLUMN CONTENT LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
              {/* === LEFT COLUMN: INFO & TABS === */}
              <div className="space-y-8">
                {/* Header Info Card */}
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">{restaurant.name}</h1>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-black uppercase tracking-widest border border-red-100">
                        {restaurant.cuisine_type || 'Ẩm thực'}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border ${getPriceRangeColor(restaurant.price_range)}`}>
                        {getPriceRangeLabel(restaurant.price_range as any)}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-6 h-6 flex items-center justify-center text-gray-400 mt-0.5">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <p className="text-gray-700 leading-relaxed font-medium">
                        {detailedAddress}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-6 h-6 flex items-center justify-center text-gray-400">
                        <Flag className="w-5 h-5" />
                      </div>
                      <p className="text-gray-700">
                        Loại hình: <span className="text-red-600 font-bold">{restaurant.cuisine_type || 'Đang cập nhật'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-6 h-6 flex items-center justify-center text-gray-400">
                        <Ticket className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-700 font-medium">Khoảng giá:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-600 font-medium">
                            {getPriceRangeDescription(restaurant.price_range)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-6 h-6 flex items-center justify-center text-gray-400">
                        <Clock className="w-5 h-5" />
                      </div>
                      <p className={`font-bold ${isOpenNow() ? 'text-green-600' : 'text-red-600'}`}>
                        {isOpenNow() ? 'Đang mở cửa: 10:00 - 22:00' : 'Đã đóng cửa'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Main Tabs Navigation */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex bg-gray-50/50 border-b border-gray-100 overflow-x-auto no-scrollbar">
                    {['menu', 'reviews', 'promotions', 'info'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-8 py-5 text-sm font-bold uppercase tracking-widest whitespace-nowrap transition-all relative ${activeTab === tab
                            ? 'text-red-600 border-b-2 border-red-600 bg-white'
                            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100/50'
                          }`}
                      >
                        {tab === 'menu' ? 'Thực đơn' : tab === 'reviews' ? 'Đánh giá' : tab === 'promotions' ? 'Ưu đãi' : 'Giới thiệu'}
                      </button>
                    ))}
                  </div>

                  <div className="p-8 min-h-[400px]">
                    {/* ===== TAB CONTENT LOGIC ===== */}
                    {activeTab === 'menu' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-gray-900">Danh mục món ăn</h3>
                          <span className="text-sm text-gray-500">{restaurant.menu_items?.length || 0} món</span>
                        </div>

                        {/* Category Filter */}
                        {categories.length > 1 && (
                          <div className="flex flex-wrap gap-3 mb-8">
                            {categories.map(cat => (
                              <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedCategory === cat
                                    ? 'bg-red-600 text-white shadow-lg shadow-red-100'
                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                  }`}
                              >
                                {cat === 'all' ? 'Tất cả' : cat}
                              </button>
                            ))}
                          </div>
                        )}

                        {filteredMenuItems.length === 0 ? (
                          <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                            <Utensils className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 font-medium">Chưa có món ăn nào trong danh mục này</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filteredMenuItems.map((item) => (
                              <div
                                key={item.id}
                                className="group flex gap-4 p-4 rounded-2xl border border-gray-100 hover:border-red-100 hover:bg-red-50/30 transition-all"
                              >
                                <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100 flex items-center justify-center">
                                  <img
                                    src={buildImageUrl(item.image_url)}
                                    alt={item.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    onError={handleImageError}
                                  />
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-bold text-gray-900 mb-1 group-hover:text-red-600 transition-colors">
                                    {item.name}
                                  </h3>
                                  {item.description && (
                                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                                      {item.description}
                                    </p>
                                  )}
                                  <p className="text-sm font-black text-red-600">
                                    {new Intl.NumberFormat('vi-VN', {
                                      style: 'currency',
                                      currency: 'VND',
                                    }).format(item.price)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'reviews' && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ReviewList
                          reviews={reviews}
                          ratingAverage={Number(restaurant.rating || 0)}
                          ratingCount={reviews.length}
                          onReport={(currentUser?.role === 'PARTNER' && restaurant.partner === currentUser?.partner_id) ? handleReportReview : undefined}
                        />
                      </div>
                    )}

                    {activeTab === 'promotions' && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 mb-8">
                          <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                            <Ticket className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">Ưu đãi độc quyền</h3>
                            <p className="text-sm text-gray-500">Dành riêng cho khách hàng đặt bàn qua hệ thống</p>
                          </div>
                        </div>

                        {vouchersLoading ? (
                          <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
                          </div>
                        ) : vouchers.length === 0 ? (
                          <div className="text-center py-20 bg-orange-50/30 rounded-3xl border border-dashed border-orange-100">
                            <Ticket className="w-12 h-12 text-orange-200 mx-auto mb-4" />
                            <p className="text-orange-900 font-bold">Hiện chưa có mã giảm giá nào</p>
                            <p className="text-orange-600/60 text-sm mt-1">Quay lại sau để cập nhật ưu đãi mới nhất</p>
                          </div>
                        ) : (
                          <VoucherList vouchers={vouchers} selectable={false} />
                        )}
                      </div>
                    )}

                    {activeTab === 'info' && (
                      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {restaurant.description && (
                          <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100">
                            <h3 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-widest text-xs opacity-40">Giới thiệu</h3>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap font-medium italic">
                              "{restaurant.description}"
                            </p>
                          </div>
                        )}

                        {detailedAddress && (
                          <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                              <MapPin className="w-6 h-6 text-red-600" />
                              <h3 className="text-xl font-bold text-gray-900">Vị trí nhà hàng</h3>
                            </div>
                            <p className="text-gray-600 mb-8 font-medium">{detailedAddress}</p>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detailedAddress)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl transition-all hover:shadow-xl hover:-translate-y-1 active:translate-y-0"
                            >
                              <MapPin className="w-5 h-5" />
                              Dẫn đường trên Google Maps
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* === RIGHT COLUMN: STICKY BOOKING CARD === */}
              <div className="lg:sticky lg:top-6 space-y-6">
                <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-gray-900">Đặt chỗ ngay</h3>
                    <p className="text-sm text-gray-500 font-medium">Giữ chỗ miễn phí chỉ trong vài giây</p>
                  </div>
                  
                  <button
                    onClick={handleBookTable}
                    className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-red-100 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    Đặt bàn ngay
                  </button>
                  
                  <div className="space-y-4 pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-gray-700">{restaurant.phone_number || 'Đang cập nhật số'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                        <Flag className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-gray-700">{restaurant.cuisine_type || 'Ẩm thực'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ==================== GALLERY MODAL ==================== */}
      {showGallery && sortedImages[currentImageIndex] && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
          {/* Close Button */}
          <button
            onClick={() => setShowGallery(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Main Image */}
          <div className="flex-grow flex items-center justify-center max-w-6xl w-full">
            <img
              src={buildImageUrl(sortedImages[currentImageIndex].image_url)}
              alt={`${restaurant.name} - ${currentImageIndex + 1}`}
              className="max-h-[80vh] max-w-full object-contain rounded-lg"
              onError={handleImageError}
            />
          </div>

          {/* Navigation Buttons */}
          {sortedImages.length > 1 && (
            <>
              <button
                onClick={() => setCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
                disabled={currentImageIndex === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>

              <button
                onClick={() => setCurrentImageIndex(Math.min(sortedImages.length - 1, currentImageIndex + 1))}
                disabled={currentImageIndex === sortedImages.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Toast Message */}
      {toast.visible && (
        <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg p-4 text-gray-900 z-40 shadow-lg">
          {toast.message}
        </div>
      )}

      {/* BookingForm Modal */}
      {bookingFormOpen && restaurant && (
        <BookingForm
          restaurant={restaurant}
          initialDate=""
          initialGuests="2"
          onClose={() => setBookingFormOpen(false)}
          onSuccess={(bookingId) => {
            setBookingFormOpen(false);
            navigate(`/my-bookings?highlight=${bookingId}`);
          }}
        />
      )}

      {/* Report Restaurant Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600">
                    <Flag className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900">Báo cáo vi phạm</h3>
                    <p className="text-sm text-gray-500 font-medium">Giúp chúng tôi hiểu vấn đề đang xảy ra</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Lý do báo cáo *</label>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Vui lòng mô tả chi tiết vi phạm (ví dụ: thông tin sai sự thật, thái độ phục vụ kém, lừa đảo...)"
                    rows={5}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all resize-none text-sm"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-all uppercase tracking-widest text-xs"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={handleReportRestaurant}
                    disabled={reporting || !reportReason.trim()}
                    className="flex-[2] px-6 py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-xl shadow-red-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                  >
                    {reporting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Gửi báo cáo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Review Modal (For Partner) */}
      {showReviewReportModal && (
        <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                    <Flag className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900">Báo cáo đánh giá</h3>
                    <p className="text-sm text-gray-500 font-medium">Báo cáo các nội dung không phù hợp hoặc giả mạo</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReviewReportModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Lý do báo cáo đánh giá *</label>
                  <textarea
                    value={reviewReportReason}
                    onChange={(e) => setReviewReportReason(e.target.value)}
                    placeholder="Mô tả lý do bạn cho rằng đánh giá này vi phạm chính sách (vd: xúc phạm, spam, không đúng sự thật...)"
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none text-sm"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowReviewReportModal(false)}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-all uppercase tracking-widest text-xs"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={submitReviewReport}
                    disabled={reporting || !reviewReportReason.trim()}
                    className="flex-[2] px-6 py-3 bg-amber-600 text-white font-bold rounded-2xl hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-xl shadow-amber-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                  >
                    {reporting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Gửi yêu cầu
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
