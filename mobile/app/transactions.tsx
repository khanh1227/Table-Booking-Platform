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
import { ChevronLeft, ArrowUpRight, ArrowDownLeft, CreditCard, Clock, CheckCircle2, XCircle } from 'lucide-react-native';
import { fetchTransactions } from '../src/services/api';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchTransactions();
      setTransactions(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'SUCCESS': return { color: 'text-green-600', bg: 'bg-green-50', icon: <CheckCircle2 size={12} color="#16a34a" /> };
      case 'PENDING': return { color: 'text-orange-500', bg: 'bg-orange-50', icon: <Clock size={12} color="#f97316" /> };
      case 'FAILED': return { color: 'text-red-600', bg: 'bg-red-50', icon: <XCircle size={12} color="#dc2626" /> };
      default: return { color: 'text-gray-500', bg: 'bg-gray-50', icon: null };
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const status = getStatusInfo(item.status);
    const isOut = item.transaction_type === 'REFUND';

    return (
      <View className="bg-white mb-3 p-4 rounded-3xl border border-gray-100 flex-row items-center">
        <View className={`w-12 h-12 rounded-2xl items-center justify-center ${isOut ? 'bg-red-50' : 'bg-green-50'}`}>
          {isOut ? (
            <ArrowUpRight size={24} color="#ef4444" />
          ) : (
            <ArrowDownLeft size={24} color="#16a34a" />
          )}
        </View>

        <View className="ml-4 flex-1">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-gray-900 font-bold text-base">
              {item.transaction_type === 'DEPOSIT' ? 'Tiền đặt cọc' : 
               item.transaction_type === 'PAYMENT' ? 'Quyết toán cho nhà hàng' : 
               item.transaction_type === 'REFUND' ? 'Hoàn tiền' : 'Giao dịch'}
            </Text>
            <Text className={`font-black text-base ${isOut ? 'text-gray-900' : 'text-green-600'}`}>
              {isOut ? '-' : '+'}{formatCurrency(item.amount)}
            </Text>
          </View>
          
          <View className="flex-row justify-between items-center">
            <Text className="text-gray-400 text-[10px]">
              {new Date(item.created_at).toLocaleString('vi-VN')}
            </Text>
            <View className={`flex-row items-center px-2 py-0.5 rounded-full ${status.bg}`}>
              {status.icon}
              <Text className={`text-[10px] font-bold ml-1 ${status.color}`}>{item.status}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white flex-row items-center py-4 px-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <ChevronLeft size={28} color="#000" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Lịch sử giao dịch</Text>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#ef4444" className="mt-20" />
          ) : (
            <View className="items-center mt-20">
              <CreditCard size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-4">Bạn chưa có giao dịch nào</Text>
            </View>
          )
        }
        onRefresh={loadData}
        refreshing={loading}
      />
    </SafeAreaView>
  );
}
