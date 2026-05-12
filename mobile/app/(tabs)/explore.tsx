import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  SafeAreaView,
  ScrollView,
  Alert,
  Modal,
  Keyboard
} from 'react-native';
import { Search, X, Navigation, Star, Clock, Filter, MapPin, ChevronRight, Zap } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import MainHeader from '../../src/components/MainHeader';
import { fetchRestaurants } from '../../src/services/api';
import RestaurantCard from '../../src/components/RestaurantCard';
import { useLocation } from '../../src/context/LocationContext';

// Stable header component to prevent keyboard hiding bug
const ExploreHeader = React.memo(({ 
  query, setQuery, handleSearch, 
  setFilterModalVisible, setLocationModalVisible, 
  location, sortBy, setSortBy, 
  cuisines, activeCuisine, setActiveCuisine, 
  totalCount, loading, hasActiveFilters 
}: any) => (
  <View className="px-4 pt-1 pb-2">
    <TouchableOpacity onPress={() => setLocationModalVisible(true)} className="flex-row items-center py-2 mb-2">
      <MapPin size={16} color="#ef4444" /><Text className="text-gray-900 font-black ml-2 mr-1">{location.address || 'Hồ Chí Minh'}</Text><ChevronRight size={14} color="#9ca3af" />
    </TouchableOpacity>
    <View className="flex-row items-center mb-4">
      <View className="flex-1 flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mr-3">
        <Search size={20} color="#9ca3af" /><TextInput placeholder="Tìm nhà hàng..." className="flex-1 ml-2 font-medium" value={query} onChangeText={setQuery} onSubmitEditing={handleSearch} returnKeyType="search" />
        {query.length > 0 && <TouchableOpacity onPress={() => setQuery('')}><X size={18} color="#9ca3af" /></TouchableOpacity>}
      </View>
      <TouchableOpacity onPress={() => setFilterModalVisible(true)} className={`p-3 rounded-2xl border ${hasActiveFilters ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
        <Filter size={20} color={hasActiveFilters ? "#ef4444" : "#6b7280"} />
      </TouchableOpacity>
    </View>
    <View className="flex-row mb-6">
      {[ 
        { id: '-rating', label: 'ĐÁNH GIÁ', icon: Star, color: '#f97316' }, 
        { id: 'near_me', label: 'GẦN TÔI', icon: MapPin, color: '#ef4444' }, 
        { id: '-created_at', label: 'MỚI NHẤT', icon: Clock, color: '#6b7280' } 
      ].map((item) => (
        <TouchableOpacity key={item.id} onPress={() => setSortBy(item.id)} className={`flex-row items-center mr-6 ${sortBy === item.id ? 'opacity-100' : 'opacity-40'}`}>
          <item.icon size={14} color={sortBy === item.id ? item.color : "#6b7280"} fill={sortBy === item.id && item.id === '-rating' ? item.color : "transparent"} /><Text className={`ml-1.5 text-xs font-black ${sortBy === item.id ? 'text-gray-900' : 'text-gray-500'}`}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 -mx-4 px-4">
      {cuisines.map((item: string) => (
        <TouchableOpacity key={item} onPress={() => setActiveCuisine(item)} className={`px-6 py-2.5 rounded-full mr-2 border ${activeCuisine === item ? 'bg-red-600 border-red-600 shadow-md shadow-red-200' : 'bg-white border-gray-100'}`}><Text className={`text-[10px] font-black uppercase ${activeCuisine === item ? 'text-white' : 'text-gray-500'}`}>{item}</Text></TouchableOpacity>
      ))}
    </ScrollView>
    {!loading && <View className="mb-4 flex-row justify-between items-center"><Text className="text-gray-900 font-black text-lg">{activeCuisine !== 'Tất cả' ? activeCuisine : 'Khám phá quán ngon'}</Text><Text className="text-gray-400 text-xs font-bold">{totalCount} địa điểm</Text></View>}
  </View>
));

export default function ExploreScreen() {
  const { search } = useLocalSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeCuisine, setActiveCuisine] = useState((search as string) || 'Tất cả');
  const [sortBy, setSortBy] = useState('-rating'); 
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const { location, setLocation, detectLocation } = useLocation();

  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [minRating, setMinRating] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<string[]>([]);
  const [tempMinRating, setTempMinRating] = useState<string | null>(null);
  const [tempPriceRange, setTempPriceRange] = useState<string[]>([]);

  const cuisines = ['Tất cả', 'Món Việt', 'Món Nhật', 'Hải Sản', 'BBQ', 'Buffet', 'Chay'];
  const VIETNAM_CITIES = [
    { name: 'Hồ Chí Minh', lat: 10.762622, lng: 106.660172 },
    { name: 'Hà Nội', lat: 21.028511, lng: 105.804817 },
    { name: 'Đà Nẵng', lat: 16.054407, lng: 108.202162 },
    { name: 'Cần Thơ', lat: 10.045162, lng: 105.746857 },
  ];

  useEffect(() => {
    if (search) setActiveCuisine(search as string);
  }, [search]);

  useEffect(() => {
    loadData(1);
  }, [sortBy, activeCuisine, location.latitude, location.longitude, minRating, priceRange]);

  const loadData = async (currentPage: number) => {
    setLoading(true);
    try {
      const response = await fetchRestaurants(
        query || (activeCuisine === 'Tất cả' ? undefined : activeCuisine), 
        sortBy, 
        currentPage,
        location.latitude,
        location.longitude,
        minRating,
        priceRange
      );
      setResults(response.results || []);
      setTotalCount(response.count || 0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadData(1);
    Keyboard.dismiss();
  };

  const handleLocationSearch = async () => {
    if (locationQuery.length < 2) return;
    setSearchingLocation(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery + ', Việt Nam')}&addressdetails=1&limit=5`, {
        headers: { 'Accept-Language': 'vi', 'User-Agent': 'RestaurantBookingApp/1.0' }
      });
      const data = await res.json();
      setLocationResults(data.map((item: any) => ({
        name: item.display_name.split(',')[0],
        full_name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      })));
    } catch (error) {
      console.error(error);
    } finally {
      setSearchingLocation(false);
    }
  };

  const handleSelectLocation = (city: any) => {
    setLocation({ latitude: city.lat, longitude: city.lng, address: city.name });
    setLocationModalVisible(false);
    setLocationQuery('');
    setLocationResults([]);
  };

  const handleNearMe = async () => {
    try {
      await detectLocation();
      setLocationModalVisible(false);
      setSortBy('near_me');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể lấy vị trí');
    }
  };

  const hasActiveFilters = useMemo(() => !!(minRating || priceRange.length > 0), [minRating, priceRange]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <MainHeader title="Khám phá" />
      <FlatList
        data={results}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View className="px-4 mb-4 relative">
            <RestaurantCard restaurant={item} />
          </View>
        )}
        ListHeaderComponent={
          <ExploreHeader 
            query={query} setQuery={setQuery} handleSearch={handleSearch}
            setFilterModalVisible={setFilterModalVisible} setLocationModalVisible={setLocationModalVisible}
            location={location} sortBy={sortBy} setSortBy={setSortBy}
            cuisines={cuisines} activeCuisine={activeCuisine} setActiveCuisine={setActiveCuisine}
            totalCount={totalCount} loading={loading} hasActiveFilters={hasActiveFilters}
          />
        }
        ListEmptyComponent={
          loading ? <ActivityIndicator size="large" color="#ef4444" className="mt-20" /> : <View className="items-center mt-20"><Text className="text-gray-400 font-bold">Không tìm thấy nhà hàng</Text></View>
        }
        onRefresh={() => loadData(page)}
        refreshing={loading}
      />

      <Modal visible={locationModalVisible} transparent={true} animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[40px] h-[70%] p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-black">Chọn khu vực</Text>
              <TouchableOpacity onPress={() => setLocationModalVisible(false)}><X size={20} color="#000" /></TouchableOpacity>
            </View>
            <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 mb-6">
              <Search size={18} color="#9ca3af" />
              <TextInput placeholder="Tìm thành phố..." className="flex-1 ml-2" value={locationQuery} onChangeText={setLocationQuery} onSubmitEditing={handleLocationSearch} returnKeyType="search" />
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {searchingLocation ? <ActivityIndicator color="#ef4444" /> : locationResults.length > 0 ? (
                locationResults.map((city, idx) => (
                  <TouchableOpacity key={idx} onPress={() => handleSelectLocation(city)} className="py-4 border-b border-gray-50">
                    <Text className="text-gray-900 font-bold">{city.name}</Text>
                    <Text className="text-gray-400 text-[10px]">{city.full_name}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <>
                  <TouchableOpacity onPress={handleNearMe} className="flex-row items-center bg-red-50 p-4 rounded-2xl mb-6">
                    <Navigation size={20} color="#ef4444" /><Text className="text-red-600 font-black ml-3">Vị trí hiện tại</Text>
                  </TouchableOpacity>
                  {VIETNAM_CITIES.map((city) => (
                    <TouchableOpacity key={city.name} onPress={() => handleSelectLocation(city)} className="py-4 border-b border-gray-50">
                      <Text className="text-gray-900 font-bold">{city.name}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={filterModalVisible} transparent={true} animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[40px] h-[80%] p-6">
            <Text className="text-2xl font-black mb-8">Bộ lọc</Text>
            <ScrollView>
              <Text className="text-gray-400 text-[10px] font-black uppercase mb-4">Đánh giá</Text>
              <View className="flex-row space-x-2 mb-8">
                {['3', '4', '4.5'].map((rate) => (
                  <TouchableOpacity key={rate} onPress={() => setTempMinRating(rate)} className={`flex-1 py-4 rounded-2xl border ${tempMinRating === rate ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-50'}`}>
                    <Text className="text-center font-black">{rate}+</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text className="text-gray-400 text-[10px] font-black uppercase mb-4">Khoảng giá</Text>
              <View className="space-y-3">
                {[ { id: 'BUDGET', label: 'Bình dân' }, { id: 'MEDIUM', label: 'Trung cấp' }, { id: 'PREMIUM', label: 'Cao cấp' } ].map((p) => (
                  <TouchableOpacity key={p.id} onPress={() => setTempPriceRange(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])} className={`p-4 rounded-2xl border ${tempPriceRange.includes(p.id) ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-50'}`}>
                    <Text className={`font-black ${tempPriceRange.includes(p.id) ? 'text-red-600' : 'text-gray-900'}`}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View className="flex-row space-x-3 pt-4 border-t border-gray-50 mt-4">
              <TouchableOpacity onPress={() => { setTempMinRating(null); setTempPriceRange([]); setMinRating(null); setPriceRange([]); setFilterModalVisible(false); }} className="flex-1 bg-gray-100 py-4 rounded-2xl items-center"><Text className="font-black">Xóa</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setMinRating(tempMinRating); setPriceRange(tempPriceRange); setFilterModalVisible(false); }} className="flex-[2] bg-red-600 py-4 rounded-2xl items-center"><Text className="text-white font-black">Áp dụng</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
