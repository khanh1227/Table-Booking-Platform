import { useState, useEffect } from "react";
import { X, Calendar, Clock, Users, MessageSquare, Check, AlertCircle, Loader2, Ticket } from "lucide-react";
import DepositRequestModal from '@/components/payments/DepositRequestModal';
import VoucherList, { type Voucher } from '@/components/promotions/VoucherList';
import { fetchDepositPolicy, simulateDeposit, fetchAvailableVouchers, type DepositPolicy } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

type Restaurant = {
  id: number;
  name: string;
  address: string;
  phone_number?: string;
};

type TimeSlot = {
  id: number;
  start_time: string;
  end_time: string;
  max_bookings: number | null;
  is_active: boolean;
};

type AvailableSlot = TimeSlot & {
  current_bookings?: number;
  available?: boolean;
};

type Props = {
  restaurant: Restaurant;
  initialDate?: string;
  initialGuests?: string;
  onClose: () => void;
  onSuccess?: (bookingId: number) => void;
};

export default function BookingForm({
  restaurant,
  initialDate = "",
  initialGuests = "2",
  onClose,
  onSuccess,
}: Props) {
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdBookingId, setCreatedBookingId] = useState<number | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);

  // Form data
  const [bookingDate, setBookingDate] = useState(initialDate);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [numberOfGuests, setNumberOfGuests] = useState(initialGuests);
  const [specialRequest, setSpecialRequest] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [showVoucherModal, setShowVoucherModal] = useState(false);

  // Available slots API data
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // APIs data
  const [depositPolicy, setDepositPolicy] = useState<DepositPolicy | null>(null);
  const [availableVouchers, setAvailableVouchers] = useState<Voucher[]>([]);
  const [depositAmount, setDepositAmount] = useState(0);

  useEffect(() => {
    if (restaurant.id) {
      loadRestaurantData();
    }
  }, [restaurant.id]);

  useEffect(() => {
    if (bookingDate) {
      fetchAvailableSlots();
    }
  }, [bookingDate]);

  useEffect(() => {
    // Calculate deposit
    if (depositPolicy?.is_required && parseInt(numberOfGuests) >= depositPolicy.minimum_guests_for_deposit) {
       let amt = 0;
       if (depositPolicy.deposit_percentage) {
         // Mock total bill to calculate percentage. In reality, requires menu items. We'll fallback to fixed amount or ignore
         amt = parseInt(numberOfGuests) * 100000; // Mock 100k/nguoi then calculate %
       } else {
         amt = parseInt(depositPolicy.deposit_amount);
       }
       setDepositAmount(amt);
    } else {
       setDepositAmount(0);
    }
  }, [numberOfGuests, depositPolicy]);

  const loadRestaurantData = async () => {
    try {
      const [policy, vouchersData] = await Promise.all([
        fetchDepositPolicy(restaurant.id),
        fetchAvailableVouchers(restaurant.id)
      ]);
      setDepositPolicy(policy);
      
      const mappedVouchers: Voucher[] = (vouchersData || []).map(v => ({
        id: v.id.toString(),
        code: v.code,
        title: v.description || v.code,
        description: v.voucher_type === 'PERCENTAGE' ? `Giảm ${v.discount_value}%` : `Giảm ${new Intl.NumberFormat('vi-VN').format(Number(v.discount_value))}đ`,
        discountType: v.voucher_type === 'PERCENTAGE' ? 'PERCENT' : 'FIXED',
        discountValue: Number(v.discount_value),
        maxDiscount: v.max_discount_amount ? Number(v.max_discount_amount) : undefined,
        minSpend: Number(v.min_order_value),
        validUntil: new Date(v.valid_to).toLocaleDateString('vi-VN'),
        isUsed: false,
        restaurantName: v.restaurant_name || undefined
      }));
      setAvailableVouchers(mappedVouchers);
    } catch (e) {
      console.error('Failed to load restaurant details', e);
    }
  };

  const getAuthHeaders = () => {
    const access = localStorage.getItem("access");
    return {
      "Content-Type": "application/json",
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    };
  };

  const fetchAvailableSlots = async () => {
    if (!bookingDate) return;

    setSlotsLoading(true);
    setError("");
    setSelectedSlot(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/restaurants/restaurants/${restaurant.id}/available-slots/?date=${bookingDate}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.ok) throw new Error("Không thể tải khung giờ");

      const data = await res.json();
      setAvailableSlots(data.available_slots || []);
    } catch (err: any) {
      setError(err.message || "Lỗi khi tải khung giờ");
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSlot) {
      setError("Vui lòng chọn khung giờ");
      return;
    }
    
    // Check Deposit Policy
    if (depositAmount > 0) {
      setShowDepositModal(true);
    } else {
      processBookingSubmit();
    }
  };

  const processBookingSubmit = async (withDeposit = false) => {
    setLoading(true);
    setError("");

    try {
      const payload = {
        restaurant: restaurant.id,
        time_slot: selectedSlot!.id,
        booking_date: bookingDate,
        number_of_guests: parseInt(numberOfGuests),
        special_request: specialRequest || undefined,
        voucher_code: appliedVoucher?.code || undefined,
      };

      const res = await fetch(`${API_BASE}/api/bookings/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.detail || "Đặt bàn thất bại");
      }

      // Simulate Deposit if required
      const bookingId = Number(data?.data?.id ?? data?.id ?? 0) || null;
      if (withDeposit && bookingId) {
          try {
             await simulateDeposit(bookingId);
          } catch (depErr) {
             console.error("Deposit error:", depErr);
             // We can ignore the error for now, as the booking is already created.
          }
      }

      // Success
      setIsSuccess(true);
      setCreatedBookingId(bookingId);
      setAppliedVoucher(null); // Clear voucher sau khi đã đặt xong
      if (onSuccess && bookingId) {
        setTimeout(() => {
          onSuccess(bookingId);
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || "Đặt bàn thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleDepositConfirm = () => {
    setShowDepositModal(false);
    processBookingSubmit(true);
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5); // "HH:MM:SS" -> "HH:MM"
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full my-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-amber-600 to-orange-600 p-8 text-white">
          <div className="pr-12">
            <h2 className="text-3xl font-bold mb-1">Đặt Bàn</h2>
            <div className="flex items-center gap-2 text-orange-100 font-medium">
              <span>📍</span>
              <p className="truncate">{restaurant.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-8 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-full transition text-white backdrop-blur-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {isSuccess ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-3xl font-bold text-gray-800 mb-3">
                Đặt bàn thành công!
              </h3>
              <p className="text-gray-600 mb-8">
                Chúng tôi đã ghi nhận thông tin đặt bàn của bạn.
                <br />
                Nhà hàng sẽ xác nhận trong thời gian sớm nhất.
              </p>
              <button
                onClick={onClose}
                className="bg-amber-600 text-white px-10 py-3 rounded-xl font-semibold hover:bg-amber-700 transition"
              >
                Đóng
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Grid 2 Cols */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Chọn ngày
                  </label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={getMinDate()}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Users className="w-4 h-4 inline mr-2" />
                    Số lượng khách
                  </label>
                  <select
                    value={numberOfGuests}
                    onChange={(e) => setNumberOfGuests(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map((num) => (
                      <option key={num} value={num}>
                        {num} người
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Chọn giờ đặt bàn
                </label>
                
                {!bookingDate ? (
                  <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Vui lòng chọn ngày để xem giờ trống</p>
                  </div>
                ) : slotsLoading ? (
                  <div className="text-center py-6">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto" />
                    <p className="text-gray-600 mt-2 text-sm">Đang tải khung giờ...</p>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Không có khung giờ nào khả dụng</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-3 border-2 rounded-xl text-center transition ${selectedSlot?.id === slot.id
                            ? "border-amber-600 bg-amber-50 text-amber-700"
                            : "border-gray-200 hover:border-amber-300 text-gray-700"
                          }`}
                      >
                        <div className="font-semibold text-sm">
                          {formatTime(slot.start_time)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Special request */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  Yêu cầu đặc biệt (không bắt buộc)
                </label>
                <textarea
                  value={specialRequest}
                  onChange={(e) => setSpecialRequest(e.target.value)}
                  placeholder="Vị trí ngồi, dị ứng thực phẩm, kỷ niệm..."
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              {/* Voucher */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Ticket className="w-4 h-4 inline mr-2" />
                  Mã khuyến mãi
                </label>
                {appliedVoucher ? (
                  <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-xl">
                    <div>
                      <span className="font-bold text-orange-600 mr-2">{appliedVoucher.code}</span>
                      <span className="text-sm text-gray-600">{appliedVoucher.title}</span>
                    </div>
                    <button 
                      onClick={() => setAppliedVoucher(null)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowVoucherModal(true)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-xl hover:border-amber-500 hover:bg-amber-50 transition-colors text-left"
                  >
                    <span className="text-gray-500">Chọn hoặc nhập mã khuyến mãi</span>
                    <span className="text-amber-600 font-medium whitespace-nowrap">Chọn mã</span>
                  </button>
                )}
              </div>

              {/* Form Actions */}
              <div className="pt-4 flex justify-end items-center border-t border-gray-100">
                <div className="flex items-center flex-1">
                  {selectedSlot && (
                    <div className="bg-amber-50 text-amber-700 text-sm font-medium py-1.5 px-3 rounded-lg flex items-center">
                      <Clock className="w-4 h-4 mr-1.5" />
                      {new Date(bookingDate).toLocaleDateString("vi-VN")} · {formatTime(selectedSlot.start_time)}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={handleSubmit}
                  disabled={loading || !bookingDate || !selectedSlot}
                  className="bg-amber-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-amber-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center min-w-[200px]"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Xác nhận đặt bàn"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <DepositRequestModal
          restaurantName={restaurant.name}
          depositAmount={depositAmount}
          onClose={() => setShowDepositModal(false)}
          onConfirm={handleDepositConfirm}
        />
      )}

      {/* Voucher Modal */}
      {showVoucherModal && (
        <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-50 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl relative">
            <div className="p-6 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
              <h3 className="text-xl font-bold text-gray-800 flex items-center">
                <Ticket className="w-6 h-6 mr-2 text-amber-600" />
                Chọn Mã Khuyến Mãi
              </h3>
              <button
                onClick={() => setShowVoucherModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
              <VoucherList 
                selectable={true}
                onApply={(voucher) => {
                  setAppliedVoucher(voucher);
                  setShowVoucherModal(false);
                }}
                vouchers={availableVouchers} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
