import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, Image, ActivityIndicator, Alert } from 'react-native';
import { 
  User, 
  Settings, 
  ChevronRight, 
  LogOut, 
  Bell, 
  Shield, 
  CreditCard,
  Heart,
  Ticket,
  Store,
  Key,
  Star,
  Coins
} from 'lucide-react-native';
import { onLogout, fetchProfile, BASE_URL, getAbsoluteUrl } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import MainHeader from '../../src/components/MainHeader';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchProfile();
      setProfile(data);
    } catch (error) {
      console.error(error);
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) setProfile({ user: JSON.parse(userStr) });
    } finally {
      setLoading(false);
    }
  };

  const getAvatarUrl = () => {
    return getAbsoluteUrl(profile?.user?.avatar_url);
  };

  if (loading) return <ActivityIndicator size="large" color="#ef4444" className="flex-1" />;

  const user = profile?.user;
  const customer = profile?.customer;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <MainHeader title="Cá nhân" />
      <ScrollView className="flex-1">
        {/* Header Section */}
        <View className="bg-white px-6 pt-6 pb-8 shadow-sm border-b border-gray-100">
          <View className="flex-row items-center">
            <View className="relative">
              {getAvatarUrl() ? (
                <Image 
                  source={{ uri: getAvatarUrl() }} 
                  className="w-24 h-24 rounded-full border-4 border-gray-50"
                />
              ) : (
                <View className="w-24 h-24 bg-red-100 rounded-full items-center justify-center border-4 border-gray-50">
                  <User size={40} color="#ef4444" />
                </View>
              )}
              <TouchableOpacity 
                className="absolute bottom-0 right-0 bg-red-600 p-2 rounded-full border-2 border-white"
                onPress={() => router.push('/edit-profile')}
              >
                <Settings size={14} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View className="ml-6 flex-1">
              <Text className="text-2xl font-black text-gray-900 leading-tight">
                {user?.full_name || user?.phone_number || 'Khách hàng'}
              </Text>
              <View className="flex-row items-center mt-1">
                <View className="bg-red-50 px-2 py-0.5 rounded-full">
                  <Text className="text-red-600 text-[10px] font-bold uppercase">{user?.role || 'CUSTOMER'}</Text>
                </View>
              </View>
              <View className="flex-row items-center mt-3">
                <TouchableOpacity 
                  onPress={() => router.push('/edit-profile')}
                  className="bg-gray-100 px-4 py-2 rounded-xl"
                >
                  <Text className="text-gray-900 font-bold text-xs">Chỉnh sửa hồ sơ</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {customer && (
            <TouchableOpacity 
              onPress={() => router.push('/reward-vouchers')}
              className="mt-6 bg-gray-900 rounded-3xl p-6 flex-row items-center justify-between shadow-xl shadow-gray-200"
            >
              <View>
                <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Thành viên Thân thiết</Text>
                <View className="flex-row items-center">
                  <Coins size={24} color="#fbbf24" />
                  <Text className="text-white font-black text-2xl ml-2">{customer.loyalty_points || 0}</Text>
                  <Text className="text-gray-400 text-xs ml-2 font-bold">điểm</Text>
                </View>
              </View>
              <View className="bg-white/10 px-4 py-2 rounded-2xl flex-row items-center">
                <Text className="text-white text-xs font-bold mr-2">Săn ưu đãi</Text>
                <ChevronRight size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Menu Items */}
        <View className="px-6 py-8">
          <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-3 ml-2">Cài đặt ứng dụng</Text>
          
          <View className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <TouchableOpacity 
              onPress={() => router.push('/favorites')}
              className="flex-row items-center p-4 border-b border-gray-50"
            >
              <Heart size={20} color="#6b7280" />
              <Text className="flex-1 ml-4 text-gray-700 font-medium">Nhà hàng yêu thích</Text>
              <ChevronRight size={20} color="#d1d5db" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.push('/vouchers')}
              className="flex-row items-center p-4 border-b border-gray-50"
            >
              <Ticket size={20} color="#6b7280" />
              <Text className="flex-1 ml-4 text-gray-700 font-medium">Mã giảm giá</Text>
              <ChevronRight size={20} color="#d1d5db" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.push('/transactions')}
              className="flex-row items-center p-4 border-b border-gray-50"
            >
              <CreditCard size={20} color="#6b7280" />
              <Text className="flex-1 ml-4 text-gray-700 font-medium">Lịch sử giao dịch</Text>
              <ChevronRight size={20} color="#d1d5db" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.push('/register-partner')}
              className="flex-row items-center p-4 border-b border-gray-50"
            >
              <Store size={20} color="#6b7280" />
              <Text className="flex-1 ml-4 text-gray-700 font-medium">Trở thành đối tác</Text>
              <ChevronRight size={20} color="#d1d5db" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.push('/change-password')}
              className="flex-row items-center p-4"
            >
              <Key size={20} color="#6b7280" />
              <Text className="flex-1 ml-4 text-gray-700 font-medium">Đổi mật khẩu</Text>
              <ChevronRight size={20} color="#d1d5db" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.push('/notifications')}
              className="flex-row items-center p-4"
            >
              <Bell size={20} color="#6b7280" />
              <Text className="flex-1 ml-4 text-gray-700 font-medium">Thông báo</Text>
              <ChevronRight size={20} color="#d1d5db" />
            </TouchableOpacity>
          </View>

          <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-3 ml-2">Hỗ trợ & Pháp lý</Text>
          <View className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-8">
            <TouchableOpacity className="flex-row items-center p-4 border-b border-gray-50">
              <Shield size={20} color="#6b7280" />
              <Text className="flex-1 ml-4 text-gray-700 font-medium">Chính sách bảo mật</Text>
              <ChevronRight size={20} color="#d1d5db" />
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center p-4" onPress={onLogout}>
              <LogOut size={20} color="#ef4444" />
              <Text className="flex-1 ml-4 text-red-600 font-bold">Đăng xuất</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
