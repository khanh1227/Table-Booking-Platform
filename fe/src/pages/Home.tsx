import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  MapPin,
  Navigation,
  Loader2,
  Clock,
  User,
  Ticket,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { fetchCollections } from '@/lib/api';
import type { Collection } from '@/lib/api';
import {
  getPriceRangeSymbol,
} from "@/lib/restaurantDisplay";
import { handleImageError } from "@/lib/imageUtils";
import BookingForm from "@/components/bookings/BookingForm";
import * as vn from "vietnam-provinces";
import type { Province, District, Ward } from "vietnam-provinces";


import Header from "@/components/common/Header";
import Footer from "@/components/common/Footer";
import SearchAutocomplete from "@/components/common/SearchAutocomplete";
import type { AutocompleteItem } from "@/lib/fuzzySearch";
import RestaurantCard from "@/components/restaurant/RestaurantCard";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

const ITEMS_PER_PAGE = 12;
const FILTER_FETCH_DEBOUNCE_MS = 250;

const CUISINE_TYPES = [
  { name: "Buffet", emoji: "🍱" },
  { name: "Lẩu", emoji: "🍲" },
  { name: "Nướng", emoji: "🔥" },
  { name: "Hải sản", emoji: "🦐" },
  { name: "Quán nhậu", emoji: "🍺" },
  { name: "Món Nhật", emoji: "🍣" },
  { name: "Món Việt", emoji: "🍜" },
  { name: "Món Hàn", emoji: "🥢" },
] as const;

// Skeleton components defined outside to avoid React unmount/remount on each render
const RestaurantSkeleton = () => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-pulse">
    <div className="h-48 bg-gray-200"></div>
    <div className="p-4 space-y-3">
      <div className="h-5 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="flex justify-between items-center pt-2">
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
      </div>
    </div>
  </div>
);



// Component input riêng để chống lag: gõ phím không làm re-render toàn bộ trang Home
const DebouncedSearchInput = ({
  initialValue,
  onSearch,
  onAutocompleteSelect
}: {
  initialValue: string,
  onSearch: (val: string) => void,
  onAutocompleteSelect?: (item: AutocompleteItem) => void
}) => {
  const [local, setLocal] = useState(initialValue);
  const [autocompleteVisible, setAutocompleteVisible] = useState(false);

  useEffect(() => {
    setLocal(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(local);
    }, 500);
    return () => clearTimeout(timer);
  }, [local, onSearch]);

  return (
    <div className="relative flex-1">
      <input
        type="text"
        placeholder="Tìm nhà hàng, món ăn,..."
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          setAutocompleteVisible(true);
        }}
        onFocus={() => setAutocompleteVisible(true)}
        className="w-full py-2.5 text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400"
      />
      <SearchAutocomplete
        query={local}
        visible={autocompleteVisible}
        onClose={() => setAutocompleteVisible(false)}
        onSelect={(item) => {
          setAutocompleteVisible(false);
          setLocal(item.name);
          onSearch(item.name);
          if (onAutocompleteSelect) {
            onAutocompleteSelect(item);
          }
        }}
      />
    </div>
  );
};

type Restaurant = {
  id: number;
  name: string;
  address: string;
  description?: string;
  rating: number;
  status: string;
  location?: {
    id: number;
    city: string;
    district?: string;
    ward?: string;
  };
  thumbnail?: string;
  images?: { id: number; image_url: string; display_order: number }[];
  cuisine_type?: string;
  price_range?: string;
  opening_hours?: string;
};

