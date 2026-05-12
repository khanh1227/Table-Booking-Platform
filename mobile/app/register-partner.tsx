import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Store, MapPin, Phone, User, Mail, Lock } from 'lucide-react-native';
import api from '../src/services/api';

export default function RegisterPartnerScreen() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    phone_number: '',
    email: '',
    restaurant_name: '',
    address: '',
    city: '',
    district: '',
  });

  const handleSubmit = async () => {
    // Basic validation
    const required = ['username', 'password', 'full_name', 'phone_number', 'restaurant_name', 'address', 'city', 'district'];
    for (const field of required) {
      if (!formData[field as keyof typeof formData]) {
        Alert.alert('Lỗi', `Vui lòng điền đầy đủ: ${field}`);
        return;
      }
    }

    try {
      setLoading(true);
      const res = await api.post('/api/accounts/register-partner/', formData);
      Alert.alert('Thành công', 'Đăng ký đối tác thành công! Vui lòng chờ quản trị viên phê duyệt.', [
        { text: 'Về trang chủ', onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error || 'Đăng ký thất bại';
      Alert.alert('Lỗi', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center py-4 px-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={28} color="#000" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 ml-4">Trở thành đối tác</Text>
      </View>

      <ScrollView className="flex-1 p-6">
        <View className="bg-orange-50 p-6 rounded-3xl mb-8 items-center">
          <Store size={48} color="#f97316" />
          <Text className="text-xl font-black text-gray-900 mt-4 text-center">Đăng ký kinh doanh cùng DatBanAn</Text>
          <Text className="text-gray-500 text-sm text-center mt-2">Tiếp cận hàng ngàn khách hàng tiềm năng mỗi ngày</Text>
        </View>

        <View className="space-y-6 pb-10">
          <SectionTitle title="Thông tin tài khoản" />
          <InputField 
            label="Tên đăng nhập *" 
            icon={<User size={20} color="#9ca3af" />} 
            value={formData.username}
            onChange={(val) => setFormData({...formData, username: val})}
          />
          <InputField 
            label="Mật khẩu *" 
            icon={<Lock size={20} color="#9ca3af" />} 
            secure 
            value={formData.password}
            onChange={(val) => setFormData({...formData, password: val})}
          />

          <SectionTitle title="Thông tin chủ sở hữu" />
          <InputField 
            label="Họ và tên *" 
            icon={<User size={20} color="#9ca3af" />} 
            value={formData.full_name}
            onChange={(val) => setFormData({...formData, full_name: val})}
          />
          <InputField 
            label="Số điện thoại *" 
            icon={<Phone size={20} color="#9ca3af" />} 
            keyboard="phone-pad"
            value={formData.phone_number}
            onChange={(val) => setFormData({...formData, phone_number: val})}
          />
          <InputField 
            label="Email" 
            icon={<Mail size={20} color="#9ca3af" />} 
            keyboard="email-address"
            value={formData.email}
            onChange={(val) => setFormData({...formData, email: val})}
          />

          <SectionTitle title="Thông tin nhà hàng" />
          <InputField 
            label="Tên nhà hàng *" 
            icon={<Store size={20} color="#9ca3af" />} 
            value={formData.restaurant_name}
            onChange={(val) => setFormData({...formData, restaurant_name: val})}
          />
          <InputField 
            label="Địa chỉ chi tiết *" 
            icon={<MapPin size={20} color="#9ca3af" />} 
            value={formData.address}
            onChange={(val) => setFormData({...formData, address: val})}
          />
          <View className="flex-row gap-4">
            <View className="flex-1">
              <InputField 
                label="Thành phố *" 
                value={formData.city}
                onChange={(val) => setFormData({...formData, city: val})}
              />
            </View>
            <View className="flex-1">
              <InputField 
                label="Quận/Huyện *" 
                value={formData.district}
                onChange={(val) => setFormData({...formData, district: val})}
              />
            </View>
          </View>

          <TouchableOpacity 
            onPress={handleSubmit}
            disabled={loading}
            className={`py-4 rounded-2xl items-center shadow-lg mt-6 ${loading ? 'bg-gray-300' : 'bg-orange-600 shadow-orange-200'}`}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black text-lg">ĐĂNG KÝ ĐỐI TÁC</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-4 mb-2">{title}</Text>;
}

function InputField({ label, icon, secure, keyboard, value, onChange }: any) {
  return (
    <View className="mb-4">
      <Text className="text-gray-700 font-bold mb-2 ml-1">{label}</Text>
      <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
        {icon}
        <TextInput
          secureTextEntry={secure}
          keyboardType={keyboard || 'default'}
          className={`flex-1 ${icon ? 'ml-3' : ''} text-gray-700`}
          value={value}
          onChangeText={onChange}
        />
      </View>
    </View>
  );
}
