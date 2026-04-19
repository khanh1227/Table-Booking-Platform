// src/pages/RestaurantPublicPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Phone,
  Clock,
  Star,
  ChevronLeft,
  ChevronRight,
  X,
  ImageIcon,
  AlertCircle,
  Heart,
  Share2,
  ArrowLeft
} from 'lucide-react';
import { fetchRestaurant } from '@/lib/api';
import { buildImageUrl, PLACEHOLDER_IMAGE, handleImageError } from '@/lib/imageUtils';
import type { RestaurantDetail } from '@/lib/api';
import ReviewList, { type ReviewData } from '@/components/reviews/ReviewList';
import BookingForm from '@/components/bookings/BookingForm';
import Header from "@/components/common/Header";
import Footer from "@/components/common/Footer";

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
  const [activeTab, setActiveTab] = useState<'menu' | 'reviews' | 'info'>('menu');
  const [reviews, setReviews] = useState<ReviewData[]>([]);

  // Booking form states (copied from Home.tsx pattern)
  const [bookingFormOpen, setBookingFormOpen] = useState(false);

  // Toast for share
  const [toast, setToast] = useState<ToastState>({ message: '', visible: false });

  // Load restaurant and reviews on mount
  useEffect(() => {
    if (!id) return;
    loadRestaurant();
    loadReviews();
    
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

  const loadRestaurant = async () => {
    try {
      setLoading(true);
      const data = await fetchRestaurant(id!);
      setRestaurant(data);
      storeRecentlyViewed(Number(id));
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
    if (currentUser?.role !== 'CUSTOMER') {
      alert('Chỉ khách hàng mới có thể đặt bàn');
      return;
    }
    setBookingFormOpen(true);
  }, [currentUser?.role, navigate]);
  // Computed values
  const sortedImages = restaurant?.images
    ? [...restaurant.images].sort((a, b) => a.display_order - b.display_order)
    : [];

  const remainingCount = Math.max(0, sortedImages.length - 3);

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
        <section className="bg-white border-b border-gray-100">
          <div className="container mx-auto px-4 py-4">
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Quay lại"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleToggleFavorite}
                  className={`p-2 rounded-lg transition-colors ${
                    isFavorite
                      ? 'bg-red-50 text-red-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title="Yêu thích"
                >
                  <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                </button>

                <button
                  onClick={handleShare}
                  className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  title="Chia sẻ"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Media Grid: 1.8fr 1fr layout */}
            {sortedImages.length > 0 && (
              <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: '1.8fr 1fr' }}>
                {/* Main Image */}
                <div
                  className="h-[110px] rounded-lg overflow-hidden cursor-pointer group"
                  onClick={() => {
                    setCurrentImageIndex(0);
                    setShowGallery(true);
                  }}
                >
                  <img
                    src={buildImageUrl(sortedImages[0].image_url)}
                    alt={restaurant.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    onError={handleImageError}
                  />
                </div>

                {/* Side Images (2 vertical) */}
                <div className="flex gap-3">
                  {sortedImages.slice(1, 3).map((img, idx) => (
                    <div
                      key={img.id}
                      className="flex-1 h-[110px] rounded-lg overflow-hidden cursor-pointer group relative"
                      onClick={() => {
                        setCurrentImageIndex(idx + 1);
                        setShowGallery(true);
                      }}
                    >
                      <img
                        src={buildImageUrl(img.image_url)}
                        alt={`${restaurant.name} - ${idx + 2}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={handleImageError}
                      />

                      {/* "+N ảnh" overlay on last image */}
                      {idx === 1 && remainingCount > 0 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white font-semibold">+{remainingCount}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Identity Block */}
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                {restaurant.name}
              </h1>
              
              {/* Meta Info: One line */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                {/* Rating */}
                {parseFloat(String(restaurant.rating)) > 0 && (
                  <>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold">{parseFloat(String(restaurant.rating)).toFixed(1)}</span>
                      <span>({reviews.length})</span>
                    </div>
                    <span className="text-gray-400">·</span>
                  </>
                )}

                {/* Cuisine Type - TODO: add to backend */}
                {restaurant.cuisine_type && (
                  <>
                    <span>{restaurant.cuisine_type}</span>
                    <span className="text-gray-400">·</span>
                  </>
                )}

                {/* Address (truncated) */}
                <span className="truncate">{detailedAddress}</span>

                {/* Open/Closed status */}
                <span className="text-gray-400">·</span>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${isOpenNow() ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-xs font-medium">{isOpenNow() ? 'Đang mở' : 'Đã đóng'}</span>
                </div>
              </div>
            </div>

            {/* Stats Strip */}
            <div className="grid grid-cols-4 gap-4 mb-6 border-t border-b border-gray-100 py-4">
              {/* Review count */}
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{reviews.length}</p>
                <p className="text-xs text-gray-500">Đánh giá</p>
              </div>

              {/* Menu items count */}
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{restaurant.menu_items?.length || 0}</p>
                <p className="text-xs text-gray-500">Món ăn</p>
              </div>

              {/* Availability - TODO: backend add available_seats field */}
              <div className="text-center">
                <p className={`text-lg font-bold ${isOpenNow() ? 'text-green-600' : 'text-red-600'}`}>
                  {isOpenNow() ? 'Còn bàn' : 'Hết bàn'}
                </p>
                <p className="text-xs text-gray-500">Trạng thái</p>
              </div>

              {/* Kitchen type - TODO: backend add kitchen_type field */}
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">-</p>
                <p className="text-xs text-gray-500">Loại bếp</p>
              </div>
            </div>

            {/* CTA Strip */}
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                <p className="font-medium">Đặt bàn nhanh</p>
                <p className="text-xs">Còn bàn hôm nay</p>
              </div>

              <button
                onClick={handleBookTable}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex-shrink-0"
              >
                Đặt Bàn Ngay
              </button>
            </div>
          </div>
        </section>

        {/* ==================== BODY LAYOUT ==================== */}
        <section className="container mx-auto px-4 py-12">
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            {/* ===== SIDEBAR ===== */}
            <aside className="lg:sticky lg:top-6 h-fit">
              {/* Info Card */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
                {/* Address */}
                <div className="flex gap-3 pb-4">
                  <MapPin className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Địa chỉ</p>
                    <p className="text-sm text-gray-900">{detailedAddress}</p>
                  </div>
                </div>

                <div className="border-t border-gray-100 my-4" />

                {/* Phone */}
                {restaurant.phone_number && (
                  <>
                    <div className="flex gap-3 pb-4">
                      <Phone className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Điện thoại</p>
                        <a
                          href={`tel:${restaurant.phone_number}`}
                          className="text-sm text-red-600 hover:text-red-700 transition"
                        >
                          {restaurant.phone_number}
                        </a>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 my-4" />
                  </>
                )}

                {/* Hours */}
                {restaurant.opening_hours && (
                  <>
                    <div className="flex gap-3">
                      <Clock className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Giờ mở cửa</p>
                        <p className="text-sm text-gray-900">{restaurant.opening_hours}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Book Now Button (Sticky) */}
              <button
                onClick={handleBookTable}
                className="w-full py-3 mb-6 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Đặt Bàn
              </button>

              {/* Description Card (if available) */}
              {restaurant.description && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase">Giới thiệu</h3>
                  <p className="text-sm text-gray-600 line-clamp-4">
                    {restaurant.description}
                  </p>
                </div>
              )}
            </aside>

            {/* ===== MAIN CONTENT (TABS) ===== */}
            <div>
              {/* Tab Bar */}
              <div className="flex gap-8 mb-8 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('menu')}
                  className={`pb-4 font-semibold transition-colors relative ${
                    activeTab === 'menu'
                      ? 'text-gray-900 border-b-2 border-red-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Thực đơn
                </button>

                <button
                  onClick={() => setActiveTab('reviews')}
                  className={`pb-4 font-semibold transition-colors relative ${
                    activeTab === 'reviews'
                      ? 'text-gray-900 border-b-2 border-red-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Đánh giá ({reviews.length})
                </button>

                <button
                  onClick={() => setActiveTab('info')}
                  className={`pb-4 font-semibold transition-colors relative ${
                    activeTab === 'info'
                      ? 'text-gray-900 border-b-2 border-red-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Giới thiệu
                </button>
              </div>

              {/* ===== TAB: MENU ===== */}
              {activeTab === 'menu' && (
                <div>
                  {/* Category Filter */}
                  {categories.length > 1 && (
                    <div className="flex flex-wrap gap-3 mb-8">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            selectedCategory === cat
                              ? 'bg-red-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {cat === 'all' ? 'Tất cả' : cat}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Menu Grid */}
                  {filteredMenuItems.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-12 text-center shadow-sm">
                      <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Chưa có thực đơn</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredMenuItems.map(item => (
                        <div
                          key={item.id}
                          className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow shadow-sm"
                        >
                          {/* Image */}
                          <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                            <img
                              src={item.image_url ? buildImageUrl(item.image_url) : PLACEHOLDER_IMAGE}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              onError={handleImageError}
                            />

                            {!item.is_available && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="text-white font-semibold">Tạm hết</span>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-4">
                            <h3 className="text-sm font-semibold text-gray-900 mb-1">
                              {item.name}
                            </h3>

                            {item.description && (
                              <p className="text-xs text-gray-500 line-clamp-1 mb-3">
                                {item.description}
                              </p>
                            )}

                            <p className="text-sm font-bold text-red-600">
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

              {/* ===== TAB: REVIEWS ===== */}
              {activeTab === 'reviews' && (
                <ReviewList
                  reviews={reviews}
                  ratingAverage={Number(restaurant.rating || 0)}
                  ratingCount={reviews.length}
                />
              )}

              {/* ===== TAB: INFO ===== */}
              {activeTab === 'info' && (
                <div>{/* Description */}
                  {restaurant.description && (
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Mô tả</h3>
                      <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {restaurant.description}
                      </p>
                    </div>
                  )}

                  {/* Location Map */}
                  {detailedAddress && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-red-600" />
                        Địa điểm
                      </h3>
                      
                      <p className="text-gray-600 mb-4">{detailedAddress}</p>
                      
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detailedAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      >
                        Xem trên Google Maps
                      </a>
                    </div>
                  )}
                </div>
              )}
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

          {/* Counter */}
          <div className="absolute top-4 left-4 text-white font-semibold">
            {currentImageIndex + 1} / {sortedImages.length}
          </div>

          {/* Thumbnail Strip */}
          {sortedImages.length > 1 && (
            <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {sortedImages.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden transition-all ${
                    currentImageIndex === idx
                      ? 'ring-2 ring-red-600 scale-110'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={buildImageUrl(img.image_url)}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                  />
                </button>
              ))}
            </div>
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
          onSuccess={() => {
            setBookingFormOpen(false);
            navigate('/my-bookings');
          }}
        />
      )}

      <Footer />
    </div>
  );
}