import React from 'react';
import { Ticket, Clock, CalendarDays, CheckCircle2 } from 'lucide-react';

export interface Voucher {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  minSpend?: number;
  validUntil: string;
  isUsed: boolean;
  restaurantId?: number; // Null nếu là voucher của platform
  restaurantName?: string;
}

interface VoucherListProps {
  vouchers: Voucher[];
  onApply?: (voucher: Voucher) => void;
  selectable?: boolean;
}

export default function VoucherList({ vouchers, onApply, selectable = false }: VoucherListProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  if (vouchers.length === 0) {
    return (
      <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">
        <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">Bạn chưa có mã khuyến mãi nào.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {vouchers.map((voucher) => (
        <div 
          key={voucher.id} 
          className={`flex overflow-hidden rounded-2xl border transition-all ${
            voucher.isUsed 
              ? 'border-gray-200 bg-gray-50 opacity-75 grayscale-[0.8]' 
              : 'border-orange-100 bg-white hover:border-orange-300 hover:shadow-md'
          }`}
        >
          {/* Left Side (Discount Value) */}
          <div className={`w-1/3 flex flex-col items-center justify-center p-4 border-r border-dashed ${
            voucher.isUsed ? 'bg-gray-200 border-gray-300' : 'bg-orange-50 border-orange-200'
          }`}>
            <span className={`text-2xl sm:text-3xl font-bold ${voucher.isUsed ? 'text-gray-500' : 'text-orange-600'}`}>
              {voucher.discountType === 'PERCENT' 
                ? `${voucher.discountValue}%` 
                : formatCurrency(voucher.discountValue).replace('₫', '')}
            </span>
            {voucher.discountType === 'FIXED' && <span className={`text-sm font-semibold ${voucher.isUsed ? 'text-gray-400' : 'text-orange-500'}`}>VNĐ</span>}
            <span className={`text-xs mt-1 text-center font-medium px-2 py-1 rounded bg-white/50 ${voucher.isUsed ? 'text-gray-500' : 'text-orange-600'}`}>
              {voucher.restaurantName || "Toàn sàn"}
            </span>
          </div>

          {/* Right Side (Details) */}
          <div className="w-2/3 p-4 relative flex flex-col">
            {/* Cutout semicircles */}
            <div className={`absolute -left-3 top-[-10px] w-5 h-5 rounded-full ${voucher.isUsed ? 'bg-gray-50' : 'bg-white'} border-b border-dashed ${voucher.isUsed ? 'border-gray-300' : 'border-orange-200'}`}></div>
            <div className={`absolute -left-3 bottom-[-10px] w-5 h-5 rounded-full ${voucher.isUsed ? 'bg-gray-50' : 'bg-white'} border-t border-dashed ${voucher.isUsed ? 'border-gray-300' : 'border-orange-200'}`}></div>

            <div className="flex-1">
              <h4 className={`font-bold text-lg mb-1 leading-tight ${voucher.isUsed ? 'text-gray-600' : 'text-gray-800'}`}>
                {voucher.title}
              </h4>
              <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                {voucher.description}
              </p>
              {voucher.minSpend && (
                <p className="text-xs font-medium text-slate-600 mb-2">
                  Đơn tối thiểu {formatCurrency(voucher.minSpend)}
                </p>
              )}
            </div>

            <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5 mr-1" />
                <span>HSD: {voucher.validUntil}</span>
              </div>
              
              {voucher.isUsed ? (
                <span className="text-xs font-bold text-gray-400 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Đã dùng
                </span>
              ) : selectable ? (
                <button 
                  onClick={() => onApply && onApply(voucher)}
                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Áp dụng
                </button>
              ) : (
                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">
                  {voucher.code}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
