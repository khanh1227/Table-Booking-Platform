import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView 
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, LayoutGrid } from 'lucide-react-native';
import { fetchCollections, BASE_URL, getAbsoluteUrl } from '../../src/services/api';
import SafeImage from '../../src/components/SafeImage';

export default function CollectionsScreen() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await fetchCollections();
      setCollections(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      onPress={() => router.push(`/collections/${item.id}`)}
      className="flex-1 m-2 bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100"
    >
      <SafeImage 
        uri={item.image_url} 
        className="w-full h-56 bg-gray-100"
        resizeMode="cover"
      />
      <View className="p-4 bg-white/90 absolute bottom-0 left-0 right-0">
        <Text className="text-gray-900 font-bold text-sm" numberOfLines={1}>{item.title}</Text>
        <Text className="text-gray-500 text-[10px] mt-1">{item.items_count || 0} địa điểm</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center py-4 px-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <ChevronLeft size={28} color="#000" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Bộ sưu tập</Text>
      </View>

      <FlatList
        data={collections}
        numColumns={2}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 8 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#ef4444" className="mt-20" />
          ) : (
            <View className="items-center mt-20">
              <LayoutGrid size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-4">Chưa có bộ sưu tập nào</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
