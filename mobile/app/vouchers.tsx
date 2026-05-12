import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView 
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Ticket, Clock, CheckCircle2, Gift } from 'lucide-react-native';
import { fetchUserVouchers } from '../src/services/api';

export default function VouchersScreen() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await fetchUserVouchers();
      setVouchers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View className={`flex-row mb-4 bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm ${item.is_used ? 'opacity-50' : ''}`}>
      <View className="w-24 bg-red-50 items-center justify-center border-r border-dashed border-red-100 py-6">
        <Text className="text-red-600 font-black text-xl">
          {item.voucher_type === 'PERCENTAGE' ? `${item.discount_value}%` : `${item.discount_value / 1000}k`}
        </Text>
        <Text className="text-red-400 text-[10px] font-bold mt-1">OFF</Text>
      </View>
      
      <View className="flex-1 p-4 justify-center">
        <Text className="text-gray-900 font-bold text-sm mb-1">{item.code}</Text>
        <Text className="text-gray-500 text-[10px] mb-2">{item.description || 'Ưu đãi đặt bàn'}</Text>
        <View className="flex-row items-center">
          <Clock size={10} color="#9ca3af" />
          <Text className="text-gray-400 text-[10px] ml-1">HSD: {new Date(item.valid_to).toLocaleDateString('vi-VN')}</Text>
        </View>
      </View>

      <View className="pr-4 justify-center">
        {item.is_used ? (
          <CheckCircle2 size={20} color="#d1d5db" />
        ) : (
          <TouchableOpacity className="bg-red-600 px-3 py-1.5 rounded-full">
            <Text className="text-white text-[10px] font-bold">DÙNG NGAY</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center justify-between py-4 px-4 border-b border-gray-100 bg-white">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={28} color="#000" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Ví ưu đãi</Text>
        </View>
        <TouchableOpacity 
          onPress={() => router.push('/reward-vouchers')}
          className="flex-row items-center bg-orange-50 px-3 py-1.5 rounded-full"
        >
          <Gift size={14} color="#f97316" />
          <Text className="text-orange-700 font-bold text-xs ml-1">Săn mã</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={vouchers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#ef4444" className="mt-20" />
          ) : (
            <View className="items-center mt-20">
              <Ticket size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-4">Bạn chưa có mã giảm giá nào</Text>
            </View>
          )
        }
        onRefresh={loadData}
        refreshing={loading}
      />
    </SafeAreaView>
  );
}
