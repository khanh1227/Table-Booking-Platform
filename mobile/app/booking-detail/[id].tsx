import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView,
  Alert,
  Image
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { 
  ChevronLeft, 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Info
} from 'lucide-react-native';
import api, { getAbsoluteUrl, cancelBooking } from '../../src/services/api';

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadBooking();
  }, [id]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/bookings/${id}/`);
      setBooking(res.data);
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Không thể tải thông tin đơn đặt bàn');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
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
              await cancelBooking(Number(id));
              Alert.alert('Thành công', 'Đã hủy đơn đặt bàn');
              loadBooking();
            } catch (error) {
              Alert.alert('Lỗi', 'Không thể hủy đơn này');
            }
          }
        }
      ]
    );
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'PENDING': 
        return { label: 'Đang chờ duyệt', color: 'text-orange-500', bg: 'bg-orange-50', icon: <Clock size={20} color="#f97316" /> };
      case 'CONFIRMED': 
        return { label: 'Đã xác nhận', color: 'text-green-600', bg: 'bg-green-50', icon: <CheckCircle2 size={20} color="#16a34a" /> };
      case 'COMPLETED': 
        return { label: 'Đã hoàn thành', color: 'text-blue-600', bg: 'bg-blue-50', icon: <CheckCircle2 size={20} color="#2563eb" /> };
      case 'CANCELLED': 
        return { label: 'Đã hủy', color: 'text-gray-500', bg: 'bg-gray-100', icon: <XCircle size={20} color="#6b7280" /> };
      default: 
        return { label: status, color: 'text-gray-500', bg: 'bg-gray-50', icon: <Info size={20} color="#6b7280" /> };
    }
  };

  if (loading) return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#ef4444" />
    </View>
  );

  if (!booking) return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <AlertTriangle size={48} color="#ef4444" />
      <Text className="text-gray-900 font-bold text-lg mt-4">Không tìm thấy đơn đặt bàn</Text>
      <TouchableOpacity onPress={() => router.back()} className="mt-6 bg-red-600 px-8 py-3 rounded-2xl">
        <Text className="text-white font-bold">Quay lại</Text>
      </TouchableOpacity>
    </View>
  );

  const statusInfo = getStatusInfo(booking.status);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center px-4 py-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <ChevronLeft size={28} color="#000" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Chi tiết đơn đặt</Text>
      </View>

      <ScrollView className="flex-1">
        {/* Status Card */}
        <View className={`${statusInfo.bg} m-4 p-4 rounded-3xl flex-row items-center`}>
          {statusInfo.icon}
          <View className="ml-3">
            <Text className={`${statusInfo.color} font-black text-lg`}>{statusInfo.label}</Text>
            <Text className="text-gray-500 text-xs">Mã đơn: #BK{booking.id.toString().padStart(5, '0')}</Text>
          </View>
        </View>

        {/* Restaurant Info */}
        <View className="bg-white mx-4 mb-4 p-5 rounded-3xl shadow-sm border border-gray-100">
          <Text className="text-gray-400 text-[10px] uppercase font-bold mb-3 tracking-widest">Thông tin nhà hàng</Text>
          <TouchableOpacity 
            onPress={() => router.push(`/restaurant/${booking.restaurant}`)}
            className="flex-row items-center"
          >
            <Image 
              source={{ uri: getAbsoluteUrl(booking.restaurant_thumbnail) || 'https://via.placeholder.com/100' }} 
              className="w-16 h-16 rounded-2xl bg-gray-100"
            />
            <View className="ml-4 flex-1">
              <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>{booking.restaurant_name}</Text>
              <View className="flex-row items-center mt-1">
                <MapPin size={12} color="#9ca3af" />
                <Text className="text-gray-400 text-xs ml-1" numberOfLines={1}>{booking.restaurant_address}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Booking Details */}
        <View className="bg-white mx-4 mb-4 p-5 rounded-3xl shadow-sm border border-gray-100">
          <Text className="text-gray-400 text-[10px] uppercase font-bold mb-4 tracking-widest">Chi tiết lịch hẹn</Text>
          
          <View className="space-y-4">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-red-50 rounded-full items-center justify-center">
                <Calendar size={18} color="#ef4444" />
              </View>
              <View className="ml-4">
                <Text className="text-gray-400 text-[10px] font-bold">Ngày đặt bàn</Text>
                <Text className="text-gray-900 font-bold text-base">{booking.booking_date}</Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-red-50 rounded-full items-center justify-center">
                <Clock size={18} color="#ef4444" />
              </View>
              <View className="ml-4">
                <Text className="text-gray-400 text-[10px] font-bold">Giờ đến</Text>
                <Text className="text-gray-900 font-bold text-base">{booking.time_slot_details?.start_time?.substring(0, 5) || 'N/A'}</Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-red-50 rounded-full items-center justify-center">
                <Users size={18} color="#ef4444" />
              </View>
              <View className="ml-4">
                <Text className="text-gray-400 text-[10px] font-bold">Số lượng khách</Text>
                <Text className="text-gray-900 font-bold text-base">{booking.number_of_guests} người</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Customer Info */}
        <View className="bg-white mx-4 mb-4 p-5 rounded-3xl shadow-sm border border-gray-100">
          <Text className="text-gray-400 text-[10px] uppercase font-bold mb-4 tracking-widest">Thông tin khách hàng</Text>
          
          <View className="space-y-4">
            <View className="flex-row items-center">
              <Phone size={16} color="#9ca3af" />
              <Text className="text-gray-700 font-medium ml-3">{booking.customer_name || 'Khách hàng'}</Text>
            </View>
            
            {booking.special_request && (
              <View className="flex-row items-start mt-2">
                <MessageSquare size={16} color="#9ca3af" className="mt-1" />
                <View className="ml-3 flex-1 bg-gray-50 p-3 rounded-2xl">
                  <Text className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Yêu cầu đặc biệt</Text>
                  <Text className="text-gray-700 italic">{booking.special_request}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Payment / Deposit Info */}
        {(booking.deposit_amount > 0 || booking.is_deposit_paid) && (
          <View className="bg-white mx-4 mb-4 p-5 rounded-3xl shadow-sm border border-gray-100">
            <Text className="text-gray-400 text-[10px] uppercase font-bold mb-4 tracking-widest">Thông tin thanh toán</Text>
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-600">Tiền đặt cọc</Text>
              <Text className="text-gray-900 font-black text-lg">{Number(booking.deposit_amount).toLocaleString('vi-VN')}đ</Text>
            </View>
            <View className="flex-row justify-between items-center mt-2">
              <Text className="text-gray-600">Trạng thái</Text>
              <Text className={booking.is_deposit_paid ? 'text-green-600 font-bold' : 'text-orange-500 font-bold'}>
                {booking.is_deposit_paid ? 'Đã thanh toán' : 'Chờ thanh toán'}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View className="p-4 space-y-3">
          {booking.status === 'PENDING' && (
            <TouchableOpacity 
              onPress={handleCancel}
              className="w-full py-4 rounded-2xl items-center border border-red-100 bg-white"
            >
              <Text className="text-red-600 font-black">Hủy đơn đặt bàn</Text>
            </TouchableOpacity>
          )}

          {booking.status === 'COMPLETED' && !booking.has_review && (
            <TouchableOpacity 
              onPress={() => router.push({
                pathname: '/write-review',
                params: { 
                  bookingId: booking.id, 
                  restaurantId: booking.restaurant,
                  restaurantName: booking.restaurant_name
                }
              })}
              className="w-full py-4 rounded-2xl items-center bg-red-600 shadow-lg shadow-red-200"
            >
              <Text className="text-white font-black">Viết đánh giá</Text>
            </TouchableOpacity>
          )}

          {booking.has_review && (
            <View className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <View className="flex-row items-center mb-1">
                <Star size={16} color="#2563eb" fill="#2563eb" />
                <Text className="text-blue-700 font-bold ml-2">Bạn đã đánh giá {booking.review_details?.rating}/5</Text>
              </View>
              <Text className="text-blue-600 text-xs italic">"{booking.review_details?.comment}"</Text>
            </View>
          )}
          
          <TouchableOpacity 
            onPress={() => router.push({
              pathname: '/chatbot',
              params: { initialMessage: `Tôi muốn hỏi về đơn đặt bàn #BK${booking.id.toString().padStart(5, '0')} tại ${booking.restaurant_name}` }
            })}
            className="w-full py-4 rounded-2xl items-center bg-gray-900"
          >
            <Text className="text-white font-black">Chat với AI hỗ trợ</Text>
          </TouchableOpacity>
        </View>

        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
