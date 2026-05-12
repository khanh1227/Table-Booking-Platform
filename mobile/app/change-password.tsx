import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Lock } from 'lucide-react-native';
import { changePassword } from '../src/services/api';

export default function ChangePasswordScreen() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  const handleSubmit = async () => {
    if (!form.old_password || !form.new_password || !form.confirm_password) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (form.new_password !== form.confirm_password) {
      Alert.alert('Lỗi', 'Mật khẩu mới không khớp');
      return;
    }

    try {
      setLoading(true);
      await changePassword(form);
      Alert.alert('Thành công', 'Đổi mật khẩu thành công!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error || 'Đổi mật khẩu thất bại';
      Alert.alert('Lỗi', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-row items-center py-4 px-4 border-b border-gray-100">
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={28} color="#000" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900 ml-4">Đổi mật khẩu</Text>
        </View>

        <ScrollView className="flex-1 p-6">
          <View className="items-center mb-8">
            <View className="bg-gray-100 p-6 rounded-full mb-4">
              <Lock size={48} color="#6b7280" />
            </View>
            <Text className="text-gray-500 text-center">Bảo vệ tài khoản của bạn bằng mật khẩu mạnh</Text>
          </View>

          <View className="space-y-6">
            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Mật khẩu hiện tại</Text>
              <View className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                <TextInput
                  placeholder="••••••••"
                  secureTextEntry
                  className="text-gray-700"
                  value={form.old_password}
                  onChangeText={(val) => setForm({...form, old_password: val})}
                />
              </View>
            </View>

            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Mật khẩu mới</Text>
              <View className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                <TextInput
                  placeholder="••••••••"
                  secureTextEntry
                  className="text-gray-700"
                  value={form.new_password}
                  onChangeText={(val) => setForm({...form, new_password: val})}
                />
              </View>
              <Text className="text-gray-400 text-[10px] mt-1 ml-1">Tối thiểu 6 ký tự</Text>
            </View>

            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Xác nhận mật khẩu mới</Text>
              <View className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                <TextInput
                  placeholder="••••••••"
                  secureTextEntry
                  className="text-gray-700"
                  value={form.confirm_password}
                  onChangeText={(val) => setForm({...form, confirm_password: val})}
                />
              </View>
            </View>

            <TouchableOpacity 
              onPress={handleSubmit}
              disabled={loading}
              className={`py-4 rounded-2xl items-center shadow-lg mt-6 ${loading ? 'bg-gray-300' : 'bg-gray-900 shadow-gray-200'}`}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black text-lg uppercase">Lưu thay đổi</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
