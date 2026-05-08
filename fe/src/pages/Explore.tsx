import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Search, MapPin, Filter, X, Loader2, Star, Heart, Sparkles, Zap, ArrowRight, Navigation } from "lucide-react";
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
  const [city, setCity] = useState(searchParams.get("city") || localStorage.getItem("user_city") || "");
  const [district, setDistrict] = useState(searchParams.get("district") || localStorage.getItem("user_district") || "");
  const [cuisine, setCuisine] = useState(searchParams.get("cuisine") || "");
  const [minRating, setMinRating] = useState(searchParams.get("min_rating") || "");
  const [sortBy, setSortBy] = useState(searchParams.get("sort_by") || "rating_desc");
  const [collectionId, setCollectionId] = useState(searchParams.get("collection_id") || "");
  const [collectionName, setCollectionName] = useState(searchParams.get("collection_name") || "");
  const [priceRange, setPriceRange] = useState<string[]>(searchParams.get("price_range")?.split(",").filter(Boolean) || []);

  // Geographical Data
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);

  // Results State
  const [restaurants, setRestaurants] = useState<RestaurantCardDto[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]); // New state for Smart Search
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

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
    setPriceRange(searchParams.get("price_range")?.split(",").filter(Boolean) || []);
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
    searchParams.get("price_range"),
    searchParams.get("page")
  ]);

  const fetchResults = async () => {
    setLoading(true);
    setError("");
    setRecommendations([]);
    setRestaurants([]);

    try {
      const q = searchParams.get("query");
      const token = localStorage.getItem("access");
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // ── Nếu có query → Dùng Smart Search ────────────────────────────────────
      if (q) {
        const cityParam = searchParams.get("city") || "";
        const distParam = searchParams.get("district") || "";
        
        const smartUrl = new URL(`${API_BASE}/api/restaurants/restaurants/smart-search/`);
        smartUrl.searchParams.set("q", q);
        if (cityParam) smartUrl.searchParams.set("city", cityParam);
        if (distParam) smartUrl.searchParams.set("district", distParam);
        
        // Gửi kèm tọa độ nếu có
        const lat = searchParams.get("lat") || localStorage.getItem("user_lat");
        const lng = searchParams.get("lng") || localStorage.getItem("user_lng");
        if (lat) smartUrl.searchParams.set("lat", lat);
        if (lng) smartUrl.searchParams.set("lng", lng);

        smartUrl.searchParams.set("top_n", "5"); 

        const res = await fetch(smartUrl.toString(), { headers });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || "Lỗi tìm kiếm thông minh");

        setRecommendations(data.recommendations || []);
        setRestaurants(data.other_results || []);
        setTotalCount((data.recommendations?.length || 0) + (data.other_results?.length || 0));
        setTotalPages(1); // Smart search hiện tại không phân trang
      } 
      // ── Nếu không có query → Dùng bộ lọc chuẩn ──────────────────────────────
      else {
        const params = new URLSearchParams(searchParams.toString());
        const lat = localStorage.getItem("user_lat");
        const lng = localStorage.getItem("user_lng");
        if (lat && !params.has("lat")) params.set("lat", lat);
        if (lng && !params.has("lng")) params.set("lng", lng);

        const res = await fetch(`${API_BASE}/api/restaurants/restaurants/search/?${params.toString()}`, {
          headers
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || "Lỗi tải dữ liệu");

        setRestaurants(data.results || []);
        setTotalCount(data.count || 0);
        setTotalPages(data.total_pages || Math.ceil((data.count || 0) / 10));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNearMe = async () => {
    if (!navigator.geolocation) {
      alert("Trình duyệt không hỗ trợ định vị.");
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        localStorage.setItem("user_lat", latitude.toString());
        localStorage.setItem("user_lng", longitude.toString());
        
        try {
          // Tăng zoom lên 18 để lấy chi tiết ranh giới hành chính chính xác nhất
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'vi', 'User-Agent': 'RestaurantBookingApp/1.0' } }
          );
          const data = await response.json();
          
          const addr = data.address || {};
          let provinceName = addr.state || addr.province || addr.region || "";
          let districtName = addr.city || addr.town || addr.district || addr.city_district || addr.county || addr.suburb || "";

          // Normalize & Validation logic (dùng chung logic như Home)
          const normalize = (s: string) => s.toLowerCase().replace(/thành phố |tỉnh |quận |huyện |thị xã |phường |xã |thị trấn /g, '').trim();
          const checkProvince = (name: string) => provinces.find(p => normalize(p.name) === normalize(name));
          
          if (!checkProvince(provinceName)) {
            const p = checkProvince(districtName);
            if (p) {
              provinceName = p.name;
              districtName = addr.suburb || addr.quarter || addr.neighborhood || "";
            } else {
              const allDistricts = provinces.flatMap(p => {
                const ds = typeof (vn as any).getDistricts === "function" ? (vn as any).getDistricts(p.code) : [];
                return ds.map((d: any) => ({ ...d, provinceName: p.name }));
              });
              const foundD = allDistricts.find(d => normalize(d.name) === normalize(provinceName) || normalize(d.name) === normalize(districtName));
              if (foundD) {
                provinceName = foundD.provinceName;
                districtName = foundD.name;
              }
            }
          }

          // Chỉ cập nhật Sắp xếp và tọa độ, KHÔNG đè lên bộ lọc City/District đã chọn
          setSortBy('near_me');
          
          // Sync URL
          const params = new URLSearchParams(searchParams.toString());
          params.set("sort_by", "near_me");
          params.set("lat", latitude.toString());
          params.set("lng", longitude.toString());
          // Giữ nguyên city/district hiện tại trong URL, không tự động ghi đè
          setSearchParams(params);

          // Sync to Server if logged in (Vẫn gửi địa chỉ để lưu vết nhưng không ép lên UI)
          const token = localStorage.getItem('access');
          if (token) {
            fetch(`${API_BASE}/api/accounts/update-location/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                latitude,
                longitude,
                city: provinceName,
                district: districtName
              })
            }).catch(err => console.error("Lỗi đồng bộ vị trí:", err));
          }
        } catch (error) {
          console.error("Location detection error:", error);
        } finally {
          setDetectingLocation(false);
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        setDetectingLocation(false);
        alert("Không thể lấy vị trí. Vui lòng kiểm tra quyền truy cập vị trí của trình duyệt.");
      }
    );
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
    if (priceRange.length > 0) params.set("price_range", priceRange.join(","));
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
    setPriceRange([]);
    setSearchParams({});
    setFilterDrawerOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 relative pb-12">
      {/* Top Header navbar simplified */}
      <Header />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        
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

              {/* Price Range */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Khoảng Giá / Người</label>
                <div className="space-y-2">
                  {[
                    { id: 'BUDGET', label: 'Bình dân', range: 'Dưới 100k', icon: '💰' },
                    { id: 'MEDIUM', label: 'Trung cấp', range: '100k - 300k', icon: '💰💰' },
                    { id: 'PREMIUM', label: 'Cao cấp', range: 'Trên 300k', icon: '💰💰💰' },
                  ].map((p) => (
                    <label key={p.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={priceRange.includes(p.id)}
                          onChange={() => {
                            setPriceRange(prev => 
                              prev.includes(p.id) ? prev.filter(item => item !== p.id) : [...prev, p.id]
                            );
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-700 group-hover:text-amber-700 transition-colors">{p.label}</p>
                          <p className="text-[10px] text-gray-400">{p.range}</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-amber-500/50 font-bold">{p.icon}</span>
                    </label>
                  ))}
                </div>
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
          {/* ── Desktop Smart Search Bar ──────────────────────────────────── */}
          <div className="mb-8">
            <form onSubmit={applyFilters} className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Bạn muốn ăn gì hôm nay? (Ví dụ: lẩu thái ngon rẻ ở Quận 1)"
                className="block w-full pl-12 pr-44 py-4 bg-white border border-gray-200 rounded-2xl leading-5 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-gray-900 shadow-sm"
              />
              <div className="absolute inset-y-2 right-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleNearMe}
                  disabled={detectingLocation}
                  className="p-2.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                  title="Tìm quán gần tôi"
                >
                  {detectingLocation ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Navigation className="w-5 h-5" />
                  )}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-bold rounded-xl text-white bg-amber-600 hover:bg-orange-600 focus:outline-none transition-all shadow-md shadow-amber-200"
                >
                  Tìm Kiếm
                </button>
              </div>
            </form>
          </div>

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
              {collectionName ? collectionName : query ? `Kết Quả Cho "${query}"` : 'Khám Phá Nhà Hàng'}
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
          ) : restaurants.length === 0 && recommendations.length === 0 ? (
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
            <div className="space-y-12">
              {/* ── Section 1: Recommendations ────────────────────────────────── */}
              {recommendations.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Sparkles className="w-5 h-5 text-amber-600 fill-amber-200" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Phù hợp nhất với bạn</h2>
                      <p className="text-sm text-gray-500">Dựa trên sở thích và lịch sử đặt bàn của bạn</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {recommendations.map((restaurant) => (
                      <div key={restaurant.id} className="relative group flex flex-col h-full">
                        {/* Reason Badge */}
                        <div className="absolute -top-3 left-4 z-20 bg-gradient-to-r from-amber-600 to-orange-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 border-2 border-white">
                          <Zap className="w-3 h-3 fill-current" />
                          {restaurant.reason || "Lựa chọn hàng đầu"}
                        </div>
                        
                        <div className="flex-1 bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-amber-100/50 group-hover:-translate-y-1">
                          <RestaurantCard 
                            restaurant={restaurant}
                            layout="grid"
                            onBookTable={(r) => navigate(`/restaurant/${r.id}`)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Section 2: Other Results ───────────────────────────────────── */}
              {restaurants.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-6 pt-4 border-t border-gray-100">
                    {recommendations.length > 0 && (
                      <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        Các kết quả liên quan khác
                      </h2>
                    )}
                    {searchParams.get("query") && (
                      <span className="text-xs text-gray-400 italic">Tìm kiếm theo từ khóa: "{searchParams.get("query")}"</span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {restaurants.map((restaurant) => (
                      <div key={restaurant.id} className="opacity-90 hover:opacity-100 transition-opacity">
                        <RestaurantCard 
                          restaurant={restaurant}
                          layout="grid"
                          onBookTable={(r) => navigate(`/restaurant/${r.id}`)}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
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
