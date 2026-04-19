import React from 'react';
import { CreditCard, CheckCircle2, ShieldCheck, X } from 'lucide-react';

interface DepositRequestProps {
  restaurantName: string;
  depositAmount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DepositRequestModal({
  restaurantName,
  depositAmount,
  onClose,
  onConfirm
}: DepositRequestProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center">
          <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-90" />
          <h2 className="text-2xl font-bold">Yêu Cầu Đặt Cọc</h2>
          <p className="opacity-90 mt-1">{restaurantName}</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-gray-600">
              Nhà hàng yêu cầu đặt cọc trước để giữ chỗ cho đơn đặt bàn của bạn.
            </p>
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <span className="block text-sm text-blue-800 font-medium mb-1">
                Số tiền cần cọc
              </span>
              <span className="text-3xl font-bold text-blue-600">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(depositAmount)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-800 text-sm">Phương thức thanh toán:</h4>
            
            <label className="flex items-center justify-between p-4 border border-blue-500 bg-blue-50 rounded-xl cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Thẻ ATM / VNPay</p>
                  <p className="text-xs text-gray-500">Thanh toán an toàn 24/7</p>
                </div>
              </div>
              <CheckCircle2 className="w-6 h-6 text-blue-600" />
            </label>

            <label className="flex items-center justify-between p-4 border border-gray-200 hover:border-blue-300 rounded-xl cursor-not-allowed opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-50 rounded-lg flex items-center justify-center">
                  <span className="font-bold text-pink-600">MoMo</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">MoMo</p>
                  <p className="text-xs text-gray-500">Bảo trì hệ thống</p>
                </div>
              </div>
            </label>
          </div>

          <div className="pt-2">
            <button
              onClick={onConfirm}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-300 shadow-md shadow-blue-200"
            >
              Thanh Toán Ngay
            </button>
            <p className="text-xs text-center text-gray-400 mt-4">
              Bằng việc thanh toán, bạn đồng ý với chính sách hoàn hủy của nhà hàng
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
