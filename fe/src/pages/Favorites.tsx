import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Loader2, ArrowLeft, Clock } from "lucide-react";
import RestaurantCard, { type RestaurantCardDto } from "@/components/restaurant/RestaurantCard";
import Header from "@/components/common/Header";
import Footer from "@/components/common/Footer";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
const RECENTLY_VIEWED_KEY = "recently_viewed_restaurant_ids_v1";
const MAX_RECENT = 6;

export default function Favorites() {
  const [restaurants, setRestaurants] = useState<RestaurantCardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const navigate = useNavigate();

  // Recently viewed state
  const [recentRestaurants, setRecentRestaurants] = useState<RestaurantCardDto[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    fetchFavorites();
  }, [page]);

  // Fetch recently viewed restaurants from localStorage
  useEffect(() => {
    let cancelled = false;
    const fetchRecent = async () => {
      try {
        const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
        const list = raw ? (JSON.parse(raw) as unknown) : [];
        const ids = Array.isArray(list)
          ? list.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
          : [];

        const uniqueIds = Array.from(new Set(ids));
        if (!uniqueIds.length) return;

        setShowRecent(true);
        setLoadingRecent(true);

        const items = await Promise.all(
          uniqueIds.slice(0, MAX_RECENT).map(async (rid) => {
            const res = await fetch(`${API_BASE}/api/restaurants/restaurants/${rid}/`);
            if (!res.ok) return null;
            return (await res.json()) as RestaurantCardDto;
          })
        );

        if (cancelled) return;
        setRecentRestaurants(items.filter(Boolean) as RestaurantCardDto[]);
      } catch {
        if (cancelled) return;
      } finally {
        if (!cancelled) setLoadingRecent(false);
      }
    };

    fetchRecent();
    return () => { cancelled = true; };
  }, []);

  const fetchFavorites = async () => {
    const token = localStorage.getItem("access");
    if (!token) {
      navigate("/");
      alert("Bạn cần đăng nhập để xem trang này.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/restaurants/restaurants/favorites/?page=${page}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Không thể tải danh sách");

      setRestaurants(data.results || []);
      setTotalCount(data.count || 0);
      setTotalPages(data.total_pages || Math.ceil((data.count || 0) / 10)); 
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!loading && (
          <div className="mb-6">
            <p className="text-gray-600 font-medium">Bạn đã lưu <span className="text-amber-600 font-bold">{totalCount}</span> nhà hàng.</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-4" />
            <p className="text-gray-500 font-medium">Đang tải danh sách yêu thích...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 text-center">
            {error}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-2xl border border-gray-100 shadow-sm text-center px-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Chưa có nhà hàng yêu thích nào</h3>
            <p className="text-gray-500 max-w-sm mb-6">Bạn chưa thả tim nhà hàng nào. Hãy khám phá và lưu lại những địa điểm tuyệt vời nhé!</p>
            <Link 
              to="/explore"
              className="px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-orange-600 transition shadow-md shadow-amber-200"
            >
              Phát Hiện Ngay
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {restaurants.map((r) => (
              <RestaurantCard 
                key={r.id} 
                restaurant={{ ...r, is_favorite: true }}
                onBookTable={() => navigate(`/restaurant/${r.id}`)}
              />
            ))}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="mt-12 flex justify-center items-center gap-2">
            <button
              onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({top: 0}); }}
              disabled={page === 1}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-bold border border-red-100">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({top: 0}); }}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              <ArrowLeft className="w-5 h-5 rotate-180" />
            </button>
          </div>
        )}

        {/* ── Bạn đã xem gần đây ────────────────────────────── */}
        {showRecent && (
          <section className="mt-16">
            <div className="flex items-center gap-2 mb-5">
              <Clock className="w-5 h-5 text-gray-400" />
              <h2 className="text-xl font-bold text-gray-900">Bạn đã xem gần đây</h2>
            </div>

            {loadingRecent ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
              </div>
            ) : recentRestaurants.length === 0 ? (
              <p className="text-gray-400 text-sm">Chưa có dữ liệu.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {recentRestaurants.map((r) => (
                  <RestaurantCard
                    key={`recent-${r.id}`}
                    restaurant={r}
                    onBookTable={() => navigate(`/restaurant/${r.id}`)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
