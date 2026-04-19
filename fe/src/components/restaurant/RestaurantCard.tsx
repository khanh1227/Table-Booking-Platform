import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MapPin, Star, Heart } from "lucide-react";
import ImageWithSkeleton from "@/components/common/ImageWithSkeleton";
import { getRestaurantImage, getPriceRangeLabel, getPriceRangeSymbol, PRICE_RANGE_COLORS } from "@/lib/restaurantDisplay";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export type RestaurantCardDto = {
  id: number;
  name: string;
  address: string;
  status: string;
  rating: number;
  cuisine_type: string;
  price_range?: "BUDGET" | "MEDIUM" | "PREMIUM";
  location?: any;
  opening_hours?: string;
  thumbnail?: string;
  images?: any[];
  is_favorite?: boolean;
};

interface RestaurantCardProps {
  restaurant: RestaurantCardDto;
  onBookTable?: (restaurant: RestaurantCardDto) => void;
  onFavoriteChange?: (restaurantId: number, isFavorite: boolean) => void;
  layout?: "grid" | "list";
}

export default function RestaurantCard({ restaurant, onBookTable, onFavoriteChange, layout = "grid" }: RestaurantCardProps) {
  const [isFavorite, setIsFavorite] = useState(restaurant.is_favorite || false);
  const [isLiking, setIsLiking] = useState(false);

  // Sync state if prop changes
  useEffect(() => {
    if (restaurant.is_favorite !== undefined) {
      setIsFavorite(restaurant.is_favorite);
    }
  }, [restaurant.is_favorite]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to restaurant detail
    e.stopPropagation();

    const token = localStorage.getItem("access");
    if (!token) {
      alert("Bạn cần đăng nhập để lưu nhà hàng yêu thích!");
      return;
    }

    setIsLiking(true);
    // Optimistic update
    setIsFavorite(!isFavorite);

    try {
      const res = await fetch(`${API_BASE}/api/restaurants/restaurants/${restaurant.id}/toggle-favorite/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra");
      
      const nextIsFavorite = data.status === "favorited";
      setIsFavorite(nextIsFavorite);
      onFavoriteChange?.(restaurant.id, nextIsFavorite);
    } catch (err: any) {
      console.error(err);
      // Revert optimistic update
      setIsFavorite(isFavorite);
    } finally {
      setIsLiking(false);
    }
  };

  const imageUrl = getRestaurantImage(restaurant);

  if (layout === "list") {
    // A wider layout for Explore List mode if needed
    return (
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-slate-100 overflow-hidden flex flex-col sm:flex-row group">
        <Link to={`/restaurant/${restaurant.id}`} className="relative sm:w-1/3">
          <ImageWithSkeleton 
            src={imageUrl} 
            alt={restaurant.name} 
            containerClassName="h-48 sm:h-full w-full" 
            className="group-hover:scale-105 transition-transform duration-500" 
          />
          {restaurant.status === "APPROVED" && (
            <div className="absolute top-3 left-3 bg-green-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-bold z-10">
              Có Thể Đặt
            </div>
          )}
          <button 
            onClick={toggleFavorite}
            disabled={isLiking}
            className={`absolute top-3 right-3 bg-white/80 hover:bg-white backdrop-blur-md p-2 rounded-full shadow transition-all duration-300 z-20 ${isFavorite ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100'}`}
          >
            <Heart className={`w-5 h-5 transition-colors ${isFavorite ? "fill-red-500 text-red-500" : "text-gray-500 hover:text-red-500"}`} />
          </button>
        </Link>

        <div className="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <Link to={`/restaurant/${restaurant.id}`} className="flex-1 pr-2">
                <h3 className="text-xl font-bold text-gray-800 line-clamp-2 group-hover:text-amber-600 transition-colors">
                  {restaurant.name}
                </h3>
              </Link>
              <div className="bg-amber-50 px-2 py-1 rounded-lg flex items-center space-x-1 shrink-0">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="font-bold text-amber-900 text-sm">
                  {Number(restaurant.rating ?? 0).toFixed(1)}
                </span>
              </div>
            </div>

            <div className="flex items-start space-x-2 text-gray-500 text-sm mb-3">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{restaurant.address}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-amber-600 font-medium text-sm">
                {restaurant.cuisine_type || "Chưa cập nhật loại hình"}
              </div>
              {restaurant.price_range && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${PRICE_RANGE_COLORS[restaurant.price_range as any] || 'bg-gray-50 text-gray-700'}`}>
                  {getPriceRangeSymbol(restaurant.price_range)} {getPriceRangeLabel(restaurant.price_range)}
                </span>
              )}
            </div>
          </div>

          {onBookTable && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={(e) => { e.preventDefault(); onBookTable(restaurant); }}
                className="bg-amber-600 text-white px-5 py-2.5 rounded-xl hover:bg-orange-600 hover:shadow-lg transition-all font-medium text-sm"
              >
                Đặt Bàn Ngay
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default grid layout
  return (
    <div
      className="bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] overflow-hidden group flex flex-col"
    >
      <Link to={`/restaurant/${restaurant.id}`} className="relative block h-48 shrink-0 overflow-hidden">
        <ImageWithSkeleton
          src={imageUrl}
          alt={restaurant.name}
          containerClassName="h-48 absolute inset-0 w-full"
          className="group-hover:scale-110 transition-transform duration-700"
        />
        {restaurant.status === "APPROVED" && (
          <div className="absolute top-3 left-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold z-10 shadow">
            Có Thể Đặt
          </div>
        )}
        <button 
          onClick={toggleFavorite}
          disabled={isLiking}
          className={`absolute top-3 right-3 bg-white/90 hover:bg-white backdrop-blur-md p-2 rounded-full shadow-sm transition-all duration-300 hover:scale-110 active:scale-95 z-20 ${isFavorite ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100'}`}
        >
          <Heart className={`w-5 h-5 transition-colors ${isFavorite ? "fill-red-500 text-red-500" : "text-gray-400 hover:text-red-500"}`} />
        </button>
      </Link>

      <div className="p-5 flex-1 flex flex-col">
        <Link to={`/restaurant/${restaurant.id}`} className="block mb-2 flex-1">
          <h3 className="text-xl font-bold text-gray-800 line-clamp-2 group-hover:text-amber-600 transition-colors">
            {restaurant.name}
          </h3>
        </Link>

        <div className="flex items-center space-x-2 mb-3 text-gray-500 text-sm">
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="truncate">{restaurant.address}</span>
        </div>

        <div className="flex items-end justify-between mt-auto pt-4 border-t border-gray-50">
          <div>
            <div className="flex items-center space-x-1 mb-1">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span className="font-bold text-gray-800 text-lg">
                {Number(restaurant.rating ?? 0).toFixed(1)}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <div className="text-amber-600 font-medium text-xs uppercase tracking-wide">
                {restaurant.cuisine_type || "Món ăn"}
              </div>
              {restaurant.price_range && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded normal-case tracking-normal ${PRICE_RANGE_COLORS[restaurant.price_range as any] || 'bg-gray-50 text-gray-700'}`}>
                  {getPriceRangeSymbol(restaurant.price_range)}
                </span>
              )}
            </div>
          </div>

          {onBookTable ? (
            <button
              onClick={() => onBookTable(restaurant)}
              className="bg-amber-50 text-amber-600 px-4 py-2 rounded-xl hover:bg-amber-600 hover:text-white transition-colors font-semibold text-sm"
            >
              Đặt Bàn
            </button>
          ) : (
            <Link 
              to={`/restaurant/${restaurant.id}`}
              className="text-gray-400 hover:text-amber-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
