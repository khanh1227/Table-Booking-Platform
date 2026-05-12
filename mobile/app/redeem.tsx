import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView, 
  Alert 
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Gift, Star, Ticket } from 'lucide-react-native';
import { fetchRewardVouchers, collectVoucher, fetchProfile } from '../src/services/api';

export default function RedeemScreen() {
  const [vouchers, setVouchers] = useState([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);

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
      // Filter vouchers that have a cost
      setVouchers(vData.filter((v: any) => v.points_cost > 0));
      setProfile(pData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (voucher: any) => {
    const points = profile?.customer?.loyalty_points || 0;
    if (points < voucher.points_cost) {
      Alert.alert('Thông báo', `Bạn cần thêm ${voucher.points_cost - points} điểm để đổi voucher này.`);
      return;
    }

    Alert.alert(
      'Xác nhận đổi quà',
      `Bạn có muốn dùng ${voucher.points_cost} điểm để đổi lấy mã ${voucher.code}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Đổi ngay', 
          onPress: async () => {
            try {
              setRedeemingId(voucher.id);
              await collectVoucher(voucher.id);
              Alert.alert('Thành công', 'Voucher đã được thêm vào ví của bạn!');
              loadData(); // Refresh points and list
            } catch (error: any) {
              const msg = error.response?.data?.error || 'Đổi quà thất bại';
              Alert.alert('Lỗi', msg);
            } finally {
              setRedeemingId(null);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const points = profile?.customer?.loyalty_points || 0;
    const canAfford = points >= item.points_cost;

    return (
      <View className="bg-white m-4 rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <View className="p-5 flex-row">
          <View className={`w-16 h-16 rounded-2xl items-center justify-center ${canAfford ? 'bg-amber-100' : 'bg-gray-100'}`}>
            <Ticket size={32} color={canAfford ? '#f59e0b' : '#9ca3af'} />
          </View>
          <View className="flex-1 ml-4">
            <View className="flex-row justify-between items-start">
              <Text className="text-gray-900 font-black text-lg">{item.code}</Text>
              <View className="bg-amber-50 px-2 py-1 rounded-lg flex-row items-center">
                <Star size={12} color="#f59e0b" fill="#f59e0b" />
                <Text className="text-amber-700 font-bold text-xs ml-1">{item.points_cost}đ</Text>
              </View>
            </View>
            <Text className="text-gray-500 text-xs mt-1" numberOfLines={2}>{item.description}</Text>
            <Text className="text-gray-400 text-[10px] mt-2 italic">{item.restaurant_name || 'Áp dụng toàn hệ thống'}</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          onPress={() => handleRedeem(item)}
          disabled={redeemingId === item.id}
          className={`py-4 items-center ${canAfford ? 'bg-amber-500' : 'bg-gray-100'}`}
        >
          {redeemingId === item.id ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className={`font-black text-sm uppercase ${canAfford ? 'text-white' : 'text-gray-400'}`}>
              {canAfford ? 'ĐỔI QUÀ NGAY' : `CẦN THÊM ${item.points_cost - points} ĐIỂM`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white flex-row items-center py-4 px-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <ChevronLeft size={28} color="#000" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Đổi điểm nhận quà</Text>
      </View>

      <View className="bg-amber-500 p-6 flex-row items-center justify-between">
        <View>
          <Text className="text-amber-100 text-xs font-bold uppercase tracking-widest">Điểm của bạn</Text>
          <Text className="text-white text-3xl font-black">{profile?.customer?.loyalty_points || 0}đ</Text>
        </View>
        <Gift size={48} color="#fff" className="opacity-50" />
      </View>

      <FlatList
        data={vouchers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#f59e0b" className="mt-20" />
          ) : (
            <View className="items-center mt-20 px-10">
              <Gift size={64} color="#d1d5db" />
              <Text className="text-gray-400 mt-4 text-center">Hiện chưa có quà tặng nào khả dụng</Text>
            </View>
          )
        }
        onRefresh={loadData}
        refreshing={loading}
      />
    </SafeAreaView>
  );
}
