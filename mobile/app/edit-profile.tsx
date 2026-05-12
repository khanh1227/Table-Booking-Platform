import React, { useState, useEffect } from 'react';
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
import { ChevronLeft, Camera, User, Mail, MapPin, Calendar as CalendarIcon, Save } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { fetchProfile, updateProfile, uploadAvatar, getAbsoluteUrl } from '../src/services/api';

export default function EditProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    address: '',
    date_of_birth: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await fetchProfile();
      setProfile(data);
      setFormData({
        full_name: data.user?.full_name || '',
        email: data.user?.email || '',
        address: data.customer?.address || '',
        date_of_birth: data.customer?.date_of_birth || '',
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Không thể tải thông tin cá nhân');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Thông báo', 'Bạn cần cấp quyền truy cập thư viện ảnh để đổi ảnh đại diện');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        handleUploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
    }
  };

  const handleUploadAvatar = async (uri: string) => {
    try {
      setSubmitting(true);
      const formData = new FormData();
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : `image`;

      // @ts-ignore
      formData.append('avatar', { uri, name: filename, type });

      await uploadAvatar(formData);
      Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện');
      loadProfile();
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Không thể tải ảnh lên');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.full_name) {
      Alert.alert('Lỗi', 'Họ tên không được để trống');
      return;
    }

    try {
      setSubmitting(true);
      await updateProfile(formData);
      Alert.alert('Thành công', 'Đã cập nhật thông tin cá nhân');
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Không thể cập nhật thông tin');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#ef4444" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-50">
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={28} color="#000" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Chỉnh sửa hồ sơ</Text>
        <TouchableOpacity onPress={handleSave} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <Save size={24} color="#ef4444" />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-6">
          <View className="items-center my-10">
            <View className="relative">
              {profile?.user?.avatar_url ? (
                <Image 
                  source={{ uri: getAbsoluteUrl(profile.user.avatar_url) }} 
                  className="w-32 h-32 rounded-full border-4 border-gray-50"
                />
              ) : (
                <View className="w-32 h-32 bg-red-50 rounded-full items-center justify-center border-4 border-gray-50">
                  <User size={60} color="#ef4444" />
                </View>
              )}
              <TouchableOpacity 
                onPress={pickImage}
                className="absolute bottom-0 right-0 bg-red-600 p-3 rounded-full border-4 border-white shadow-lg"
              >
                <Camera size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text className="text-gray-400 mt-4 text-sm font-medium">Chạm vào icon máy ảnh để đổi ảnh</Text>
          </View>

          <View className="space-y-6">
            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Họ và tên</Text>
              <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100">
                <User size={20} color="#9ca3af" />
                <TextInput
                  className="flex-1 ml-3 text-gray-900 font-medium"
                  placeholder="Nhập họ và tên"
                  value={formData.full_name}
                  onChangeText={(val) => setFormData({...formData, full_name: val})}
                />
              </View>
            </View>

            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Email</Text>
              <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100">
                <Mail size={20} color="#9ca3af" />
                <TextInput
                  className="flex-1 ml-3 text-gray-900 font-medium"
                  placeholder="Nhập email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={formData.email}
                  onChangeText={(val) => setFormData({...formData, email: val})}
                />
              </View>
            </View>

            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Địa chỉ</Text>
              <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100">
                <MapPin size={20} color="#9ca3af" />
                <TextInput
                  className="flex-1 ml-3 text-gray-900 font-medium"
                  placeholder="Nhập địa chỉ"
                  value={formData.address}
                  onChangeText={(val) => setFormData({...formData, address: val})}
                />
              </View>
            </View>

            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Ngày sinh</Text>
              <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100">
                <CalendarIcon size={20} color="#9ca3af" />
                <TextInput
                  className="flex-1 ml-3 text-gray-900 font-medium"
                  placeholder="YYYY-MM-DD"
                  value={formData.date_of_birth}
                  onChangeText={(val) => setFormData({...formData, date_of_birth: val})}
                />
              </View>
            </View>

            <View className="mt-8 mb-10">
              <TouchableOpacity 
                onPress={handleSave}
                disabled={submitting}
                className={`w-full py-4 rounded-2xl items-center shadow-lg ${submitting ? 'bg-gray-300' : 'bg-red-600 shadow-red-200'}`}
              >
                <Text className="text-white font-black text-lg">Lưu thay đổi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
