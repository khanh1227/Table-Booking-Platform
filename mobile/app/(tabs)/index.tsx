import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  StatusBar,
  Image,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, MapPin, SlidersHorizontal, Utensils, MessageSquare, Bell, Navigation, ChevronRight, LayoutGrid, Heart, Sparkles, Zap, Star, X } from 'lucide-react-native';
import { fetchRestaurants, fetchCollections, getAbsoluteUrl, fetchTopRatedRestaurants } from '../../src/services/api';
import RestaurantCard from '../../src/components/RestaurantCard';
import SafeImage from '../../src/components/SafeImage';
import { router } from 'expo-router';
import MainHeader from '../../src/components/MainHeader';
import { useLocation } from '../../src/context/LocationContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const CUISINE_TYPES = [
  { id: 'Buffet', label: 'Buffet', emoji: '🍱', color: 'bg-orange-100' },
  { id: 'Lẩu', label: 'Lẩu', emoji: '🍲', color: 'bg-blue-100' },
  { id: 'Nướng', label: 'Nướng', emoji: '🔥', color: 'bg-red-100' },
  { id: 'Hải Sản', label: 'Hải sản', emoji: '🦐', color: 'bg-cyan-100' },
  { id: 'Quán Nhậu', label: 'Quán nhậu', emoji: '🍺', color: 'bg-amber-100' },
  { id: 'Món Nhật', label: 'Món Nhật', emoji: '🍣', color: 'bg-purple-100' },
  { id: 'Món Việt', label: 'Món Việt', emoji: '🍜', color: 'bg-yellow-100' },
  { id: 'Món Hàn', label: 'Món Hàn', emoji: '🥢', color: 'bg-pink-100' },
  { id: 'Chay', label: 'Đồ Chay', emoji: '🥬', color: 'bg-green-100' },
];

