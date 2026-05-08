import { useState, useEffect } from "react";
import { X, Calendar, Clock, Users, MessageSquare, Check, AlertCircle, Loader2, Ticket } from "lucide-react";
import DepositRequestModal from '@/components/payments/DepositRequestModal';
import VoucherList, { type Voucher } from '@/components/promotions/VoucherList';
import { fetchDepositPolicy, createVNPAYUrl, fetchAvailableVouchers, type DepositPolicy } from '@/lib/api';

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
  max_bookings: number | null;
  max_guests_per_booking: number;
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
  initialTime?: string;
  onClose: () => void;
  onSuccess?: (bookingId: number) => void;
};

export default function BookingForm({
  restaurant,
  initialDate = "",
  initialGuests = "2",
  initialTime = "",
  onClose,
  onSuccess,
}: Props) {
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdBookingId, setCreatedBookingId] = useState<number | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [countdown, setCountdown] = useState(0);

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
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

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
    if (availableSlots.length > 0 && initialTime && !selectedSlot) {
      // Tìm slot khớp với initialTime (vd: "19:30" hoặc "07:30")
      const normalizedInitial = initialTime.includes(':') && initialTime.split(':')[0].length === 1
        ? '0' + initialTime
        : initialTime;

      const found = availableSlots.find(s => {
        const slotT = formatTime(s.start_time);
        return slotT === normalizedInitial || slotT === initialTime;
      });

      if (found) {
        setSelectedSlot(found);
      }
    }
  }, [availableSlots, initialTime]);

  useEffect(() => {
    // Calculate deposit per guest
    if (depositPolicy?.is_required && parseInt(numberOfGuests) >= depositPolicy.minimum_guests_for_deposit) {
      let amt = 0;
      const perGuest = Number(depositPolicy.deposit_per_guest);
      if (perGuest > 0) {
        amt = parseInt(numberOfGuests) * perGuest;
      } else {
        amt = Number(depositPolicy.deposit_amount);
      }
      setDepositAmount(amt);
    } else {
      setDepositAmount(0);
    }
  }, [numberOfGuests, depositPolicy]);

  useEffect(() => {
    let timer: any;
    if (isSuccess && depositAmount > 0 && expiresAt) {
      const updateCountdown = () => {
        const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
        setCountdown(seconds);
      };
      updateCountdown();
      timer = setInterval(() => {
        updateCountdown();
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSuccess, depositAmount, expiresAt]);

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

  const processBookingSubmit = async () => {
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
        let errorMsg = "Đặt bàn thất bại";
        if (data.non_field_errors) {
          errorMsg = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors;
        } else if (typeof data === 'object') {
          // Lấy lỗi đầu tiên từ bất kỳ field nào (như number_of_guests, booking_date...)
          const firstError = Object.values(data)[0];
          errorMsg = Array.isArray(firstError) ? firstError[0] : (typeof firstError === 'string' ? firstError : errorMsg);
        }
        throw new Error(errorMsg);
      }

      // Success
      const bookingId = Number(data?.data?.id ?? data?.id ?? 0) || null;
      setIsSuccess(true);
      setCreatedBookingId(bookingId);
      setAppliedVoucher(null);

      if (data?.data?.deposit_expires_at || data?.deposit_expires_at) {
        const nextExpiresAt = data?.data?.deposit_expires_at || data?.deposit_expires_at;
        setExpiresAt(nextExpiresAt);
        setCountdown(Math.max(0, Math.floor((new Date(nextExpiresAt).getTime() - Date.now()) / 1000)));
      }

      if (onSuccess && bookingId && depositAmount === 0) {
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

  const handleDepositConfirm = async () => {
    if (createdBookingId) {
      // Nếu đã có bookingId (đang ở màn hình thành công), thực hiện thanh toán
      try {
        setLoading(true);
        const { payment_url } = await createVNPAYUrl(createdBookingId);
        window.location.href = payment_url;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể khởi tạo thanh toán');
      } finally {
        setLoading(false);
      }
    } else {
      // Nếu chưa có bookingId (đang ở bước xác nhận ban đầu), tiến hành tạo booking trước
      setShowDepositModal(false);
      processBookingSubmit();
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5); // "HH:MM:SS" -> "HH:MM"
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] overflow-y-auto backdrop-blur-sm animate-fadeIn">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={`bg-white rounded-3xl ${isSuccess ? 'max-w-xl' : 'max-w-5xl'} w-full my-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden relative transition-all duration-500`}>
          {/* Header */}
          <div className={`relative bg-gradient-to-r from-amber-600 to-orange-600 ${isSuccess ? 'p-6' : 'p-8'} text-white transition-all`}>
            <div className="pr-12">
              <h2 className="text-2xl md:text-3xl font-bold flex items-center flex-wrap gap-x-3">
                <span className="opacity-90">Đặt bàn</span>
                <span className="text-amber-300 font-light">»</span>
                <span className="truncate">{restaurant.name}</span>
              </h2>
            </div>
            <button
              onClick={onClose}
              className={`absolute ${isSuccess ? 'top-6' : 'top-8'} right-6 p-2 bg-white/20 hover:bg-white/30 rounded-full transition text-white backdrop-blur-md`}
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
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-1">
                  {depositAmount > 0 ? "Thanh toán tiền cọc" : "Đặt bàn thành công!"}
                </h3>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 mb-4 max-w-md mx-auto">
                  <p className="text-gray-700 font-medium mb-2">
                    Trạng thái: {depositAmount > 0 ? (
                      <span className="text-orange-600 font-bold">CHỜ THANH TOÁN CỌC</span>
                    ) : (
                      <span className="text-green-600 font-bold">ĐÃ XÁC NHẬN TỰ ĐỘNG</span>
                    )}
                  </p>

                  {depositAmount > 0 && (
                    <>
                      <div className="text-center mb-4">
                        <p className="text-sm text-gray-500 mb-1">Số tiền cần cọc giữ chỗ</p>
                        <p className="text-4xl font-black text-orange-600">
                          {new Intl.NumberFormat('vi-VN').format(depositAmount)}đ
                        </p>
                      </div>

                      <div className="bg-white rounded-xl p-4 border border-orange-100 mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Đếm ngược thời gian thanh toán:</p>
                        <div className="text-3xl font-mono font-bold text-red-500">
                          {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDepositConfirm()}
                        disabled={countdown <= 0}
                        className="w-full bg-orange-500 text-white py-4 rounded-xl font-bold hover:bg-orange-600 transition shadow-lg shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {countdown > 0 ? 'Thanh toán cọc ngay' : 'Đã hết thời gian thanh toán'}
                      </button>
                    </>
                  )}

                  {depositAmount === 0 && (
                    <p className="text-gray-600">
                      Nhà hàng đã xác nhận chỗ của bạn. Hẹn gặp lại bạn vào thời gian đã đặt!
                    </p>
                  )}
                </div>

                <button
                  onClick={onClose}
                  className="mt-2 text-gray-500 font-medium hover:text-gray-700 transition"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Left Column: Schedule (3/5) */}
                <div className="lg:col-span-3 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        <Calendar className="w-4 h-4 inline mr-2" />
                        Ngày đặt bàn
                      </label>
                      <input
                        type="date"
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        min={getMinDate()}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        <Users className="w-4 h-4 inline mr-2" />
                        Số lượng khách
                      </label>
                      <select
                        value={numberOfGuests}
                        onChange={(e) => setNumberOfGuests(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all"
                      >
                        {Array.from(
                          { length: selectedSlot?.max_guests_per_booking || 20 },
                          (_, i) => i + 1
                        ).map((num) => (
                          <option key={num} value={num}>
                            {num} người
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Time Slots */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      <Clock className="w-4 h-4 inline mr-2" />
                      Khung giờ trống
                    </label>

                    {!bookingDate ? (
                      <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">Vui lòng chọn ngày để xem giờ trống</p>
                      </div>
                    ) : slotsLoading ? (
                      <div className="text-center py-12">
                        <Loader2 className="w-10 h-10 animate-spin text-amber-600 mx-auto" />
                        <p className="text-gray-400 mt-3 text-sm font-medium">Đang tìm khung giờ...</p>
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <div className="text-center py-12 bg-red-50/50 rounded-2xl border border-dashed border-red-100">
                        <AlertCircle className="w-10 h-10 text-red-200 mx-auto mb-3" />
                        <p className="text-red-400 text-sm">Rất tiếc, ngày này hiện không còn chỗ</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => setSelectedSlot(slot)}
                            className={`p-4 rounded-xl border-2 transition-all group ${selectedSlot?.id === slot.id
                              ? "border-amber-600 bg-amber-600 text-white shadow-lg shadow-amber-200"
                              : "border-gray-100 bg-gray-50 hover:border-amber-400 text-gray-700 hover:bg-white"
                              }`}
                          >
                            <div className="font-bold text-sm">
                              {formatTime(slot.start_time)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Info & Action (2/5) */}
                <div className="lg:col-span-2 flex flex-col h-full bg-gray-50/80 rounded-2xl p-6 border border-gray-100">
                  <div className="flex-1 space-y-6">
                    {/* Special request */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        <MessageSquare className="w-4 h-4 inline mr-2" />
                        Yêu cầu thêm
                      </label>
                      <textarea
                        value={specialRequest}
                        onChange={(e) => setSpecialRequest(e.target.value)}
                        placeholder="Ghi chú về vị trí ngồi, dị ứng..."
                        rows={3}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-none text-sm"
                      />
                    </div>

                    {/* Voucher */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        <Ticket className="w-4 h-4 inline mr-2" />
                        Khuyến mãi
                      </label>
                      {appliedVoucher ? (
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                          <div className="truncate">
                            <p className="font-bold text-green-700 text-sm">{appliedVoucher.code}</p>
                            <p className="text-[10px] text-green-600 truncate">{appliedVoucher.title}</p>
                          </div>
                          <button
                            onClick={() => setAppliedVoucher(null)}
                            className="p-1 hover:bg-green-100 rounded-full transition-colors text-green-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowVoucherModal(true)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-amber-500 hover:bg-amber-50 transition-all text-left group"
                        >
                          <span className="text-gray-400 text-sm">Chọn mã giảm giá</span>
                          <Ticket className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                        </button>
                      )}
                    </div>

                    {/* Summary Card - Always reserved space */}
                    <div className={`p-4 rounded-xl border transition-all ${selectedSlot ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-100/50 border-dashed border-gray-200'}`}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tóm tắt đơn đặt</p>
                      {selectedSlot ? (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <div className="text-[11px] text-gray-500">Thời gian:</div>
                          <div className="text-[11px] font-bold text-gray-800 text-right">{formatTime(selectedSlot.start_time)}, {new Date(bookingDate).toLocaleDateString("vi-VN")}</div>
                          <div className="text-[11px] text-gray-500">Số khách:</div>
                          <div className="text-[11px] font-bold text-gray-800 text-right">{numberOfGuests} người</div>
                          {depositAmount > 0 && (
                            <>
                              <div className="text-[11px] text-orange-600 font-medium">Tiền cọc:</div>
                              <div className="text-[11px] font-bold text-orange-600 text-right">{new Intl.NumberFormat('vi-VN').format(depositAmount)}đ</div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="py-2 text-center">
                          <p className="text-xs text-gray-400 italic">Vui lòng chọn khung giờ...</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <button
                      onClick={handleSubmit}
                      disabled={loading || !bookingDate || !selectedSlot}
                      className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-orange-200 transition-all disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Xác nhận đặt bàn
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-center text-gray-400 mt-3 italic">
                      Bằng việc xác nhận, bạn đồng ý với chính sách đặt bàn của chúng tôi.
                    </p>
                  </div>
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
            loading={loading}
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
    </div>
  );
}
