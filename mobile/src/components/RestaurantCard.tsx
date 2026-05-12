import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Star, MapPin, Clock, Navigation } from 'lucide-react-native';
import { getAbsoluteUrl } from '../services/api';
import { Link } from 'expo-router';
import SafeImage from './SafeImage';

interface RestaurantCardProps {
  restaurant: any;
}

const getPriceLabel = (price: any) => {
  if (!price) return '$$';
  if (typeof price === 'string') {
    const p = price.toUpperCase();
    if (p === "BUDGET" || p.includes("BÌNH DÂN")) return "Bình dân";
    if (p === "MEDIUM" || p.includes("TRUNG BÌNH")) return "Trung bình";
    if (p === "PREMIUM" || p.includes("CAO CẤP")) return "Cao cấp";
  }
  
  const num = parseInt(String(price).replace(/\D/g, ""));
  if (isNaN(num) || num <= 0) return price;
  
  if (num < 100000) return 'Bình dân';
  if (num <= 300000) return 'Trung bình';
  return 'Cao cấp';
};
export default function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const rawImageUrl = restaurant.thumbnail || (restaurant.images && restaurant.images[0]?.image_url);
  const imageUrl = getAbsoluteUrl(rawImageUrl);

  return (
    <Link href={`/restaurant/${restaurant.id}`} asChild>
      <TouchableOpacity className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden border border-gray-100">
        <SafeImage
          uri={imageUrl}
          className="w-full h-48 bg-gray-200"
          resizeMode="cover"
        />
        
        <View className="p-4">
          <View className="flex-row justify-between items-start">
            <Text className="text-lg font-bold text-gray-900 flex-1 mr-2" numberOfLines={1}>
              {restaurant.name}
            </Text>
            <View className="flex-row items-center bg-orange-50 px-2 py-1 rounded-lg">
              <Star size={14} color="#f97316" fill="#f97316" />
              <Text className="text-orange-700 font-bold ml-1 text-xs">{restaurant.rating || 'N/A'}</Text>
            </View>
          </View>

          <View className="flex-row items-center mt-2">
            <MapPin size={14} color="#6b7280" />
            <Text className="text-gray-500 text-sm ml-1" numberOfLines={1}>
              {restaurant.address}
            </Text>
          </View>

          <View className="flex-row items-center mt-3 pt-3 border-t border-gray-50">
            <View className="bg-gray-100 px-2 py-1 rounded-md mr-2">
              <Text className="text-gray-600 text-[10px] font-medium uppercase tracking-wider">
                {restaurant.cuisine_type || 'Ẩm thực'}
              </Text>
            </View>
            <Text className="text-red-600 font-bold text-xs uppercase">
              {getPriceLabel(restaurant.price_range)}
            </Text>
            {restaurant.distance !== undefined && (
              <View className="flex-row items-center ml-3 bg-blue-50 px-2 py-0.5 rounded-full">
                <Navigation size={10} color="#3b82f6" />
                <Text className="text-blue-600 font-bold text-[10px] ml-1">{restaurant.distance}km</Text>
              </View>
            )}
            <View className="flex-1" />
            <View className="flex-row items-center">
              <Clock size={12} color="#9ca3af" />
              <Text className="text-gray-400 text-xs ml-1">
                {restaurant.opening_hours || '09:00 - 22:00'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}
