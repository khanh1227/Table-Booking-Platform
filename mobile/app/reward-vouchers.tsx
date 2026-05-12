import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView, 
  Alert,
  Image
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Ticket, Gift, Star, CheckCircle2, Coins } from 'lucide-react-native';
import { fetchRewardVouchers, collectVoucher, fetchProfile } from '../src/services/api';

export default function RewardVouchersScreen() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userPoints, setUserPoints] = useState(0);
  const [collecting, setCollecting] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [vData, pData] = await Promise.all([
        fetchRewardVouchers(),
        fetchProfile()
      ]);
      setVouchers(vData);
      setUserPoints(pData.loyalty_points || 0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCollect = async (voucherId: number) => {
    try {
      setCollecting(voucherId);
      await collectVoucher(voucherId);
      Alert.alert('Thành công', 'Bạn đã thu thập mã giảm giá này!');
      // Update local points if needed or just reload
      loadData();
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error || 'Không thể thu thập voucher này';
      Alert.alert('Lỗi', msg);
    } finally {
      setCollecting(null);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View className="bg-white rounded-3xl mb-4 border border-gray-100 shadow-sm overflow-hidden">
      <View className="flex-row">
        <View className="w-24 bg-orange-50 items-center justify-center border-r border-dashed border-orange-100 py-8">
          <Gift size={32} color="#f97316" />
        </View>
        
        <View className="flex-1 p-4">
          <View className="flex-row justify-between items-start mb-1">
            <Text className="text-gray-900 font-bold text-base flex-1" numberOfLines={1}>{item.code}</Text>
            <View className="flex-row items-center bg-orange-100 px-2 py-0.5 rounded-full">
              <Coins size={10} color="#f97316" />
              <Text className="text-orange-700 text-[10px] font-bold ml-1">{item.points_required} pts</Text>
            </View>
          </View>
          <Text className="text-gray-500 text-xs mb-3" numberOfLines={2}>{item.description || 'Ưu đãi đặc biệt dành cho bạn'}</Text>
          
          <TouchableOpacity 
            onPress={() => handleCollect(item.id)}
            disabled={collecting !== null || userPoints < item.points_required}
            className={`py-2 rounded-xl items-center ${userPoints >= item.points_required ? 'bg-orange-600' : 'bg-gray-200'}`}
          >
            {collecting === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className={`font-bold text-xs ${userPoints >= item.points_required ? 'text-white' : 'text-gray-400'}`}>
                {userPoints >= item.points_required ? 'ĐỔI NGAY' : 'CHƯA ĐỦ ĐIỂM'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-4 py-4 flex-row items-center justify-between border-b border-gray-100">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={28} color="#000" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Săn ưu đãi</Text>
        </View>
        <View className="bg-orange-50 px-3 py-1.5 rounded-2xl flex-row items-center">
          <Coins size={16} color="#f97316" />
          <Text className="text-orange-700 font-black ml-1">{userPoints}</Text>
        </View>
      </View>

      <FlatList
        data={vouchers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View className="mb-6">
            <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Ưu đãi hôm nay</Text>
            <Text className="text-gray-900 font-bold text-sm">Dùng điểm tích lũy để đổi các mã giảm giá hấp dẫn</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#ef4444" className="mt-20" />
          ) : (
            <View className="items-center mt-20">
              <Ticket size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-4">Hiện chưa có ưu đãi mới</Text>
            </View>
          )
        }
        onRefresh={loadData}
        refreshing={loading}
      />
    </SafeAreaView>
  );
}
