import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Mail, Lock, User, Phone, ChevronLeft, Utensils } from 'lucide-react-native';
import { router } from 'expo-router';
import { onRegister } from '../src/services/api';
import Logo from '../src/components/Logo';

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    const { full_name, phone_number, email, password, confirmPassword } = formData;

    if (!full_name || !phone_number || !password) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ các thông tin bắt buộc');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setSubmitting(true);
      await onRegister({
        full_name,
        phone_number,
        password,
        email: email || undefined,
      });
      Alert.alert('Thành công', 'Đăng ký tài khoản thành công! Vui lòng đăng nhập.', [
        { text: 'Đăng nhập ngay', onPress: () => router.replace('/login') }
      ]);
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.error || 'Đăng ký thất bại';
      Alert.alert('Lỗi', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-6">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="mt-4 mb-6"
          >
            <ChevronLeft size={28} color="#000" />
          </TouchableOpacity>

          <View className="items-center mb-10">
            <Logo size="lg" />
            <Text className="text-gray-400 mt-2">Bắt đầu hành trình ẩm thực của bạn</Text>
          </View>

          <View className="space-y-4">
            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Họ và tên *</Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                <User size={20} color="#9ca3af" />
                <TextInput
                  placeholder="Nguyễn Văn A"
                  className="flex-1 ml-3 text-gray-700"
                  value={formData.full_name}
                  onChangeText={(val) => setFormData({ ...formData, full_name: val })}
                />
              </View>
            </View>

            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Số điện thoại *</Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                <Phone size={20} color="#9ca3af" />
                <TextInput
                  placeholder="0912345678"
                  keyboardType="phone-pad"
                  className="flex-1 ml-3 text-gray-700"
                  value={formData.phone_number}
                  onChangeText={(val) => setFormData({ ...formData, phone_number: val })}
                />
              </View>
            </View>

            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Email (Không bắt buộc)</Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                <Mail size={20} color="#9ca3af" />
                <TextInput
                  placeholder="example@gmail.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="flex-1 ml-3 text-gray-700"
                  value={formData.email}
                  onChangeText={(val) => setFormData({ ...formData, email: val })}
                />
              </View>
            </View>

            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Mật khẩu *</Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                <Lock size={20} color="#9ca3af" />
                <TextInput
                  placeholder="••••••••"
                  secureTextEntry
                  className="flex-1 ml-3 text-gray-700"
                  value={formData.password}
                  onChangeText={(val) => setFormData({ ...formData, password: val })}
                />
              </View>
            </View>

            <View>
              <Text className="text-gray-700 font-bold mb-2 ml-1">Xác nhận mật khẩu *</Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                <Lock size={20} color="#9ca3af" />
                <TextInput
                  placeholder="••••••••"
                  secureTextEntry
                  className="flex-1 ml-3 text-gray-700"
                  value={formData.confirmPassword}
                  onChangeText={(val) => setFormData({ ...formData, confirmPassword: val })}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity 
            onPress={handleRegister}
            disabled={submitting}
            className={`mt-10 py-4 rounded-2xl items-center shadow-lg ${submitting ? 'bg-gray-300' : 'bg-red-600 shadow-red-200'}`}
          >
            <Text className="text-white font-black text-lg">
              {submitting ? 'ĐANG XỬ LÝ...' : 'ĐĂNG KÝ NGAY'}
            </Text>
          </TouchableOpacity>

          <View className="flex-row justify-center mt-8 mb-10">
            <Text className="text-gray-500">Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text className="text-red-600 font-bold">Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
