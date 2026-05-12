import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  Image, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, Star, Camera, Send } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { createReview } from '../src/services/api';

export default function WriteReviewScreen() {
  const { bookingId, restaurantId, restaurantName } = useLocalSearchParams();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!comment) {
      Alert.alert('Lỗi', 'Vui lòng nhập nhận xét của bạn');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('booking', bookingId as string);
      formData.append('restaurant', restaurantId as string);
      formData.append('rating', rating.toString());
      formData.append('comment', comment);

      if (image) {
        const filename = image.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;
        // @ts-ignore
        formData.append('images', { uri: image, name: filename, type });
      }

      await createReview(formData);
      Alert.alert('Thành công', 'Cảm ơn bạn đã đánh giá trải nghiệm!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.non_field_errors?.[0] || 
                  error.response?.data?.booking?.[0] || 
                  'Không thể gửi đánh giá';
      Alert.alert('Lỗi', msg);
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
        <Text className="text-xl font-bold text-gray-900">Đánh giá trải nghiệm</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 p-6">
          <View className="items-center mb-8">
            <Text className="text-gray-500 text-center mb-2">Bạn thấy thế nào về</Text>
            <Text className="text-xl font-black text-gray-900 text-center mb-6">{restaurantName}</Text>
            
            <View className="flex-row">
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setRating(s)} className="mx-2">
                  <Star 
                    size={40} 
                    color={s <= rating ? "#f97316" : "#d1d5db"} 
                    fill={s <= rating ? "#f97316" : "transparent"} 
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text className="text-orange-500 font-bold mt-4">
              {rating === 5 ? 'Tuyệt vời!' : rating === 4 ? 'Rất tốt' : rating === 3 ? 'Bình thường' : rating === 2 ? 'Kém' : 'Rất tệ'}
            </Text>
          </View>

          <View className="mb-6">
            <Text className="text-gray-700 font-bold mb-3">Nhận xét của bạn</Text>
            <View className="bg-gray-50 border border-gray-100 rounded-3xl p-4 min-h-[150]">
              <TextInput
                placeholder="Chia sẻ trải nghiệm của bạn tại đây..."
                multiline
                textAlignVertical="top"
                className="text-gray-700 leading-6"
                value={comment}
                onChangeText={setComment}
              />
            </View>
          </View>

          <View className="mb-8">
            <Text className="text-gray-700 font-bold mb-3">Thêm hình ảnh</Text>
            <TouchableOpacity 
              onPress={pickImage}
              className="w-32 h-32 bg-gray-50 rounded-3xl items-center justify-center border-2 border-dashed border-gray-200 overflow-hidden"
            >
              {image ? (
                <Image source={{ uri: image }} className="w-full h-full" />
              ) : (
                <Camera size={32} color="#9ca3af" />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={handleSubmit}
            disabled={loading}
            className={`py-4 rounded-2xl items-center shadow-lg mb-10 ${loading ? 'bg-gray-300' : 'bg-red-600 shadow-red-200'}`}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View className="flex-row items-center">
                <Text className="text-white font-black text-lg mr-2 uppercase">Gửi đánh giá</Text>
                <Send size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
