import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { onLogin } from '../src/services/api';
import { Lock, Phone } from 'lucide-react-native';
import Logo from '../src/components/Logo';

export default function LoginScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phoneNumber || !password) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ thông tin');
      return;
    }

    try {
      setLoading(true);
      await onLogin(phoneNumber, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Lỗi', error.response?.data?.error || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 px-8 justify-center"
      >
        <View className="items-center mb-10">
          <Logo size="lg" />
          <Text className="text-gray-400 mt-2">Chào mừng bạn quay trở lại</Text>
        </View>

        <Text className="text-3xl font-black text-gray-900 mb-6">Đăng nhập</Text>

        <View>
          <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 mb-4">
            <Phone size={20} color="#6b7280" />
            <TextInput
              placeholder="Số điện thoại"
              className="flex-1 ml-3 text-gray-700"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />
          </View>

          <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 mb-8">
            <Lock size={20} color="#6b7280" />
            <TextInput
              placeholder="Mật khẩu"
              className="flex-1 ml-3 text-gray-700"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            onPress={handleLogin}
            disabled={loading}
            className={`py-4 rounded-2xl items-center shadow-lg ${loading ? 'bg-red-400' : 'bg-red-600 shadow-red-200'}`}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-black text-lg">ĐĂNG NHẬP</Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center mt-10">
          <Text className="text-gray-500">Chưa có tài khoản? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text className="text-red-600 font-bold">Đăng ký ngay</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
