import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView,
  TextInput,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { Search, Plus, Calendar, User, Eye, ArrowRight, ChevronLeft, Heart } from 'lucide-react-native';
import { fetchPosts, BASE_URL, getAbsoluteUrl } from '../../../src/services/api';

const CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'NEWS', label: 'Tin tức' },
  { id: 'RECRUITMENT', label: 'Tuyển dụng' },
  { id: 'SEEKING', label: 'Tìm việc' },
  { id: 'REVIEW', label: 'Review' },
];

export default function CommunityScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [activeCategory]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchPosts(activeCategory, query);
      setPosts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      onPress={() => router.push(`/community/${item.slug}`)}
      className="bg-white mb-4 rounded-3xl overflow-hidden border border-gray-100 shadow-sm"
    >
      <Image 
        source={{ uri: getAbsoluteUrl(item.thumbnail) || 'https://via.placeholder.com/600x400' }} 
        className="w-full h-48 bg-gray-100"
      />
      <View className="p-4">
        <View className="flex-row items-center mb-2">
          <View className="bg-red-50 px-2 py-0.5 rounded-full">
            <Text className="text-red-600 text-[10px] font-bold uppercase">{item.category_display}</Text>
          </View>
          <Text className="text-gray-400 text-[10px] ml-2">
            {new Date(item.created_at).toLocaleDateString('vi-VN')}
          </Text>
        </View>
        <Text className="text-lg font-bold text-gray-900 mb-2" numberOfLines={2}>{item.title}</Text>
        <Text className="text-gray-500 text-xs mb-4" numberOfLines={2}>{item.excerpt}</Text>
        <View className="flex-row justify-between items-center pt-3 border-t border-gray-50">
          <View className="flex-row items-center">
            <User size={12} color="#9ca3af" />
            <Text className="text-gray-400 text-[10px] ml-1 mr-3">{item.author_name}</Text>
            
            <Heart size={12} color="#9ca3af" />
            <Text className="text-gray-400 text-[10px] ml-1 mr-3">{item.likes_count || 0}</Text>
            
            <Eye size={12} color="#9ca3af" />
            <Text className="text-gray-400 text-[10px] ml-1">{item.views_count}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center py-4 px-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <ChevronLeft size={28} color="#000" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Cộng đồng</Text>
      </View>

      <View className="px-4 mb-4">
        <View className="flex-row items-center bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-4">
          <Search size={20} color="#9ca3af" />
          <TextInput
            placeholder="Tìm kiếm bài viết..."
            className="flex-1 ml-2 text-gray-700"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={loadData}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
          {CATEGORIES.map(cat => (
            <TouchableOpacity 
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              className={`px-6 py-2 rounded-full mr-2 border ${activeCategory === cat.id ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-100'}`}
            >
              <Text className={`text-xs font-bold ${activeCategory === cat.id ? 'text-white' : 'text-gray-600'}`}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#ef4444" className="mt-20" />
          ) : (
            <View className="items-center mt-20">
              <Text className="text-gray-400">Chưa có bài viết nào</Text>
            </View>
          )
        }
        onRefresh={loadData}
        refreshing={loading}
      />

      <TouchableOpacity 
        className="absolute bottom-6 right-6 bg-red-600 w-14 h-14 rounded-full items-center justify-center shadow-lg shadow-red-300"
        onPress={() => router.push('/community/create')}
      >
        <Plus size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
