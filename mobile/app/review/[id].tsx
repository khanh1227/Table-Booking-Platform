import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Star, ChevronLeft, MessageCircle } from 'lucide-react-native';
import { submitReview } from '../../src/services/api';

export default function ReviewScreen() {
  const { id, restaurantId, restaurantName } = useLocalSearchParams();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn số sao đánh giá');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('booking', id as string);
      formData.append('restaurant', restaurantId as string);
      formData.append('rating', rating.toString());
      if (comment) formData.append('comment', comment);

      await submitReview(formData);
      Alert.alert('Thành công', 'Cảm ơn bạn đã gửi đánh giá!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Lỗi', 'Gửi đánh giá thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center py-4 px-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <ChevronLeft size={28} color="#000" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Đánh giá</Text>
      </View>

      <ScrollView className="flex-1 p-6">
        <View className="items-center mb-8">
          <View className="bg-orange-50 p-6 rounded-full mb-4">
            <MessageCircle size={48} color="#f97316" />
          </View>
          <Text className="text-2xl font-black text-center text-gray-900 mb-2">Trải nghiệm của bạn tại</Text>
          <Text className="text-orange-600 font-bold text-lg text-center">{restaurantName}</Text>
        </View>

        <View className="items-center mb-10">
          <Text className="text-gray-500 mb-4 font-medium">Chạm để chọn số sao</Text>
          <View className="flex-row">
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setRating(s)} className="mx-2">
                <Star 
                  size={48} 
                  color={s <= rating ? "#f97316" : "#d1d5db"} 
                  fill={s <= rating ? "#f97316" : "transparent"} 
                />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text className="mt-4 text-orange-600 font-black text-xl">
              {rating === 5 ? 'Tuyệt vời! 😍' : rating === 4 ? 'Rất tốt! 😊' : rating === 3 ? 'Bình thường 😐' : 'Chưa hài lòng 😞'}
            </Text>
          )}
        </View>

        <View className="mb-10">
          <Text className="text-gray-700 font-bold mb-3">Cảm nhận chi tiết</Text>
          <TextInput
            placeholder="Món ăn thế nào? Phục vụ ra sao?..."
            multiline
            numberOfLines={5}
            className="bg-gray-50 border border-gray-100 rounded-3xl p-5 text-gray-700 h-40"
            textAlignVertical="top"
            value={comment}
            onChangeText={setComment}
          />
        </View>

        <TouchableOpacity 
          className={`py-4 rounded-2xl items-center shadow-lg ${loading ? 'bg-gray-300' : 'bg-orange-600 shadow-orange-200'}`}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-black text-lg">GỬI ĐÁNH GIÁ</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
