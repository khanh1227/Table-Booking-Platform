import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  TextInput,
  Alert,
  SafeAreaView,
  Linking
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Calendar, Users, Clock, ChevronLeft, Check, AlertCircle } from 'lucide-react-native';
import api, { fetchRestaurantDetail, fetchDepositPolicy, createVNPAYUrl, fetchUserVouchers } from '../../src/services/api';
import DepositModal from '../../src/components/DepositModal';
import { Ticket, ChevronDown } from 'lucide-react-native';

import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

export default function BookingScreen() {
  const { id } = useLocalSearchParams();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form State
  const [date, setDate] = useState(new Date());
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [guests, setGuests] = useState('2');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [specialRequest, setSpecialRequest] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
  const [showVoucherList, setShowVoucherList] = useState(false);
  
  // API Data
  const [availableSlots, setAvailableSlots] = useState([]);
  const [userVouchers, setUserVouchers] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [awaitingPayment, setAwaitingPayment] = useState(false);

  // Deposit State
  const [depositPolicy, setDepositPolicy] = useState<any>(null);
  const [depositAmount, setDepositAmount] = useState(0);
  const [showDepositModal, setShowDepositModal] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  useEffect(() => {
    if (id && bookingDate) loadSlots();
  }, [id, bookingDate]);

  useEffect(() => {
    if (depositPolicy && guests) {
      const numGuests = parseInt(guests);
      if (depositPolicy.is_required && numGuests >= depositPolicy.minimum_guests_for_deposit) {
        let amt = 0;
        const perGuest = Number(depositPolicy.deposit_per_guest);
        if (perGuest > 0) {
          amt = numGuests * perGuest;
        } else {
          amt = Number(depositPolicy.deposit_amount);
        }
        setDepositAmount(amt);
      } else {
        setDepositAmount(0);
      }
    }
  }, [guests, depositPolicy]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
    
    // Format YYYY-MM-DD
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    setBookingDate(`${year}-${month}-${day}`);
    
    // Reset slot when date changes
    setSelectedSlot(null);
  };

  const loadData = async () => {
    try {
      const [resData, policyData, voucherData] = await Promise.all([
        fetchRestaurantDetail(id as string),
        fetchDepositPolicy(id as string),
        fetchUserVouchers()
      ]);
      setRestaurant(resData);
      setDepositPolicy(policyData);
      setUserVouchers(voucherData.filter((v: any) => !v.is_used));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadSlots = async () => {
    try {
      setSlotsLoading(true);
      const res = await api.get(`/api/restaurants/restaurants/${id}/available-slots/?date=${bookingDate}`);
      setAvailableSlots(res.data.available_slots || []);
    } catch (error) {
      console.error("Lỗi tải slots:", error);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleBookingSubmit = async (withDeposit = false) => {
    if (!selectedSlot) {
      Alert.alert('Thông báo', 'Vui lòng chọn khung giờ');
      return;
    }

    // Check if deposit is required but modal not shown yet
    if (depositAmount > 0 && !withDeposit) {
      setShowDepositModal(true);
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        restaurant: id,
        time_slot: selectedSlot.id,
        booking_date: bookingDate,
        number_of_guests: parseInt(guests),
        special_request: specialRequest || undefined,
        voucher_code: selectedVoucher?.code || undefined,
      };

      const res = await api.post('/api/bookings/', payload);
      const bookingId = res.data.id || res.data.data?.id;

      if (withDeposit && bookingId) {
        try {
          const { payment_url } = await createVNPAYUrl(bookingId);
          setAwaitingPayment(true);
          setIsSuccess(true);
          setShowDepositModal(false);
          await Linking.openURL(payment_url);
        } catch (depErr) {
          console.error("Payment init error:", depErr);
          Alert.alert('Lỗi', 'Không thể khởi tạo thanh toán VNPay');
          return;
        }
      } else {
        setIsSuccess(true);
        setShowDepositModal(false);
      }
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.error || 'Đặt bàn thất bại';
      Alert.alert('Lỗi', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#ef4444" className="flex-1" />;

  if (isSuccess) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center p-6">
        <View className="bg-green-100 p-6 rounded-full mb-6">
          <Check size={64} color="#16a34a" />
        </View>
        <Text className="text-3xl font-bold text-gray-900 mb-2">Thành công!</Text>
        <Text className="text-gray-500 text-center mb-10 text-lg">
          {awaitingPayment
            ? `Booking tại ${restaurant?.name} đã được tạo. Vui lòng hoàn tất thanh toán trên VNPay rồi kiểm tra lại trong mục Đặt bàn.`
            : `Yêu cầu đặt bàn tại ${restaurant?.name} đã được gửi thành công.`}
        </Text>
        <TouchableOpacity 
          onPress={() => router.replace('/(tabs)')}
          className="bg-red-600 w-full py-4 rounded-2xl items-center"
        >
          <Text className="text-white font-bold text-lg">Về trang chủ</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-4">
        <View className="flex-row items-center py-4 mb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={28} color="#000" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Đặt bàn</Text>
        </View>

        <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
          <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">Chi tiết nhà hàng</Text>
          <Text className="text-xl font-bold text-gray-900 mb-1">{restaurant?.name}</Text>
          <Text className="text-gray-500 text-sm" numberOfLines={1}>{restaurant?.address}</Text>
        </View>

        {/* Date Selection */}
        <View className="mb-6">
          <Text className="text-gray-900 font-bold mb-3 text-lg">Chọn ngày</Text>
          <TouchableOpacity 
            onPress={() => setShowDatePicker(true)}
            className="flex-row items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"
          >
            <Calendar size={20} color="#ef4444" />
            <Text className="flex-1 ml-3 text-gray-700 font-bold">
              {new Date(bookingDate).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={date}
              mode="date"
              is24Hour={true}
              display="default"
              onChange={onDateChange}
              minimumDate={new Date()}
            />
          )}
        </View>

        {/* Guests Selection */}
        <View className="mb-6">
          <Text className="text-gray-900 font-bold mb-3 text-lg">Số lượng khách</Text>
          <View className="flex-row">
            {[1, 2, 3, 4, 5, 6].map(num => (
              <TouchableOpacity 
                key={num}
                onPress={() => setGuests(num.toString())}
                className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${guests === num.toString() ? 'bg-red-600' : 'bg-white border border-gray-100'}`}
              >
                <Text className={`font-bold ${guests === num.toString() ? 'text-white' : 'text-gray-700'}`}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Time Selection */}
        <View className="mb-6">
          <Text className="text-gray-900 font-bold mb-3 text-lg">Chọn khung giờ</Text>
          {slotsLoading ? (
            <ActivityIndicator color="#ef4444" />
          ) : availableSlots.length > 0 ? (
            <View className="flex-row flex-wrap">
              {availableSlots.map((slot: any) => (
                <TouchableOpacity 
                  key={slot.id}
                  onPress={() => setSelectedSlot(slot)}
                  className={`px-4 py-3 rounded-2xl mr-2 mb-2 border ${selectedSlot?.id === slot.id ? 'bg-red-600 border-red-600' : 'bg-white border-gray-100'}`}
                >
                  <Text className={`font-bold ${selectedSlot?.id === slot.id ? 'text-white' : 'text-gray-700'}`}>
                    {slot.start_time.substring(0, 5)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text className="text-gray-400 italic">Không có khung giờ trống trong ngày này</Text>
          )}
        </View>

        {/* Voucher Selection */}
        <View className="mb-6">
          <Text className="text-gray-900 font-bold mb-3 text-lg">Ưu đãi</Text>
          <TouchableOpacity 
            onPress={() => setShowVoucherList(!showVoucherList)}
            className="flex-row items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"
          >
            <Ticket size={20} color="#ef4444" />
            <View className="flex-1 ml-3">
              {selectedVoucher ? (
                <View>
                  <Text className="text-gray-900 font-bold">{selectedVoucher.code}</Text>
                  <Text className="text-gray-400 text-[10px]">{selectedVoucher.description}</Text>
                </View>
              ) : (
                <Text className="text-gray-400">Chọn mã giảm giá</Text>
              )}
            </View>
            <ChevronDown size={20} color="#9ca3af" />
          </TouchableOpacity>

          {showVoucherList && (
            <View className="mt-3 space-y-2">
              {userVouchers.length > 0 ? (
                userVouchers.map((v: any) => (
                  <TouchableOpacity 
                    key={v.id} 
                    onPress={() => {
                      setSelectedVoucher(v === selectedVoucher ? null : v);
                      setShowVoucherList(false);
                    }}
                    className={`p-4 rounded-2xl border ${selectedVoucher?.id === v.id ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}
                  >
                    <View className="flex-row justify-between items-center">
                      <View>
                        <Text className="text-gray-900 font-bold">{v.code}</Text>
                        <Text className="text-gray-400 text-[10px]">{v.description}</Text>
                      </View>
                      {selectedVoucher?.id === v.id && <Check size={16} color="#ef4444" />}
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text className="text-gray-400 text-xs italic ml-1">Bạn chưa có mã giảm giá nào khả dụng</Text>
              )}
            </View>
          )}
        </View>

        {/* Special Request */}
        <View className="mb-10">
          <Text className="text-gray-900 font-bold mb-3 text-lg">Yêu cầu đặc biệt</Text>
          <TextInput 
            placeholder="Ví dụ: Bàn gần cửa sổ, kỷ niệm ngày cưới..."
            multiline
            numberOfLines={4}
            value={specialRequest}
            onChangeText={setSpecialRequest}
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-gray-700 text-sm h-32"
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Footer Button */}
      <View className="p-4 bg-white border-t border-gray-100">
        <TouchableOpacity 
          className={`py-4 rounded-2xl items-center shadow-lg ${submitting || !selectedSlot ? 'bg-gray-300' : 'bg-red-600 shadow-red-200'}`}
          onPress={() => handleBookingSubmit(false)}
          disabled={submitting || !selectedSlot}
        >
          <Text className="text-white font-black text-lg">
            {submitting ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN ĐẶT BÀN'}
          </Text>
        </TouchableOpacity>
      </View>

      <DepositModal 
        visible={showDepositModal}
        restaurantName={restaurant?.name}
        depositAmount={depositAmount}
        onClose={() => setShowDepositModal(false)}
        onConfirm={() => handleBookingSubmit(true)}
        loading={submitting}
      />
    </SafeAreaView>
  );
}
