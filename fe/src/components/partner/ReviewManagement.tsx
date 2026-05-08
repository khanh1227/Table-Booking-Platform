// src/components/partner/ReviewManagement.tsx
import { useState, useEffect } from 'react';
import {
  Star,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Reply,
  Loader2,
  Calendar,
  User,
  Utensils,
  ChevronDown,
  Eye,
  Building2
} from 'lucide-react';
import {
  fetchPartnerReviews,
  fetchMyRestaurants,
  markReviewAsRead,
  replyToReview,
  type Review,
  type ReviewReply
} from '@/lib/api';

export default function ReviewManagement({ restaurantId }: { restaurantId?: string | null }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterRating, setFilterRating] = useState<number | 'ALL'>('ALL');
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterResId, setFilterResId] = useState<string | 'ALL'>('ALL');
  const [allMyRestaurants, setAllMyRestaurants] = useState<any[]>([]);

  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    loadInitialData();
  }, [restaurantId, filterResId]);
  
  const loadInitialData = async () => {
    await Promise.all([
      loadRestaurants(),
      loadReviews()
    ]);
  };

  const loadRestaurants = async () => {
    try {
      const data = await fetchMyRestaurants();
      setAllMyRestaurants(data);
    } catch (err) {
      console.error('Lỗi tải danh sách nhà hàng:', err);
    }
  };

  const loadReviews = async () => {
    try {
      setLoading(true);
      setError('');
      // Ưu tiên restaurantId từ prop, nếu không có mới dùng filter nội bộ (hoặc ALL)
      const targetResId = restaurantId || (filterResId === 'ALL' ? undefined : filterResId);
      const data = await fetchPartnerReviews({ restaurant_id: targetResId });
      setReviews(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách đánh giá');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await markReviewAsRead(id);
      setReviews(prev => prev.map(r => r.id === id ? { ...r, is_read_by_partner: true } : r));
    } catch (err) {
      console.error('Lỗi đánh dấu đã đọc:', err);
    }
  };

  const handleReplySubmit = async (id: number) => {
    if (!replyContent.trim()) return;

    setActionLoading(id);
    try {
      const replyData = await replyToReview(id, replyContent);
      setReviews(prev => prev.map(r =>
        r.id === id ? { ...r, reply: replyData, is_read_by_partner: true } : r
      ));
      setReplyingId(null);
      setReplyContent('');
    } catch (err: any) {
      alert(err.message || 'Gửi phản hồi thất bại');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredReviews = reviews.filter(r => {
    const matchRating = filterRating === 'ALL' || r.rating === filterRating;
    const matchUnread = !filterUnread || !r.is_read_by_partner;
    return matchRating && matchUnread;
  });

  const stats = {
    total: reviews.length,
    avg: reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : 0,
    unread: reviews.filter(r => !r.is_read_by_partner).length,
    noReply: reviews.filter(r => !r.reply).length
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
        <p className="text-slate-400 font-medium animate-pulse">Đang tải đánh giá...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 p-6 rounded-3xl">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Tổng đánh giá</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-black text-white">{stats.total}</h3>
            <MessageSquare className="w-8 h-8 text-blue-500/20" />
          </div>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 p-6 rounded-3xl">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Điểm trung bình</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-black text-white">{stats.avg}</h3>
            <div className="flex text-orange-500">
              <Star className="w-6 h-6 fill-orange-500" />
            </div>
          </div>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 blur-3xl rounded-full" />
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Mới chưa đọc</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-black text-red-400">{stats.unread}</h3>
            <AlertCircle className="w-8 h-8 text-red-500/20" />
          </div>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 p-6 rounded-3xl">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Chưa phản hồi</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-black text-amber-400">{stats.noReply}</h3>
            <Reply className="w-8 h-8 text-amber-500/20" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-slate-900/50 p-4 rounded-3xl border border-slate-800 shadow-inner">
        <div className="flex flex-wrap gap-4 items-center w-full xl:w-auto">
          <div className="flex gap-2 items-center overflow-x-auto no-scrollbar pb-2 md:pb-0">
            <span className="text-sm text-slate-500 mr-2 flex items-center gap-2">
              <Filter className="w-4 h-4" /> Điểm:
            </span>
            {['ALL', 5, 4, 3, 2, 1].map((val) => (
              <button
                key={val}
                onClick={() => setFilterRating(val as any)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition flex items-center gap-1 whitespace-nowrap ${filterRating === val
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
              >
                {val === 'ALL' ? 'Tất cả' : <>{val} <Star className="w-3 h-3 fill-current" /></>}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-800 hidden md:block" />

          {/* Restaurant Filter Dropdown */}
          {!restaurantId && (
            <div className="relative group min-w-[200px]">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500 transition-colors">
                <Building2 className="w-4 h-4" />
              </div>
              <select
                value={filterResId}
                onChange={(e) => setFilterResId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-xl py-2 pl-9 pr-8 outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none transition-all cursor-pointer"
              >
                <option value="ALL">Tất cả cơ sở</option>
                {allMyRestaurants.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          )}
          
          {restaurantId && (
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
              <Building2 className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">
                {allMyRestaurants.find(r => String(r.id) === String(restaurantId))?.name || 'Chi nhánh hiện tại'}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => setFilterUnread(!filterUnread)}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2 border ${filterUnread
            ? 'bg-red-500/20 text-red-400 border-red-500/30'
            : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
        >
          {filterUnread ? 'Đang lọc: Chưa đọc' : 'Chỉ xem chưa đọc'}
        </button>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="py-20 text-center bg-slate-800/20 border border-dashed border-slate-700 rounded-3xl">
            <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">Không tìm thấy đánh giá nào khớp với bộ lọc</p>
          </div>
        ) : (
          filteredReviews.map((review) => (
            <div
              key={review.id}
              className={`group relative bg-slate-800/40 backdrop-blur-sm border transition-all duration-300 rounded-3xl p-6 hover:bg-slate-800/60 ${!review.is_read_by_partner ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.1)]' : 'border-slate-700/50 hover:border-slate-600'
                }`}
              onMouseEnter={() => !review.is_read_by_partner && handleMarkRead(review.id)}
            >
              {!review.is_read_by_partner && (
                <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg animate-bounce">
                  MỚI
                </div>
              )}

              <div className="flex flex-col lg:flex-row gap-8">
                {/* User & Rating Info */}
                <div className="lg:w-1/4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-slate-600 shadow-inner">
                      <User className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white leading-tight">{review.customer_name}</h4>
                      <p className="text-slate-500 text-[10px] font-bold uppercase flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(review.created_at).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-5 h-5 ${s <= review.rating ? 'text-orange-500 fill-orange-500' : 'text-slate-700'}`}
                      />
                    ))}
                  </div>

                  <div className="p-3 bg-slate-900/50 rounded-2xl border border-slate-700/50">
                    <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Tại nhà hàng</p>
                    <p className="text-white text-xs font-bold flex items-center gap-2">
                      <Utensils className="w-3 h-3 text-orange-500" />
                      {review.restaurant_name}
                    </p>
                  </div>
                </div>

                {/* Content & Reply */}
                <div className="flex-1 space-y-6">
                  <div className="relative">
                    <p className="text-slate-200 text-lg leading-relaxed italic">"{review.comment || 'Khách hàng không để lại nhận xét.'}"</p>

                    {/* Images */}
                    {review.images && review.images.length > 0 && (
                      <div className="flex gap-2 mt-4 overflow-x-auto pb-2 no-scrollbar">
                        {review.images.map(img => (
                          <img
                            key={img.id}
                            src={img.image}
                            alt="Review image"
                            className="w-24 h-24 object-cover rounded-xl border border-slate-700 hover:scale-105 transition duration-300"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-700/50 pt-6">
                    {replyingId === review.id ? (
                      <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                        <textarea
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          placeholder="Viết lời cảm ơn hoặc giải đáp thắc mắc của khách..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-white text-sm focus:ring-2 focus:ring-orange-500/50 outline-none min-h-[100px] resize-none"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReplySubmit(review.id)}
                            disabled={!replyContent.trim() || actionLoading === review.id}
                            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 disabled:opacity-50"
                          >
                            {actionLoading === review.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Reply className="w-3 h-3" />}
                            {review.reply ? 'Cập nhật phản hồi' : 'Gửi phản hồi'}
                          </button>
                          <button
                            onClick={() => setReplyingId(null)}
                            className="px-6 py-2 bg-slate-800 text-slate-400 font-bold rounded-xl text-xs hover:bg-slate-700 transition"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : review.reply ? (
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 relative group/reply">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-emerald-400 text-xs font-bold flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Phản hồi của bạn
                          </p>
                          <button
                            onClick={() => {
                              setReplyingId(review.id);
                              setReplyContent(review.reply?.reply_content || '');
                            }}
                            className="text-slate-500 hover:text-white text-[10px] font-bold uppercase flex items-center gap-1 transition"
                          >
                            Chỉnh sửa
                          </button>
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed">{review.reply.reply_content}</p>
                        <p className="text-slate-500 text-[10px] mt-2">
                          {new Date(review.reply.created_at).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setReplyingId(review.id);
                          setReplyContent('');
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-orange-500 hover:text-white text-slate-400 rounded-2xl transition-all duration-300 font-bold text-xs border border-slate-700 group-hover:border-orange-500/50"
                      >
                        <Reply className="w-4 h-4" />
                        Phản hồi khách hàng ngay
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