export default function Home() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
  const [selectedProvinceName, setSelectedProvinceName] = useState("");
  const [selectedDistrictCode, setSelectedDistrictCode] = useState("");
  const [selectedDistrictName, setSelectedDistrictName] = useState("");

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [selectedPriceRange, setSelectedPriceRange] = useState<string[]>([]);
  const [selectedHighRating, setSelectedHighRating] = useState(false);
  const [selectedSortBy, setSelectedSortBy] = useState('rating_desc');
  const [showPriceFilter, setShowPriceFilter] = useState(false);
  const priceFilterRef = useRef<HTMLDivElement>(null);
  const [showSortFilter, setShowSortFilter] = useState(false);
  const sortFilterRef = useRef<HTMLDivElement>(null);

  const [topRatedRestaurants, setTopRatedRestaurants] = useState<Restaurant[]>([]);
  const [loadingTopRated, setLoadingTopRated] = useState(true);



  const abortRef = useRef<AbortController | null>(null);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCuisine, setSelectedCuisine] = useState("");
  const [collectionsLoading, setCollectionsLoading] = useState(true);

  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  const restaurantListRef = useRef<HTMLDivElement>(null);
  const collectionScrollRef = useRef<HTMLDivElement>(null);
  const cuisineScrollRef = useRef<HTMLDivElement>(null);
  const [hasVisited, setHasVisited] = useState(false); // For hero banner visibility

  const scrollCollections = (dir: "left" | "right") => {
    if (collectionScrollRef.current) {
      collectionScrollRef.current.scrollBy({ left: dir === "right" ? 560 : -560, behavior: "smooth" });
    }
  };

  const scrollCuisine = (dir: "left" | "right") => {
    if (cuisineScrollRef.current) {
      cuisineScrollRef.current.scrollBy({ left: dir === "right" ? 240 : -240, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const access = localStorage.getItem("access");
    setIsLoggedIn(!!access);

    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch {
        setCurrentUser(null);
      }
    }

    try {
      const data = (vn as any).getProvinces?.() as Province[];
      if (Array.isArray(data)) {
        const sorted = [...data].sort((a, b) =>
          String((a as any).name).localeCompare(String((b as any).name), "vi")
        );
        setProvinces(sorted);
      }
    } catch (err) {
      console.error("Lỗi tải tỉnh/thành:", err);
    }

    // Restoring location and sorting from localStorage
    const savedLat = localStorage.getItem("user_lat");
    const savedLng = localStorage.getItem("user_lng");
    const savedCity = localStorage.getItem("user_city");
    const savedDist = localStorage.getItem("user_district");

    if (savedLat && savedLng) {
      setUserCoords({ lat: parseFloat(savedLat), lng: parseFloat(savedLng) });
      // Nếu có tọa độ, ta có thể tự động bật near_me hoặc giữ nguyên rating_desc
      // Tạm thời chỉ khôi phục tọa độ để các API sau đó có dữ liệu lat/lng
    }

    if (savedCity) setSelectedProvinceName(savedCity);
    if (savedDist) setSelectedDistrictName(savedDist);

    // Check if user has visited before for hero banner
    const visited = localStorage.getItem("hasVisited");
    setHasVisited(!!visited);
  }, []);

  // Close filter dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (priceFilterRef.current && !priceFilterRef.current.contains(e.target as Node)) {
        setShowPriceFilter(false);
      }
      if (sortFilterRef.current && !sortFilterRef.current.contains(e.target as Node)) {
        setShowSortFilter(false);
      }
    };

    if (showPriceFilter || showSortFilter) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPriceFilter, showSortFilter]);

  const fetchRestaurants = async (overrides?: {
    query?: string; city?: string; district?: string; ward?: string;
    cityCode?: string; districtCode?: string; wardCode?: string;
    cuisine?: string; page?: number;
    priceRange?: string[];
    highRating?: boolean;
    sortBy?: string;
    lat?: number;
    lng?: number;
  }) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      const q = overrides?.query ?? searchQuery;
      const city = overrides?.city ?? selectedProvinceName;
      const district = overrides?.district ?? selectedDistrictName;
      const cityCode = overrides?.cityCode ?? selectedProvinceCode;
      const districtCode = overrides?.districtCode ?? selectedDistrictCode;
      const cuisine = overrides?.cuisine ?? selectedCuisine;
      const p = overrides?.page ?? page;
      const pr = overrides?.priceRange ?? selectedPriceRange;
      const hr = overrides?.highRating ?? selectedHighRating;
      const sb = overrides?.sortBy ?? selectedSortBy;
      const lat = overrides?.lat ?? userCoords?.lat;
      const lng = overrides?.lng ?? userCoords?.lng;

      if (q) params.append("query", q);
      if (city) params.append("city", city);
      if (district) params.append("district", district);
      if (cityCode) params.append("city_code", cityCode);
      if (districtCode) params.append("district_code", districtCode);
      if (cuisine) params.append("cuisine", cuisine);
      if (pr.length) params.append("price_range", pr.join(','));
      if (hr) params.append("high_rating", "true");
      if (sb) params.append("sort_by", sb);
      if (lat) params.append("lat", lat.toString());
      if (lng) params.append("lng", lng.toString());
      params.append("page", p.toString());
      params.append("page_size", ITEMS_PER_PAGE.toString());

      const url = `${API_BASE}/api/restaurants/restaurants/search/?${params.toString()}`;
      const res = await fetch(url, { signal: abortRef.current.signal });
      if (res.ok) {
        const data = await res.json();
        const results = data.results || data;
        if (data.count !== undefined) setTotalCount(data.count);
        setRestaurants(Array.isArray(results) ? results : []);
      } else {
        setError("Không thể tải danh sách nhà hàng");
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError("Lỗi kết nối server");
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscoveryData = async () => {
    setCollectionsLoading(true);
    try {
      // banners chưa dùng trong UI, bỏ qua để tránh fetch thừa
      // const bannerData = await fetchBanners();
      // setBanners(bannerData);

      const collectionData = await fetchCollections();
      setCollections(collectionData);
    } catch (err) {
      console.error("Lỗi tải discovery data:", err);
    } finally {
      setCollectionsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscoveryData();

    // Fetch Top Rated
    const fetchTopRated = async () => {
      setLoadingTopRated(true);
      try {
        const res = await fetch(`${API_BASE}/api/restaurants/restaurants/top-rated/?limit=4`);
        if (res.ok) {
          const data = await res.json();
          setTopRatedRestaurants(data);
        }
      } catch (err) {
        console.error("Lỗi tải top rated:", err);
      } finally {
        setLoadingTopRated(false);
      }
    };
    fetchTopRated();
  }, []);





  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRestaurants({ cuisine: selectedCuisine, page });
      if (page > 1 && restaurantListRef.current) {
        restaurantListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, FILTER_FETCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [selectedCuisine, page, selectedPriceRange, selectedHighRating, selectedSortBy,
    selectedProvinceName, selectedDistrictName,
    selectedProvinceCode, selectedDistrictCode,
    searchQuery, userCoords]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?query=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      setPage(1);
    }
  }, [searchQuery, navigate]);

  // Toggle price range filter (multi-select)
  const togglePriceRange = useCallback((val: string) => {
    setSelectedPriceRange(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
    setPage(1);
  }, []);

  // Toggle high rating filter
  const toggleHighRating = useCallback(() => {
    setSelectedHighRating(p => !p);
    setPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedPriceRange([]);
    setSelectedHighRating(false);
    setSelectedSortBy('rating_desc');
    setSelectedCuisine("");
    setSelectedProvinceCode("");
    setSelectedProvinceName("");
    setSelectedDistrictCode("");
    setSelectedDistrictName("");
    setDistricts([]);
    setSearchQuery("");
    setPage(1);
  }, []);

  // Count active filters (bao gồm cả cuisine để đồng bộ UI)
  const activeFilterCount =
    (selectedCuisine ? 1 : 0) +
    selectedPriceRange.length +
    (selectedHighRating ? 1 : 0) +
    (selectedSortBy !== 'rating_desc' ? 1 : 0);

  const handleProvinceChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const provinceCode = e.target.value;

    setSelectedProvinceCode(provinceCode);
    setSelectedDistrictCode("");
    setSelectedDistrictName("");
    setPage(1);

    const p = provinces.find((x) => String((x as any).code) === String(provinceCode));
    setSelectedProvinceName(p ? String((p as any).name) : "");

    const dList =
      typeof (vn as any).getDistricts === "function"
        ? ((vn as any).getDistricts(provinceCode) as District[])
        : [];
    setDistricts(Array.isArray(dList) ? dList : []);
  }, [provinces]);

  const handleDistrictChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const districtCode = e.target.value;

    setSelectedDistrictCode(districtCode);
    setPage(1);

    const d = districts.find((x) => String((x as any).code) === String(districtCode));
    setSelectedDistrictName(d ? String((d as any).name) : "");

    restaurantListRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [districts]);

  const handleBookTable = useCallback((restaurant: Restaurant) => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }
    setSelectedRestaurant(restaurant);
    setBookingFormOpen(true);
  }, [isLoggedIn, navigate]);

  const [detectingLocation, setDetectingLocation] = useState(false);

  const handleNearMe = async () => {
    if (!navigator.geolocation) {
      handleIPLocation(); // Fallback ngay nếu trình duyệt không hỗ trợ
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log(`🎯 GPS Detected: lat=${latitude}, lng=${longitude}`);
        setUserCoords({ lat: latitude, lng: longitude });
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
            { headers: { 'Accept-Language': 'vi', 'User-Agent': 'RestaurantBookingApp/1.0' } }
          );
          const data = await response.json();
          console.log("📍 FULL Nominatim response:", data);
          console.log("📍 Nominatim address object:", data.address);

          let provinceName = data.address.state || data.address.province || "";
          let districtName = data.address.city || data.address.town || data.address.district || data.address.suburb || "";

          console.log(`📝 Step 1 - Raw parse: provinceName="${provinceName}", districtName="${districtName}"`);
          console.log(`📝 Available provinces in system:`, provinces.map(p => p.name).slice(0, 10));

          // Nếu bóc tách cơ bản bị thiếu Tỉnh hoặc nhầm Quận vào Tỉnh
          const normalize = (s: string) => s.toLowerCase().replace(/thành phố |tỉnh |quận |huyện |thị xã |phường |xã |thị trấn /g, '').trim();

          // Kiểm tra xem districtName thực chất có phải là Tỉnh không
          const checkProvince = (name: string) => {
            const result = provinces.find(p => normalize(p.name) === normalize(name));
            console.log(`   checkProvince("${name}"): normalized="${normalize(name)}" => found="${result?.name || "NO"}"`);
            return result;
          };

          console.log(`📝 Step 2 - Checking if provinceName is valid...`);
          if (!checkProvince(provinceName)) {
            console.log(`   ❌ provinceName="${provinceName}" NOT found in provinces list`);
            // Nếu provinceName không phải là tỉnh, nhưng districtName lại là tỉnh
            const p = checkProvince(districtName);
            if (p) {
              console.log(`   ✅ But districtName="${districtName}" IS a province! Swapping...`);
              provinceName = p.name;
              districtName = data.address.suburb || data.address.quarter || "";
            } else {
              console.log(`   ❌ districtName also not found. Searching all districts...`);
              // Nếu cả 2 đều không phải tỉnh, thử tìm xem cái nào là Quận để suy ra Tỉnh
              const allDistricts = provinces.flatMap(p => {
                const ds = typeof (vn as any).getDistricts === "function" ? (vn as any).getDistricts(p.code) : [];
                return ds.map((d: any) => ({ ...d, provinceName: p.name }));
              });

              const foundD = allDistricts.find(d => {
                const match1 = normalize(d.name) === normalize(provinceName);
                const match2 = normalize(d.name) === normalize(districtName);
                if (match1 || match2) {
                  console.log(`   ✅ Found district: ${d.name} in ${d.provinceName} (matched: ${match1 ? 'provinceName' : 'districtName'})`);
                }
                return match1 || match2;
              });
              if (foundD) {
                console.log(`   ✅ Resolved: ${foundD.provinceName} / ${foundD.name}`);
                provinceName = foundD.provinceName;
                districtName = foundD.name;
              } else {
                console.log(`   ⚠️ No matching district found! provinceName="${provinceName}" districtName="${districtName}"`);
              }
            }
          } else {
            console.log(`   ✅ provinceName="${provinceName}" is valid!`);
          }

          console.log(`✅ Final Result: Tỉnh="${provinceName}", Quận="${districtName}"`);

          // Không tự động điền bộ lọc nữa, chỉ dùng tọa độ để sắp xếp Near Me
          setSelectedSortBy('near_me');

          // Đồng bộ lên Database nếu đã đăng nhập (vẫn lưu để cá nhân hóa nhưng không lọc cứng UI)
          const token = localStorage.getItem('access');
          if (token) {
            console.log("Đang đồng bộ vị trí lên Server...");
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
            })
              .then(res => {
                if (!res.ok) throw new Error(`Server error: ${res.status}`);
                return res.json();
              })
              .then(data => console.log("Đồng bộ vị trí thành công:", data))
              .catch(err => console.error("Lỗi đồng bộ vị trí:", err));
          } else {
            console.warn("Chưa đăng nhập, không thể đồng bộ vị trí lên Server.");
          }
        } catch (error) {
          console.error("Nominatim Error:", error);
          handleIPLocation();
        } finally {
          setDetectingLocation(false);
        }
      },
      () => {
        console.log("GPS failed, switching to Backend IP location...");
        handleIPLocation();
      },
      { timeout: 5000 }
    );
  };

  const handleIPLocation = async () => {
    setDetectingLocation(true);
    try {
      // Gọi qua Backend của chính bạn để không bị Adblock chặn
      const response = await fetch(`${API_BASE}/api/restaurants/restaurants/detect-location/`);
      const data = await response.json();

      if (data.status === 'success') {
        setSelectedSortBy('near_me');
      } else {
        alert("Không thể xác định vị trí. Vui lòng chọn thủ công.");
      }
    } catch (err) {
      console.error("IP Location Error:", err);
      alert("Lỗi kết nối định vị. Vui lòng chọn thủ công.");
    } finally {
      setDetectingLocation(false);
    }
  };

  const applyLocation = (cityName: string) => {
    console.log(`🎯 applyLocation() called with: "${cityName}"`);
    const normalize = (s: string) => s.toLowerCase().replace(/thành phố |tỉnh |quận |huyện |thị xã |phường |xã |thị trấn /g, '').trim();
    const normalizedInput = normalize(cityName);

    console.log(`📝 Normalized input: "${normalizedInput}"`);
    console.log(`📝 Total provinces available: ${provinces.length}`);

    // 1. Thử tìm trong danh sách Tỉnh/Thành phố
    const matchedP = provinces.find(p => {
      const pNorm = normalize(p.name);
      const match = pNorm.includes(normalizedInput) || normalizedInput.includes(pNorm);
      if (match) {
        console.log(`   ✅ Matched province: "${p.name}" (normalized: "${pNorm}")`);
      }
      return match;
    });

    if (matchedP) {
      console.log(`✅ RESULT 1 - Found Province: "${matchedP.name}"`);
      const pCode = String(matchedP.code);
      setSelectedProvinceCode(pCode);
      setSelectedProvinceName(matchedP.name);

      const dList = typeof (vn as any).getDistricts === "function" ? (vn as any).getDistricts(pCode) : [];
      console.log(`   Setting ${dList.length} districts for this province`);
      setDistricts(dList);
      setPage(1);
      return;
    }

    // 2. Nếu không phải Tỉnh, thử tìm trong toàn bộ Quận/Huyện của cả nước
    console.log(`❌ Not found as province. Searching in all districts...`);
    for (const p of provinces) {
      const dList = (vn as any).getDistricts(p.code) || [];
      const matchedD = dList.find((d: any) => {
        const dNorm = normalize(d.name);
        const match = dNorm.includes(normalizedInput) || normalizedInput.includes(dNorm);
        if (match) {
          console.log(`   ✅ Matched district: "${d.name}" in "${p.name}" (normalized: "${dNorm}")`);
        }
        return match;
      });

      if (matchedD) {
        console.log(`✅ RESULT 2 - Found District: "${matchedD.name}" in Province: "${p.name}"`);
        // Tìm thấy Quận/Huyện! Tự động set cả Tỉnh và Quận
        setSelectedProvinceCode(String(p.code));
        setSelectedProvinceName(p.name);
        setDistricts(dList);
        setSelectedDistrictCode(String(matchedD.code));
        setSelectedDistrictName(matchedD.name);

        setPage(1);
        restaurantListRef.current?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }

    console.error(`❌ NOT FOUND: "${cityName}" (normalized: "${normalizedInput}"). Available provinces: ${provinces.map(p => p.name).join(', ')}`);
    alert(`Vị trí xác định: ${cityName}. Rất tiếc hiện chưa có dữ liệu lọc cho khu vực này.`);
  };

  // ✅ Memoize option lists — tránh String() conversion mỗi render
  const provinceOptions = useMemo(
    () => provinces.map((p: any) => (
      <option key={String(p.code)} value={String(p.code)}>{String(p.name)}</option>
    )),
    [provinces]
  );
  const districtOptions = useMemo(
    () => districts.map((d: any) => (
      <option key={String(d.code)} value={String(d.code)}>{String(d.name)}</option>
    )),
    [districts]
  );

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-[#f5f0e8]">

      {/* ── TOP NAV ── */}
      <Header />

      {/* ── HERO BANNER — ẩn sau lần đầu dùng ── */}
      {!hasVisited && (
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-4 border-b border-red-800">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-1">🍽️ Đặt bàn dễ, ăn ngon hơn</h3>
              <p className="text-sm text-red-100 mb-3">500+ nhà hàng • 10.000+ lượt đặt thành công • Cam kết giá tốt</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  restaurantListRef.current?.scrollIntoView({ behavior: 'smooth' });
                  localStorage.setItem("hasVisited", "true");
                  setHasVisited(true);
                }}
                className="bg-white text-red-600 font-semibold px-4 py-2 rounded-lg hover:bg-red-50 transition-colors text-sm"
              >
                Khám phá →
              </button>
              <button
                onClick={() => {
                  localStorage.setItem("hasVisited", "true");
                  setHasVisited(true);
                }}
                className="text-white hover:text-red-100 text-xl transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SEARCH + FILTER — KHÔNG sticky, cuộn đi khi lướt ── */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-4 py-3 space-y-2">

          {/* Unified search bar */}
          <form onSubmit={handleSearch}
            className="flex items-center border border-gray-200 rounded-2xl overflow-visible shadow-sm hover:shadow-md transition-shadow bg-white"
          >
            {/* City selector */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-r border-gray-200 min-w-[170px] bg-white shrink-0">
              <MapPin className="w-4 h-4 text-red-500 shrink-0" />
              <select
                value={selectedProvinceCode}
                onChange={handleProvinceChange}
                className="text-sm text-gray-700 font-medium outline-none appearance-none bg-transparent cursor-pointer w-full"
              >
                <option value="">Thành phố</option>
                {provinceOptions}
              </select>
              <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>

            {/* Search input - dùng component chống lag */}
            <div className="flex items-center flex-1 px-4 gap-2 relative">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <DebouncedSearchInput
                initialValue={searchQuery}
                onSearch={useCallback((val: string) => {
                  if (val !== searchQuery) {
                    setSearchQuery(val);
                    setPage(1);
                  }
                }, [searchQuery])}
                onAutocompleteSelect={(item) => {
                  // Option: Directly navigate to restaurant if it's explicitly selected from dropdown
                  if (item.restaurant_id) {
                    navigate(`/restaurant/${item.restaurant_id}`);
                  }
                }}
              />
            </div>

            {/* Search button */}
            <button
              type="submit"
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-6 py-2.5 font-semibold text-sm transition-colors shrink-0"
            >
              Tìm kiếm
            </button>
          </form>

          {/* Filter pills row */}
          <div className="flex items-center gap-2 flex-wrap pb-0.5">
            {/* Near Me Button */}
            <button
              type="button"
              onClick={handleNearMe}
              disabled={detectingLocation}
              className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs font-bold transition-all shadow-sm ${detectingLocation
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-200 hover:border-red-400 hover:text-red-600 hover:bg-red-50/50 active:scale-95'
                }`}
            >
              {detectingLocation ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5" />
              )}
              {detectingLocation ? 'Đang định vị...' : 'Gần đây'}
            </button>

            {/* District */}
            <div className="flex items-center gap-1 border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-600 hover:border-red-400 hover:bg-red-50 transition-all bg-white cursor-pointer">
              <select
                value={selectedDistrictCode}
                onChange={handleDistrictChange}
                disabled={!selectedProvinceCode}
                className="outline-none appearance-none bg-transparent cursor-pointer text-xs text-gray-600 disabled:opacity-40"
              >
                <option value="">📍 Quận / Huyện</option>
                {districtOptions}
              </select>
              <svg className="w-2.5 h-2.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>


            {/* Divider */}
            <div className="h-4 w-px bg-gray-200" />

            {/* ── Filter pills: Price Range, Main Dish, Open Now ─────────── */}
            {/* 💰 Khoảng giá — dropdown multi-select */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowPriceFilter(p => !p);
                  setShowSortFilter(false);
                }}
                className={`flex items-center gap-1 border rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${selectedPriceRange.length > 0
                  ? 'border-red-500 bg-red-50 text-red-600'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:bg-red-50'
                  }`}
              >
                💰 Khoảng giá
                {selectedPriceRange.length > 0 && (
                  <span className="ml-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                    {selectedPriceRange.length}
                  </span>
                )}
                <svg className="w-2.5 h-2.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {/* Price dropdown panel */}
              {showPriceFilter && (
                <div ref={priceFilterRef} className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[220px]" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Mức giá / người</p>
                  {(['BUDGET', 'MEDIUM', 'PREMIUM'] as const).map(val => (
                    <label key={val} className="flex items-center gap-2 py-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedPriceRange.includes(val)}
                        onChange={() => {
                          togglePriceRange(val);
                          restaurantListRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={`rounded ${val === 'BUDGET' ? 'accent-green-500' :
                          val === 'MEDIUM' ? 'accent-amber-500' :
                            'accent-purple-600'
                          }`}
                      />
                      <span className={`text-xs text-gray-700 transition-colors ${val === 'BUDGET' ? 'group-hover:text-green-600' :
                        val === 'MEDIUM' ? 'group-hover:text-amber-600' :
                          'group-hover:text-purple-700'
                        }`}>
                        <span className={`font-extrabold ${val === 'BUDGET' ? 'text-green-500' :
                          val === 'MEDIUM' ? 'text-amber-500' :
                            'text-purple-600'
                          }`}>{getPriceRangeSymbol(val)}</span>
                        <span className="ml-1 opacity-90 font-medium">
                          {val === 'BUDGET' && 'Bình dân (dưới 100k)'}
                          {val === 'MEDIUM' && 'Trung bình (100k–300k)'}
                          {val === 'PREMIUM' && 'Cao cấp (trên 300k)'}
                        </span>
                      </span>
                    </label>
                  ))}
                  {selectedPriceRange.length > 0 && (
                    <button
                      onClick={() => { setSelectedPriceRange([]); setShowPriceFilter(false); }}
                      className="mt-2 w-full text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Xóa bộ lọc giá
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ⬇️ Sắp xếp theo — dropdown radio */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowSortFilter(p => !p);
                  setShowPriceFilter(false);
                }}
                className={`flex items-center gap-1 border rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${selectedSortBy !== 'rating_desc'
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                  }`}
              >
                ⬇️ Sắp xếp
                {selectedSortBy !== 'rating_desc' && (
                  <span className="ml-1 bg-blue-500 w-2 h-2 rounded-full inline-block" />
                )}
                <svg className="w-2.5 h-2.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {/* Sort dropdown panel */}
              {showSortFilter && (
                <div ref={sortFilterRef} className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Sắp xếp kết quả</p>
                  {([
                    { val: 'rating_desc', label: '⭐ Đánh giá cao nhất' },
                    { val: 'near_me', label: '📍 Gần tôi nhất' },
                    { val: 'newest', label: '🆕 Mới nhất' },
                    { val: 'price_asc', label: '💰 Giá thấp → cao' },
                    { val: 'price_desc', label: '💎 Giá cao → thấp' },
                  ] as const).map(({ val, label }) => (
                    <label key={val} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded-lg -mx-1 px-1 transition-colors group">
                      <input
                        type="radio"
                        name="sort_by"
                        value={val}
                        checked={selectedSortBy === val}
                        onChange={() => {
                          setSelectedSortBy(val);
                          setPage(1);
                          setShowSortFilter(false);
                          restaurantListRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="accent-blue-500"
                      />
                      <span className="text-xs text-gray-700 group-hover:text-blue-600 transition-colors">{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* ⭐ Đánh giá cao (≥ 4 sao) — toggle */}
            <button
              type="button"
              onClick={() => {
                toggleHighRating();
                restaurantListRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`flex items-center gap-1 border rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${selectedHighRating
                ? 'border-amber-500 bg-amber-50 text-amber-600'
                : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:bg-amber-50'
                }`}
            >
              ⭐ Đánh giá cao
              {selectedHighRating && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />}
            </button>

            {/* Xóa tất cả filter */}
            {(selectedCuisine || selectedPriceRange.length > 0 || selectedHighRating || selectedSortBy !== 'rating_desc') && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-red-500 hover:text-red-700 underline whitespace-nowrap"
              >
                Xóa lọc
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Cuisine type pills — arrow nav thay scrollbar */}
      <section className="bg-white border-b border-gray-100 py-3">
        <div className="max-w-[1400px] mx-auto px-4 flex items-center gap-2">
          {/* Mũi tên trái — luôn hiện, không dùng hover trick */}
          <button
            onClick={() => scrollCuisine("left")}
            aria-label="Cuộn trái"
            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-red-400 hover:text-red-600 transition-colors flex-shrink-0 bg-white"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>

          {/* Pill row — ẩn scrollbar, scroll bằng nút */}
          <div
            ref={cuisineScrollRef}
            className="flex items-center gap-2 overflow-x-auto flex-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {CUISINE_TYPES.map((cuisine, index) => (
              <button
                key={index}
                onClick={() => navigate(`/explore?cuisine=${encodeURIComponent(cuisine.name)}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-500 text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
              >
                <span className="text-sm">{cuisine.emoji}</span>
                {cuisine.name}
              </button>
            ))}
          </div>

          {/* Mũi tên phải */}
          <button
            onClick={() => scrollCuisine("right")}
            aria-label="Cuộn phải"
            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-red-400 hover:text-red-600 transition-colors flex-shrink-0 bg-white"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </section>

      {/* Collections — horizontal scroll — always show, with empty state */}
      {true && (
        <section className="py-6 px-4">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Bộ sưu tập nổi bật</h2>
                <p className="text-gray-500 text-xs mt-0.5">Khám phá các gợi ý quán ngon cho mọi dịp</p>
              </div>
              <Link to="/collections" className="text-red-600 font-semibold hover:text-red-700 transition text-xs flex items-center gap-1 shrink-0">
                Xem tất cả ›
              </Link>
            </div>

            {/* Arrow + scroll container */}
            <div className="flex items-center gap-2">

              {/* Mũi tên trái — luôn hiện */}
              <button
                onClick={() => scrollCollections("left")}
                aria-label="Cuộn trái"
                className="w-7 h-7 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:border-red-400 hover:text-red-600 hover:shadow-md transition-all flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              </button>

              {/* Scrollable container */}
              <div
                ref={collectionScrollRef}
                className="flex gap-3 overflow-x-auto flex-1"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {collectionsLoading
                  ? [...Array(6)].map((_, i) => (
                    <div key={i} className="min-w-[180px] rounded-xl overflow-hidden animate-pulse bg-white flex-shrink-0 border border-gray-100">
                      <div className="h-28 bg-gray-200" />
                      <div className="p-2.5 space-y-1.5">
                        <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/3" />
                      </div>
                    </div>
                  ))
                  : collections.length === 0
                    ? (
                      <div className="min-w-full flex items-center justify-center py-12 col-span-full">
                        <div className="text-center">
                          <p className="text-gray-400 text-sm mb-2">📭 Chưa có bộ sưu tập nào</p>
                          <p className="text-gray-300 text-xs">Chúng tôi sẽ sớm quay lại với những gợi ý mới</p>
                        </div>
                      </div>
                    )
                    : collections.map((coll) => (
                      <div
                        key={coll.id}
                        className="min-w-[180px] max-w-[180px] rounded-xl overflow-hidden border border-gray-100 cursor-pointer group hover:shadow-md transition-shadow duration-200 bg-white flex-shrink-0"
                        onClick={() => navigate(`/collection/${coll.id}`)}
                      >
                        <div className="relative h-28 overflow-hidden">
                          {coll.badge_label && (
                            <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-sm">
                              {coll.badge_label}
                            </div>
                          )}
                          <img
                            src={coll.image_url || coll.cover_image_url}
                            alt={coll.title}
                            loading="lazy"
                            onError={handleImageError}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                        <div className="p-2.5">
                          <h3 className="font-semibold text-gray-800 line-clamp-2 text-xs leading-snug mb-1">{coll.title}</h3>
                          <p className="text-xs text-gray-400">
                            <span className="text-red-600 font-bold">{coll.items?.length ?? "—"}</span> điểm đến
                          </p>
                        </div>
                      </div>
                    ))
                }
              </div>

              {/* Mũi tên phải — luôn hiện */}
              <button
                onClick={() => scrollCollections("right")}
                aria-label="Cuộn phải"
                className="w-7 h-7 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:border-red-400 hover:text-red-600 hover:shadow-md transition-all flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </button>

            </div>
          </div>
        </section>
      )}

      {/* Top Rated Section */}
      {/* TODO (backend): Fetch riêng endpoint /restaurants?sort=rating&limit=4&status=APPROVED
          Hiện tại topRatedRestaurants lấy từ state đang filter theo cuisine — nếu user chọn "Lẩu"
          thì section này cũng chỉ hiện lẩu, gây nhầm lẫn. Cần state + useEffect riêng. */}
      <section className="py-10 px-4">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Nhà hàng được đánh giá cao</h2>
              <p className="text-gray-500 text-sm mt-1">Dựa trên đánh giá thực tế từ cộng đồng khách hàng</p>
            </div>
            <Link to="/explore" className="text-red-600 font-semibold hover:text-red-700 transition text-sm flex items-center gap-1">
              Xem tất cả <span>›</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {loadingTopRated
              ? [...Array(4)].map((_, i) => <RestaurantSkeleton key={i} />)
              : topRatedRestaurants.map((restaurant) => (
                <RestaurantCard
                  key={`top-${restaurant.id}`}
                  restaurant={restaurant as any}
                  onBookTable={(r) => handleBookTable(r as any)}
                />
              ))
            }
          </div>
        </div>
      </section>


      {/* Restaurants List - All */}
      <section ref={restaurantListRef} className="max-w-[1400px] mx-auto px-4 py-10 scroll-mt-20">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedCuisine ? `Nhà Hàng ${selectedCuisine}` : "Tất Cả Nhà Hàng"}
              {activeFilterCount > 0 && (
                <span className="ml-2 text-base font-normal text-gray-500">({activeFilterCount} bộ lọc)</span>
              )}
            </h2>
            {(selectedCuisine || activeFilterCount > 0) && (
              <button
                onClick={() => {
                  setSelectedCuisine("");
                  clearAllFilters();
                }}
                className="text-sm text-red-600 hover:text-red-700 font-medium underline"
              >
                Xóa tất cả
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-8">
            {error}
          </div>
        )}

        {/* Grid luôn render — skeleton khi loading, data khi sẵn sàng */}
        <div className="relative">
          {loading && restaurants.length > 0 && (
            <div className="absolute inset-0 z-10 flex items-start justify-center pt-16 bg-white/50 rounded-2xl">
              <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-full shadow-lg border border-gray-100">
                <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-gray-600">Đang tải...</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {loading && restaurants.length === 0
              ? [...Array(ITEMS_PER_PAGE)].map((_, i) => <RestaurantSkeleton key={i} />)
              : restaurants.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant as any}
                  onBookTable={(r) => handleBookTable(r as any)}
                />
              ))
            }
          </div>

          {/* Empty state — no restaurants found after filtering */}
          {!loading && restaurants.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Không tìm thấy nhà hàng phù hợp</h3>
              <p className="text-gray-500 text-sm mb-6 text-center max-w-md">
                Hãy thử thay đổi bộ lọc hoặc tìm kiếm với từ khóa khác
              </p>
              <div className="flex flex-col gap-3 mb-4">
                <p className="text-xs text-gray-400 font-medium">💡 Gợi ý: Thử tìm kiếm</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['Buffet', 'Lẩu', 'Hải sản'].map(cuisine => (
                    <button
                      key={cuisine}
                      onClick={() => navigate(`/explore?cuisine=${encodeURIComponent(cuisine)}`)}
                      className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors"
                    >
                      {cuisine}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  clearAllFilters();
                  setSelectedCuisine("");
                }}
                className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Xóa bộ lọc
              </button>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-12 flex justify-center items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2))
                .map((pageNum, index, array) => (
                  <div key={pageNum} className="flex items-center">
                    {index > 0 && array[index - 1] !== pageNum - 1 && <span className="px-2 text-gray-400">...</span>}
                    <button
                      onClick={() => {
                        setPage(pageNum);
                        window.scrollTo({ top: restaurantListRef.current?.offsetTop || 0, behavior: 'smooth' });
                      }}
                      className={`w-10 h-10 rounded-lg font-semibold transition-all ${page === pageNum
                        ? "bg-red-600 text-white shadow-lg"
                        : "hover:bg-red-50 text-gray-600 border border-gray-200"
                        }`}
                    >
                      {pageNum}
                    </button>
                  </div>
                ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          )}

          {totalCount > 0 && (
            <p className="text-center text-gray-400 text-xs mt-4">
              Hiển thị {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, totalCount)} trong tổng số {totalCount} nhà hàng
            </p>
          )}
        </div>

      </section>

      {/* Partner CTA */}
      {!isLoggedIn && (
        <section className="py-12 bg-gradient-to-br from-red-600 to-red-700 text-white">
          <div className="max-w-[1400px] mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-4xl font-bold mb-6">Bạn là chủ nhà hàng?</h3>
                <p className="text-xl text-red-100 mb-8 leading-relaxed">
                  Gia nhập nền tảng của chúng tôi để tiếp cận hàng nghìn khách
                  hàng mới. Quản lý đặt bàn dễ dàng, tăng doanh thu và phát triển
                  thương hiệu của bạn.
                </p>
                <a
                  href="/register_partner"
                  className="inline-block bg-white text-red-600 px-8 py-4 rounded-xl hover:bg-gray-50 transition font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105"
                >
                  Đăng ký hợp tác ngay
                </a>
              </div>
              <div className="relative">
                <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
                  {/* TODO: Thay URL Pexels bằng ảnh tự host hoặc CDN của app
                      URL bên ngoài có thể bị block hotlink bất cứ lúc nào */}
                  <img
                    src="/pexels-photo-3184192.jpeg"
                    alt="Restaurant owner"
                    className="rounded-2xl shadow-2xl"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <Footer />

      {bookingFormOpen && selectedRestaurant && (
        <BookingForm
          restaurant={selectedRestaurant}
          initialDate=""
          initialGuests="2"
          onClose={() => setBookingFormOpen(false)}
          onSuccess={(bookingId) => {
            navigate(`/my-bookings?highlight=${bookingId}`);
          }}
        />
      )}
    </div>
  );
}
