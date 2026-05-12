import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView, 
  Image, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Camera, Send, FileText, MapPin, DollarSign, List } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { createPost } from '../../../src/services/api';

const CATEGORIES = [
  { id: 'NEWS', label: 'Tin tức' },
  { id: 'RECRUITMENT', label: 'Tuyển dụng' },
  { id: 'SEEKING', label: 'Tìm việc' },
  { id: 'REVIEW', label: 'Review' },
];

export default function CreatePostScreen() {
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'NEWS',
    content: '',
    excerpt: '',
    location_city: '',
    salary_text: '',
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.content) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ tiêu đề và nội dung');
      return;
    }

    try {
      setLoading(true);
      const data = new FormData();
      data.append('title', formData.title);
      data.append('category', formData.category);
      data.append('content', formData.content);
      data.append('excerpt', formData.excerpt || formData.content.substring(0, 100));
      data.append('location_city', formData.location_city);
      data.append('salary_text', formData.salary_text);

      if (image) {
        const filename = image.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;
        // @ts-ignore
        data.append('thumbnail', { uri: image, name: filename, type });
      }

      await createPost(data);
      Alert.alert('Thành công', 'Bài viết của bạn đã được gửi và đang chờ duyệt');
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Không thể đăng bài viết. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-50">
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={28} color="#000" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Đăng bài mới</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <Send size={24} color="#ef4444" />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-6">
          <TouchableOpacity 
            onPress={pickImage}
            className="w-full h-48 bg-gray-50 rounded-3xl mt-6 items-center justify-center border-2 border-dashed border-gray-200 overflow-hidden"
          >
            {image ? (
              <Image source={{ uri: image }} className="w-full h-full" />
            ) : (
              <View className="items-center">
                <Camera size={40} color="#9ca3af" />
                <Text className="text-gray-400 mt-2 font-medium">Thêm ảnh bìa</Text>
              </View>
            )}
          </TouchableOpacity>

          <View className="mt-8 space-y-6">
            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Tiêu đề</Text>
              <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100">
                <FileText size={20} color="#9ca3af" />
                <TextInput
                  className="flex-1 ml-3 text-gray-900 font-medium"
                  placeholder="Nhập tiêu đề bài viết"
                  value={formData.title}
                  onChangeText={(val) => setFormData({...formData, title: val})}
                />
              </View>
            </View>

            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Danh mục</Text>
              <View className="flex-row flex-wrap">
                {CATEGORIES.map(cat => (
                  <TouchableOpacity 
                    key={cat.id}
                    onPress={() => setFormData({...formData, category: cat.id})}
                    className={`px-4 py-2 rounded-full mr-2 mb-2 border ${formData.category === cat.id ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}
                  >
                    <Text className={`text-xs font-bold ${formData.category === cat.id ? 'text-white' : 'text-gray-600'}`}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Nội dung</Text>
              <View className="bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100 min-h-[200]">
                <TextInput
                  className="text-gray-900 font-medium leading-6"
                  placeholder="Chia sẻ nội dung của bạn..."
                  multiline
                  textAlignVertical="top"
                  value={formData.content}
                  onChangeText={(val) => setFormData({...formData, content: val})}
                />
              </View>
            </View>

            <View className="flex-row space-x-4">
              <View className="flex-1">
                <Text className="text-gray-700 font-bold mb-2 ml-1">Khu vực</Text>
                <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100">
                  <MapPin size={18} color="#9ca3af" />
                  <TextInput
                    className="flex-1 ml-2 text-gray-900 font-medium text-xs"
                    placeholder="TP. HCM, v.v."
                    value={formData.location_city}
                    onChangeText={(val) => setFormData({...formData, location_city: val})}
                  />
                </View>
              </View>
              <View className="flex-1">
                <Text className="text-gray-700 font-bold mb-2 ml-1">Lương (nếu có)</Text>
                <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100">
                  <DollarSign size={18} color="#9ca3af" />
                  <TextInput
                    className="flex-1 ml-2 text-gray-900 font-medium text-xs"
                    placeholder="VD: 5-7tr"
                    value={formData.salary_text}
                    onChangeText={(val) => setFormData({...formData, salary_text: val})}
                  />
                </View>
              </View>
            </View>

            <View className="mt-8 mb-10">
              <TouchableOpacity 
                onPress={handleSubmit}
                disabled={loading}
                className={`w-full py-4 rounded-2xl items-center shadow-lg ${loading ? 'bg-gray-300' : 'bg-red-600 shadow-red-200'}`}
              >
                <Text className="text-white font-black text-lg">ĐĂNG BÀI NGAY</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