export default function HomeScreen() {
  const [restaurants, setRestaurants] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showHero, setShowHero] = useState(true);
  const { location } = useLocation();

  useEffect(() => {
    checkHeroStatus();
    loadInitialData();
  }, [page, location.latitude, location.longitude, location.city]);

  const checkHeroStatus = async () => {
    try {
      const status = await AsyncStorage.getItem('hideHeroBanner');
      if (status === 'true') setShowHero(false);
    } catch (e) {}
  };

  const dismissHero = async () => {
    setShowHero(false);
    try {
      await AsyncStorage.setItem('hideHeroBanner', 'true');
    } catch (e) {}
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [restResponse, collData, topRatedData] = await Promise.all([
        fetchRestaurants(undefined, undefined, page, location.latitude, location.longitude),
        fetchCollections(),
        fetchTopRatedRestaurants(5)
      ]);
      setRestaurants(restResponse.results || []);
      setTotalCount(restResponse.count || 0);
      setCollections(collData.slice(0, 6));
      setTopRated(topRatedData || []);
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        console.error("Lỗi tải dữ liệu HomeScreen:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / 12); 

  const renderHeader = () => (
    <View className="pt-0 pb-6">
      <MainHeader showSearch={true} />

      {/* Hero Banner */}
      {showHero && (
        <View className="px-4 mb-10">
          <View className="bg-red-600 rounded-[40px] p-8 shadow-2xl shadow-red-200 overflow-hidden relative">
            <View className="absolute -top-10 -right-10 w-40 h-40 bg-red-500 rounded-full opacity-50" />
            
            <TouchableOpacity 
              onPress={dismissHero}
              style={{ position: 'absolute', top: 16, right: 16, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 99 }}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>

            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-white font-black text-2xl leading-8 mb-2">🍽️ Đặt bàn dễ, ăn ngon hơn</Text>
                <Text className="text-red-100 text-xs font-medium mb-4">500+ nhà hàng • Cam kết giá tốt • Ưu đãi độc quyền</Text>
                <TouchableOpacity 
                  onPress={() => router.push('/(tabs)/explore')}
                  className="bg-white self-start px-5 py-2.5 rounded-full"
                >
                  <Text className="text-red-600 font-black text-xs">Khám phá ngay →</Text>
                </TouchableOpacity>
              </View>
              <View className="bg-red-500/30 p-4 rounded-full">
                <Utensils size={40} color="#fff" />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Cuisine Categories */}
      <View className="mb-10">
        <View className="px-4 mb-4 flex-row justify-between items-end">
          <View>
            <Text className="text-gray-900 font-black text-xl">Khám phá theo món</Text>
            <Text className="text-gray-400 text-xs font-medium">Tìm quán theo khẩu vị của bạn</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-4">
          {CUISINE_TYPES.map((cat) => (
            <TouchableOpacity 
              key={cat.id}
              onPress={() => router.push({ pathname: '/(tabs)/explore', params: { search: cat.id } })}
              className="items-center mr-6"
            >
              <View className={`${cat.color} w-16 h-16 rounded-[24px] items-center justify-center shadow-sm border border-white/50`}>
                <Text className="text-3xl">{cat.emoji}</Text>
              </View>
              <Text className="text-gray-600 font-bold text-[10px] mt-2 uppercase tracking-tighter">{cat.label}</Text>
            </TouchableOpacity>
          ))}
          <View className="w-4" />
        </ScrollView>
      </View>

      {/* Top Rated Section */}
      {topRated.length > 0 && (
        <View className="mb-10">
          <View className="px-4 mb-4 flex-row justify-between items-end">
            <View>
              <View className="flex-row items-center">
                <Text className="text-gray-900 font-black text-xl mr-2">Đỉnh cao ẩm thực</Text>
                <View className="bg-amber-100 px-2 py-0.5 rounded-md">
                  <Text className="text-amber-600 font-bold text-[10px]">TOP RATED</Text>
                </View>
              </View>
              <Text className="text-gray-400 text-xs font-medium">Những nhà hàng được đánh giá tốt nhất</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-4">
            {topRated.map((item) => (
              <TouchableOpacity 
                key={item.id}
                onPress={() => router.push(`/restaurant/${item.id}`)}
                className="w-64 mr-4 bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden"
              >
                <View className="relative">
                  <SafeImage 
                    uri={getAbsoluteUrl(item.thumbnail || (item.images && item.images[0]?.image_url))}
                    className="w-full h-36 bg-gray-100"
                    resizeMode="cover"
                  />
                  <View className="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded-xl flex-row items-center">
                    <Star size={12} color="#f97316" fill="#f97316" />
                    <Text className="text-orange-600 font-bold text-xs ml-1">{item.rating}</Text>
                  </View>
                </View>
                <View className="p-4">
                  <Text className="text-gray-900 font-black text-sm mb-1" numberOfLines={1}>{item.name}</Text>
                  <View className="flex-row items-center mb-2">
                    <MapPin size={10} color="#9ca3af" />
                    <Text className="text-gray-400 text-[10px] ml-1" numberOfLines={1}>{item.address}</Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-red-600 font-black text-xs uppercase tracking-tighter">{item.cuisine_type || 'Ẩm thực'}</Text>
                    <View className="flex-row items-center">
                      <Zap size={10} color="#f97316" fill="#f97316" />
                      <Text className="text-orange-600 font-bold text-[10px] ml-1">Nổi bật</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            <View className="w-4" />
          </ScrollView>
        </View>
      )}

      {/* Collections Section */}
      {collections.length > 0 && (
        <View className="px-4 mb-10">
          <View className="flex-row justify-between items-end mb-4">
            <View>
              <Text className="text-gray-900 font-black text-xl">Gợi ý hôm nay</Text>
              <Text className="text-gray-400 text-xs font-medium">Bộ sưu tập quán ngon được tuyển chọn</Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/collections')}
              className="flex-row items-center bg-gray-50 px-3 py-1.5 rounded-full"
            >
              <Text className="text-gray-900 font-bold text-[10px] mr-1">TẤT CẢ</Text>
              <ChevronRight size={12} color="#111827" />
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {collections.map((coll) => (
              <TouchableOpacity 
                key={coll.id}
                onPress={() => router.push(`/collections/${coll.id}`)}
                className="w-40 mr-4 rounded-[24px] overflow-hidden border border-gray-100 shadow-sm bg-white"
              >
                <SafeImage 
                  uri={getAbsoluteUrl(coll.image_url || coll.cover_image || coll.cover_image_url)}
                  className="w-full h-32 bg-gray-100"
                  resizeMode="cover"
                />
                <View className="p-3">
                  <Text className="text-gray-900 font-black text-[12px]" numberOfLines={1}>{coll.title}</Text>
                  <Text className="text-gray-400 text-[10px] mt-1 font-medium">{coll.items_count ?? 0} địa điểm</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Recommended Restaurants Section Title */}
      <View className="px-4 mb-2">
        <View className="flex-row items-center">
          <Text className="text-gray-900 font-black text-xl mr-2">Dành riêng cho bạn</Text>
          <View className="p-1 bg-red-100 rounded-full">
            <Sparkles size={12} color="#ef4444" fill="#fee2e2" />
          </View>
        </View>
        <Text className="text-gray-400 text-xs font-medium mb-3">Dựa trên sở thích và vị trí của bạn</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View className="px-4 mb-4">
            <RestaurantCard restaurant={item} />
          </View>
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          loading ? (
            <View className="py-20 items-center">
              <ActivityIndicator size="large" color="#ef4444" />
            </View>
          ) : (
            <View className="items-center mt-20">
              <Utensils size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-4 font-medium">Không tìm thấy nhà hàng nào</Text>
            </View>
          )
        }
        ListFooterComponent={
          totalPages > 1 ? (
            <View className="flex-row justify-center items-center py-6 px-4 space-x-2">
              <TouchableOpacity 
                onPress={() => {
                  setPage(p => Math.max(1, p - 1));
                  // Scroll to top of list after page change would be nice but FlatList is tricky
                }}
                disabled={page === 1}
                className={`px-4 py-2 rounded-xl border ${page === 1 ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white shadow-sm'}`}
              >
                <Text className={`${page === 1 ? 'text-gray-300' : 'text-gray-700'} font-bold text-xs`}>Trước</Text>
              </TouchableOpacity>
              
              <View className="bg-gray-100 px-4 py-2 rounded-xl">
                <Text className="text-gray-700 font-bold text-xs">{page} / {totalPages}</Text>
              </View>

              <TouchableOpacity 
                onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`px-4 py-2 rounded-xl border ${page === totalPages ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white shadow-sm'}`}
              >
                <Text className={`${page === totalPages ? 'text-gray-300' : 'text-gray-700'} font-bold text-xs`}>Tiếp</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        onRefresh={loadInitialData}
        refreshing={loading}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
