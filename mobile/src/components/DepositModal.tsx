import React from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { CreditCard, CheckCircle2, ShieldCheck, X } from 'lucide-react-native';

interface DepositModalProps {
  visible: boolean;
  restaurantName: string;
  depositAmount: number;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export default function DepositModal({
  visible,
  restaurantName,
  depositAmount,
  onClose,
  onConfirm,
  loading = false
}: DepositModalProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-center p-6">
        <View className="bg-white rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <View className="bg-blue-600 p-6 items-center">
            <TouchableOpacity 
              onPress={onClose}
              className="absolute right-4 top-4"
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
            <ShieldCheck size={48} color="#fff" className="opacity-90 mb-2" />
            <Text className="text-white text-xl font-bold">Yêu Cầu Đặt Cọc</Text>
            <Text className="text-blue-100 text-xs mt-1">{restaurantName}</Text>
          </View>

          {/* Content */}
          <View className="p-6">
            <Text className="text-gray-500 text-center text-sm mb-6">
              Nhà hàng yêu cầu đặt cọc trước để giữ chỗ cho đơn đặt bàn của bạn.
            </Text>

            <View className="bg-blue-50 p-6 rounded-2xl border border-blue-100 items-center mb-8">
              <Text className="text-blue-800 text-xs font-bold uppercase tracking-widest mb-1">Số tiền cần cọc</Text>
              <Text className="text-3xl font-black text-blue-600">
                {formatCurrency(depositAmount)}
              </Text>
            </View>

            <Text className="text-gray-900 font-bold mb-3 text-sm">Phương thức thanh toán:</Text>
            
            <View className="flex-row items-center p-4 border border-blue-500 bg-blue-50 rounded-2xl mb-8">
              <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm">
                <CreditCard size={20} color="#2563eb" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="font-bold text-gray-900">Thẻ ATM / VNPay</Text>
                <Text className="text-gray-400 text-[10px]">Thanh toán an toàn 24/7</Text>
              </View>
              <CheckCircle2 size={20} color="#2563eb" />
            </View>

            <TouchableOpacity 
              onPress={onConfirm}
              disabled={loading}
              className={`py-4 rounded-2xl items-center shadow-lg ${loading ? 'bg-gray-300' : 'bg-blue-600 shadow-blue-200'}`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-black text-lg uppercase">Thanh Toán Ngay</Text>
              )}
            </TouchableOpacity>

            <Text className="text-gray-400 text-[10px] text-center mt-4 italic">
              Bằng việc thanh toán, bạn đồng ý với chính sách hoàn hủy của nhà hàng
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
