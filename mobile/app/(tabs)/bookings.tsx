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
import { fetchBookings, cancelBooking } from '../../src/services/api';
import { Calendar, MapPin, Clock, AlertCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import MainHeader from '../../src/components/MainHeader';

export default function BookingsScreen() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const data = await fetchBookings();
      setBookings(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (id: number) => {
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc chắn muốn hủy đơn đặt bàn này không?',
      [
        { text: 'Không', style: 'cancel' },
        { 
          text: 'Hủy đơn', 
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelBooking(id);
              Alert.alert('Thành công', 'Đã hủy đơn đặt bàn');
              loadBookings();
            } catch (error) {
              Alert.alert('Lỗi', 'Không thể hủy đơn này');
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-orange-500 bg-orange-50';
      case 'CONFIRMED': return 'text-green-600 bg-green-50';
      case 'COMPLETED': return 'text-blue-600 bg-blue-50';
      case 'CANCELLED': return 'text-gray-400 bg-gray-100';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      onPress={() => router.push(`/booking-detail/${item.id}`)}
      className="bg-white m-4 mb-2 p-5 rounded-3xl shadow-sm border border-gray-100"
    >
      <View className="flex-row justify-between items-start mb-4">
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900 mb-1">{item.restaurant_name}</Text>
          <View className="flex-row items-center">
            <MapPin size={12} color="#9ca3af" />
            <Text className="text-gray-400 text-xs ml-1" numberOfLines={1}>{item.restaurant_address}</Text>
          </View>
        </View>
        <View className={`px-3 py-1 rounded-full ${getStatusColor(item.status)}`}>
          <Text className={`text-[10px] font-bold ${getStatusColor(item.status).split(' ')[0]}`}>
            {item.status}
          </Text>
        </View>
      </View>

      <View className="flex-row border-t border-b border-gray-50 py-4 mb-4">
        <View className="flex-1 flex-row items-center">
          <Calendar size={16} color="#ef4444" />
          <View className="ml-2">
            <Text className="text-gray-400 text-[10px] uppercase font-bold">Ngày</Text>
            <Text className="text-gray-900 font-bold text-sm">{item.booking_date}</Text>
          </View>
        </View>
        <View className="flex-1 flex-row items-center border-l border-gray-50 pl-4">
          <Clock size={16} color="#ef4444" />
          <View className="ml-2">
            <Text className="text-gray-400 text-[10px] uppercase font-bold">Giờ</Text>
            <Text className="text-gray-900 font-bold text-sm">{item.time_slot_details?.start_time?.substring(0, 5) || 'N/A'}</Text>
          </View>
        </View>
      </View>

      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-gray-400 text-[10px] uppercase font-bold">Số khách</Text>
          <Text className="text-gray-900 font-bold">{item.number_of_guests} người</Text>
        </View>
        
        {item.status === 'PENDING' && (
          <TouchableOpacity 
            onPress={() => handleCancel(item.id)}
            className="bg-gray-100 px-4 py-2 rounded-xl"
          >
            <Text className="text-gray-600 font-bold text-xs">Hủy đơn</Text>
          </TouchableOpacity>
        )}

        {item.status === 'COMPLETED' && !item.has_review && (
          <TouchableOpacity 
            onPress={() => router.push({
              pathname: `/review/${item.id}`,
              params: { 
                restaurantId: item.restaurant, 
                restaurantName: item.restaurant_name 
              }
            })}
            className="bg-orange-500 px-4 py-2 rounded-xl"
          >
            <Text className="text-white font-bold text-xs">Đánh giá</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <MainHeader title="Đơn đặt chỗ" />
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#ef4444" className="mt-20" />
          ) : (
            <View className="items-center mt-20 px-10">
              <AlertCircle size={48} color="#d1d5db" />
              <Text className="text-gray-500 mt-4 text-center">Bạn chưa có đơn đặt bàn nào</Text>
              <TouchableOpacity 
                onPress={() => router.replace('/(tabs)')}
                className="mt-6 bg-red-600 px-8 py-3 rounded-2xl"
              >
                <Text className="text-white font-bold">Khám phá ngay</Text>
              </TouchableOpacity>
            </View>
          )
        }
        onRefresh={loadBookings}
        refreshing={loading}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}
