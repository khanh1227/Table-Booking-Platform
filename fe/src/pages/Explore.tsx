import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Search, MapPin, Filter, X, Loader2, Star, Heart } from "lucide-react";
import RestaurantCard, { type RestaurantCardDto } from "@/components/restaurant/RestaurantCard";
import * as vn from "vietnam-provinces";
import Header from "@/components/common/Header";
import Footer from "@/components/common/Footer";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Filter States
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [district, setDistrict] = useState(searchParams.get("district") || "");
  const [cuisine, setCuisine] = useState(searchParams.get("cuisine") || "");
  const [minRating, setMinRating] = useState(searchParams.get("min_rating") || "");
  const [sortBy, setSortBy] = useState(searchParams.get("sort_by") || "rating_desc");
  const [collectionId, setCollectionId] = useState(searchParams.get("collection_id") || "");
  const [collectionName, setCollectionName] = useState(searchParams.get("collection_name") || "");

  // Geographical Data
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);

  // Results State
  const [restaurants, setRestaurants] = useState<RestaurantCardDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Load locations on mount
  useEffect(() => {
    setProvinces(vn.getProvinces());
  }, []);

  // Update districts when city changes
  useEffect(() => {
    if (city) {
      const p = provinces.find((p) => p.name === city);
      const dList = typeof (vn as any).getDistricts === "function" && p 
        ? ((vn as any).getDistricts(p.code) as any[]) 
        : [];
      setDistricts(Array.isArray(dList) ? dList : []);
    } else {
      setDistricts([]);
      setDistrict("");
    }
  }, [city, provinces]);

  // Sync state from URL
  useEffect(() => {
    setQuery(searchParams.get("query") || "");
    setCity(searchParams.get("city") || "");
    setDistrict(searchParams.get("district") || "");
    setCuisine(searchParams.get("cuisine") || "");
    setMinRating(searchParams.get("min_rating") || "");
    setSortBy(searchParams.get("sort_by") || "rating_desc");
    setCollectionId(searchParams.get("collection_id") || "");
    setCollectionName(searchParams.get("collection_name") || "");
    setPage(Number(searchParams.get("page")) || 1);
  }, [searchParams]);

  // Fetch results when URL params change
  useEffect(() => {
    fetchResults();
  }, [
    searchParams.get("query"),
    searchParams.get("city"),
    searchParams.get("district"),
    searchParams.get("cuisine"),
    searchParams.get("min_rating"),
    searchParams.get("sort_by"),
    searchParams.get("collection_id"),
    searchParams.get("page")
  ]);

  const fetchResults = async () => {
    setLoading(true);
    setError("");

    try {
      // Build query string from searchParams
      const qs = searchParams.toString();
      const token = localStorage.getItem("access"); // Send token if available to get favorites
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/restaurants/restaurants/search/?${qs}`, {
        headers
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Lỗi tải dữ liệu");

      // Pagination fields
      setRestaurants(data.results || []);
      setTotalCount(data.count || 0);
      setTotalPages(data.total_pages || Math.ceil((data.count || 0) / 10)); // Default assumed size
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (city) params.set("city", city);
    if (district) params.set("district", district);
    if (cuisine) params.set("cuisine", cuisine);
    if (minRating) params.set("min_rating", minRating);
    if (sortBy) params.set("sort_by", sortBy);
    if (collectionId) params.set("collection_id", collectionId);
    if (collectionName) params.set("collection_name", collectionName);
    params.set("page", "1"); // Reset page on filter change
    
    setSearchParams(params);
    setFilterDrawerOpen(false);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage.toString());
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setQuery("");
    setCity("");
    setDistrict("");
    setCuisine("");
    setMinRating("");
    setSortBy("rating_desc");
    setCollectionId("");
    setCollectionName("");
    setSearchParams({});
    setFilterDrawerOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 relative pb-12">
      {/* Top Header navbar simplified */}
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Filters (Desktop) & Drawer (Mobile) */}
        <aside className={`md:w-72 shrink-0 ${filterDrawerOpen ? 'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:static md:bg-transparent' : 'hidden md:block'}`}>
          <div className={`fixed inset-y-0 left-0 w-80 bg-white p-6 shadow-2xl transform transition-transform duration-300 overflow-y-auto md:static md:w-full md:p-0 md:bg-transparent md:shadow-none md:translate-x-0 ${filterDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex justify-between items-center mb-6 md:hidden">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Filter className="w-5 h-5 text-amber-600" /> Bộ Lọc
              </h2>
              <button onClick={() => setFilterDrawerOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={applyFilters} className="space-y-6">
              {/* Mobile Search Input */}
              <div className="md:hidden">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Từ khóa</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Tên nhà hàng, món ăn"
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Sắp xếp */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sắp Xếp</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 bg-white text-gray-700"
                >
                  <option value="rating_desc">Đánh giá cao nhất</option>
                  <option value="newest">Mới nhất</option>
                  <option value="rating_asc">Đánh giá thấp nhất</option>
                </select>
              </div>

              <div className="h-px bg-gray-200 my-4" />

              {/* Location */}
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  Khu Vực
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 bg-white text-gray-700"
                >
                  <option value="">Tất cả Thành phố</option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.name}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  disabled={!city}
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 bg-white text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">Tất cả Quận/Huyện</option>
                  {districts.map((d) => (
                    <option key={d.code} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="h-px bg-gray-200 my-4" />

              {/* Cuisine */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Loại Hình Ẩm Thực</label>
                <select
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 bg-white text-gray-700"
                >
                  <option value="">Tất cả</option>
                  <option value="Món Việt">Món Việt</option>
                  <option value="Hải Sản">Hải Sản</option>
                  <option value="BBQ">BBQ - Lẩu Nướng</option>
                  <option value="Nhật Bản">Nhật Bản</option>
                  <option value="Hàn Quốc">Hàn Quốc</option>
                  <option value="Món Âu">Món Âu</option>
                  <option value="Buffet">Buffet</option>
                  <option value="Chay">Đồ Chay</option>
                </select>
              </div>

              <div className="h-px bg-gray-200 my-4" />

              {/* Min Rating */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Đánh giá tối thiểu</label>
                <div className="flex gap-2">
                  {[3, 4, 4.5].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setMinRating(rate.toString())}
                      className={`flex-1 py-2 px-1 rounded-lg border text-sm font-medium transition flex justify-center items-center gap-1 ${
                        minRating === rate.toString() 
                        ? 'bg-amber-50 border-amber-500 text-amber-700' 
                        : 'bg-white border-gray-200 text-gray-600 hover:border-amber-300'
                      }`}
                    >
                      {rate}+ <Star className="w-3 h-3 fill-current text-amber-500" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
                >
                  Xoá Lọc
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 bg-amber-600 text-white rounded-xl font-medium hover:bg-orange-600 shadow-md shadow-amber-200 transition"
                >
                  Áp Dụng
                </button>
              </div>
            </form>
          </div>
        </aside>

        {/* Results Body */}
        <main className="flex-1">
          {collectionName && (
            <div className="mb-6 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-amber-100 font-semibold mb-1 flex items-center gap-2"><span className="w-8 h-[2px] bg-amber-200 block"></span>Khám phá bộ sưu tập</p>
                <h1 className="text-3xl font-black">{collectionName}</h1>
              </div>
              <Heart className="absolute right-6 top-1/2 -translate-y-1/2 w-24 h-24 text-white opacity-20" />
            </div>
          )}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              {collectionName ? 'Nhà Hàng Trong Bộ Sưu Tập' : 'Kết Quả Khám Phá'}
            </h1>
            {!loading && (
              <span className="text-gray-500 text-sm font-medium">
                Tìm thấy {totalCount} nhà hàng
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
              <p className="text-gray-500 font-medium animate-pulse">Đang tìm kiếm...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 text-center">
              Tải dữ liệu thất bại: {error}
            </div>
          ) : restaurants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm text-center px-4">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Không tìm thấy kết quả</h3>
              <p className="text-gray-500 max-w-sm">Rất tiếc, không có nhà hàng nào khớp với điều kiện lọc của bạn. Thử xoá bớt bộ lọc nhé!</p>
              <button 
                onClick={clearFilters}
                className="mt-6 text-amber-600 font-semibold hover:text-amber-700 transition"
              >
                Xoá tất cả bộ lọc
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {restaurants.map((restaurant) => (
                <div key={restaurant.id} className="relative group">
                  <RestaurantCard 
                    restaurant={restaurant}
                    layout="grid"
                    onBookTable={(r) => navigate(`/restaurant/${r.id}`)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="mt-12 flex justify-center items-center gap-2">
              <button
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-5 h-5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              
              <span className="px-4 py-2 bg-amber-50 text-amber-700 rounded-lg font-bold border border-amber-100">
                {page} / {totalPages}
              </span>

              <button
                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          )}
        </main>
      </div>
      <Footer />
    </div>
  );
}
