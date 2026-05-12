import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, Heart } from 'lucide-react-native';
import { fetchCollectionDetail, BASE_URL, getAbsoluteUrl } from '../../src/services/api';
import RestaurantCard from '../../src/components/RestaurantCard';
import SafeImage from '../../src/components/SafeImage';

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams();
  const [collection, setCollection] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const data = await fetchCollectionDetail(id as string);
      setCollection(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#ef4444" className="flex-1" />;

  if (!collection) return (
    <View className="flex-1 items-center justify-center">
      <Text>Không tìm thấy bộ sưu tập</Text>
      <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-red-600 px-6 py-2 rounded-xl">
        <Text className="text-white">Quay lại</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="relative">
        <SafeImage 
          uri={collection.image_url} 
          className="w-full h-64"
          resizeMode="cover"
        />
        <View className="absolute top-10 left-4">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="bg-white/80 p-2 rounded-full shadow-md"
          >
            <ChevronLeft size={24} color="#000" />
          </TouchableOpacity>
        </View>
        <View className="absolute bottom-0 left-0 right-0 p-6 bg-black/60">
          <Text className="text-white text-3xl font-black mb-1">{collection.title}</Text>
          <Text className="text-white/80 text-sm">{collection.description}</Text>
        </View>
      </View>

      <FlatList
        data={collection.items || []}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <RestaurantCard restaurant={item.restaurant} />}
        contentContainerStyle={{ paddingVertical: 16 }}
        ListEmptyComponent={
          <View className="items-center mt-10">
            <Text className="text-gray-400 italic">Chưa có nhà hàng nào trong bộ sưu tập này</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
