import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView 
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Heart } from 'lucide-react-native';
import { fetchFavorites } from '../src/services/api';
import RestaurantCard from '../src/components/RestaurantCard';

export default function FavoritesScreen() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await fetchFavorites();
      setRestaurants(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center py-4 px-4 border-b border-gray-100 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <ChevronLeft size={28} color="#000" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Yêu thích</Text>
      </View>

      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <RestaurantCard restaurant={item} />}
        contentContainerStyle={{ paddingVertical: 16 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#ef4444" className="mt-20" />
          ) : (
            <View className="items-center mt-20 px-10 text-center">
              <Heart size={64} color="#d1d5db" fill="#f3f4f6" />
              <Text className="text-gray-900 font-bold text-lg mt-6">Chưa có yêu thích nào</Text>
              <Text className="text-gray-400 text-center mt-2">
                Hãy thả tim cho những nhà hàng bạn yêu thích để xem lại tại đây nhé.
              </Text>
              <TouchableOpacity 
                onPress={() => router.replace('/(tabs)/explore')}
                className="mt-8 bg-red-600 px-8 py-3 rounded-2xl"
              >
                <Text className="text-white font-bold">Khám phá ngay</Text>
              </TouchableOpacity>
            </View>
          )
        }
        onRefresh={loadData}
        refreshing={loading}
      />
    </SafeAreaView>
  );
}
