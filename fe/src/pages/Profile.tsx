// src/pages/Profile.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Utensils,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  Ticket,
  Camera,
  Key,
  Loader2,
} from "lucide-react";
import VoucherList from "@/components/promotions/VoucherList";
import Header from "@/components/common/Header";
import Footer from "@/components/common/Footer";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

interface UserInfo {
  id: number;
  phone_number: string;
  email?: string | null;
  full_name?: string | null;
  role: "CUSTOMER" | "PARTNER" | "ADMIN" | string;
  created_at: string;
  avatar_url?: string | null;
}

interface CustomerInfo {
  phone_number: string;
  email: string;
  full_name: string;
  date_of_birth?: string | null;
  address?: string | null;
  loyalty_points: number;
  total_bookings: number;
}

interface PartnerInfo {
  phone_number: string;
  email: string;
  full_name: string;
  business_name: string;
  business_license?: string | null;
  tax_code?: string | null;
  status: string;
}

interface ProfileResponse {
  user: UserInfo;
  customer?: CustomerInfo;
  partner?: PartnerInfo;
}

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Avatar states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Password states
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const access = localStorage.getItem("access");
    if (!access) {
      navigate("/login");
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/accounts/profile/`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access}`,
          },
        });

        if (res.status === 401) {
          // token hết hạn hoặc không hợp lệ
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
          localStorage.removeItem("user");
          navigate("/login");
          return;
        }

        const data = (await res.json()) as ProfileResponse;

        if (!res.ok) {
          throw new Error(
            (data as any)?.detail || (data as any)?.error || "Không lấy được thông tin hồ sơ"
          );
        }

        setProfile(data);
        // Cập nhật lại localStorage user cho header (nếu muốn)
        localStorage.setItem("user", JSON.stringify(data.user));
      } catch (err: any) {
        console.error("Profile error:", err);
        setError(err.message || "Có lỗi xảy ra");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Ảnh quá lớn. Vui lòng chọn ảnh < 5MB.");
      return;
    }

    const access = localStorage.getItem("access");
    if (!access) return;

    const formData = new FormData();
    formData.append("avatar", file);

    setUploadingAvatar(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounts/avatar/upload/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi upload ảnh");

      // Cập nhật profile & localStorage
      if (profile) {
        setProfile({ ...profile, user: data.user });
      }
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Lỗi cập nhật ảnh đại diện");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    const access = localStorage.getItem("access");
    if (!access) return;

    setSavingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounts/change-password/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể đổi mật khẩu");
      }

      setPasswordSuccess("Đổi mật khẩu thành công!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setIsChangingPassword(false), 2000);
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const user = profile?.user;
  const customer = profile?.customer;
  const partner = profile?.partner;

  const roleLabel =
    user?.role === "CUSTOMER"
      ? "Khách hàng"
      : user?.role === "PARTNER"
      ? "Đối tác nhà hàng"
      : user?.role === "ADMIN"
      ? "Quản trị viên"
      : user?.role || "Người dùng";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
            <UserIcon className="w-7 h-7 text-amber-600" />
            <span>Trang cá nhân</span>
          </h1>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl shadow-md p-6 text-center text-gray-600">
            Đang tải thông tin...
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 mb-4">
            {error}
          </div>
        )}

        {!loading && !error && user && (
          <div className="bg-white rounded-2xl shadow-md p-6 space-y-6">
            {/* Thông tin chính */}
            <div className="flex items-center space-x-4 border-b border-slate-100 pb-4 relative">
              <label 
                htmlFor="avatar-upload"
                className="relative w-20 h-20 rounded-full cursor-pointer group flex-shrink-0"
              >
                {user.avatar_url ? (
                  <img
                    src={`${API_BASE}${user.avatar_url}`}
                    alt="Avatar"
                    className="w-full h-full object-cover rounded-full border-2 border-slate-200"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-3xl font-bold">
                    {(user.full_name || user.phone_number || "?")
                      .toString()
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingAvatar ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </div>
                <input 
                  type="file" 
                  id="avatar-upload" 
                  accept="image/png, image/jpeg, image/jpg" 
                  className="hidden" 
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                />
              </label>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900">
                  {user.full_name || user.phone_number}
                </h2>
                <p className="text-sm text-gray-600">{roleLabel}</p>
              </div>
              <button
                onClick={() => setIsChangingPassword(!isChangingPassword)}
                className="flex items-center space-x-1 text-sm font-medium text-amber-600 hover:text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Key className="w-4 h-4" />
                <span>Đổi mật khẩu</span>
              </button>
            </div>

            {/* Form đổi mật khẩu */}
            {isChangingPassword && (
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                  <Key className="w-5 h-5 text-gray-500" />
                  <span>Thay đổi mật khẩu</span>
                </h3>
                {passwordError && (
                  <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="mb-4 text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-100">
                    {passwordSuccess}
                  </div>
                )}
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <input
                      type="password"
                      placeholder="Mật khẩu hiện tại"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      placeholder="Xác nhận mật khẩu mới"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordError("");
                        setPasswordSuccess("");
                      }}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                      disabled={savingPassword}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="flex items-center space-x-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {savingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Lưu thay đổi</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Liên hệ */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800 mb-2">
                Thông tin liên hệ
              </h3>
              <div className="flex items-center space-x-3 text-gray-700">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>{user.phone_number}</span>
              </div>
              {user.email && (
                <div className="flex items-center space-x-3 text-gray-700">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{user.email}</span>
                </div>
              )}
              {customer?.address && (
                <div className="flex items-center space-x-3 text-gray-700">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{customer.address}</span>
                </div>
              )}
            </div>

            {/* Thông tin khách hàng */}
            {customer && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <h3 className="font-semibold text-gray-800 mb-2">
                  Thông tin khách hàng
                </h3>
                {customer.date_of_birth && (
                  <div className="flex items-center space-x-3 text-gray-700">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>Ngày sinh: {customer.date_of_birth}</span>
                  </div>
                )}
                <div className="flex items-center space-x-3 text-gray-700">
                  <span>
                    Điểm tích lũy:{" "}
                    <b>{customer.loyalty_points ?? 0}</b>
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-gray-700">
                  <span>
                    Số lần đặt bàn:{" "}
                    <b>{customer.total_bookings ?? 0}</b>
                  </span>
                </div>
              </div>
            )}

            {/* Thông tin đối tác */}
            {partner && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <h3 className="font-semibold text-gray-800 mb-2">
                  Thông tin nhà hàng
                </h3>
                <div className="flex items-center space-x-3 text-gray-700">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  <span>{partner.business_name}</span>
                </div>
                {partner.business_license && (
                  <div className="flex items-center space-x-3 text-gray-700">
                    <span>GPKD: {partner.business_license}</span>
                  </div>
                )}
                {partner.tax_code && (
                  <div className="flex items-center space-x-3 text-gray-700">
                    <span>Mã số thuế: {partner.tax_code}</span>
                  </div>
                )}
                <div className="flex items-center space-x-3 text-gray-700">
                  <span>Trạng thái: {partner.status}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !error && user?.role === "CUSTOMER" && (
          <div className="mt-8 space-y-8">
            <CustomerVouchers customerData={customer} />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function CustomerVouchers({ customerData }: { customerData: any }) {
  const [userVouchers, setUserVouchers] = useState<any[]>([]);
  const [rewardVouchers, setRewardVouchers] = useState<any[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(true);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);

  useEffect(() => {
    const loadVouchers = async () => {
      try {
        setLoadingVouchers(true);
        // We import dynamically to avoid circular dependencies if any, but since it's just a file level edit, it's safer to use the functions if they were imported. Wait, they aren't imported.
        // Let's use direct API calls or import inside the component.
        const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
        const access = localStorage.getItem("access");
        
        const [uvRes, rvRes] = await Promise.all([
          fetch(`${API_BASE}/api/promotions/my-vouchers/`, { headers: { Authorization: `Bearer ${access}` } }),
          fetch(`${API_BASE}/api/promotions/vouchers/`, { headers: { Authorization: `Bearer ${access}` } })
        ]);
        
        let uvData: any = [];
        let rvData: any = [];
        
        if (uvRes.ok) {
          const uvd = await uvRes.json();
          uvData = uvd.results ?? uvd ?? [];
        }
        if (rvRes.ok) {
          const rvd = await rvRes.json();
          rvData = rvd.results ?? rvd ?? [];
        }
        
        const mappedUvData = uvData.map((uv: any) => ({
          id: String(uv.id),
          code: uv.voucher_details.code,
          title: `Giảm ${uv.voucher_details.discount_value}${uv.voucher_details.voucher_type === 'PERCENTAGE' ? '%' : 'K'}`,
          description: uv.voucher_details.description,
          discountType: uv.voucher_details.voucher_type === 'PERCENTAGE' ? 'PERCENT' : 'FIXED',
          discountValue: Number(uv.voucher_details.discount_value),
          minSpend: Number(uv.voucher_details.min_order_value || 0),
          validUntil: new Date(uv.voucher_details.valid_to).toLocaleDateString('vi-VN'),
          isUsed: uv.is_used,
          restaurantName: uv.voucher_details.restaurant_name
        }));
        
        setUserVouchers(mappedUvData);
        setRewardVouchers(rvData.filter((v: any) => v.points_cost && v.points_cost > 0));
        
      } catch (err) {
        console.error("Lỗi tải voucher:", err);
      } finally {
        setLoadingVouchers(false);
      }
    };
    
    loadVouchers();
  }, []);

  const handleRedeem = async (voucherId: number, cost: number) => {
    if (customerData.loyalty_points < cost) {
      alert(`Bạn không có đủ điểm. Yêu cầu: ${cost} điểm.`);
      return;
    }
    
    if (!confirm(`Xác nhận đổi voucher này với ${cost} điểm?`)) return;
    
    try {
      setRedeemingId(voucherId);
      const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
      const access = localStorage.getItem("access");
      const res = await fetch(`${API_BASE}/api/promotions/vouchers/${voucherId}/collect/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Đổi voucher thất bại");
      
      alert("Đổi điểm thành công! Voucher đã được thêm vào ví.");
      // Tải lại trang để cập nhật điểm và ví voucher
      window.location.reload();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setRedeemingId(null);
    }
  };

  if (loadingVouchers) return <div className="text-center text-gray-500 py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center space-x-3">
          <Ticket className="w-6 h-6 text-amber-600" />
          <span>Ví Voucher Của Tôi</span>
        </h2>
        <VoucherList vouchers={userVouchers} />
      </div>
      
      {rewardVouchers.length > 0 && (
        <div className="pt-8 border-t border-slate-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-3">
            <span className="text-2xl">🎁</span>
            <span>Đổi Điểm Nhận Quà</span>
          </h2>
          <p className="text-slate-500 mb-6">Sử dụng điểm Loyalty để đổi lấy các ưu đãi độc quyền.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rewardVouchers.map(v => (
              <div key={v.id} className="bg-white rounded-2xl border border-amber-200 p-5 flex flex-col hover:shadow-lg transition">
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
                    {v.points_cost} ĐIỂM
                  </div>
                  <span className="text-gray-400 text-sm font-medium">{v.restaurant_name || "Trang chủ"}</span>
                </div>
                <h3 className="font-bold text-lg mb-1">{v.code} - Giảm {v.discount_value}{v.voucher_type === 'PERCENTAGE' ? '%' : 'VNĐ'}</h3>
                <p className="text-gray-600 text-sm mb-4 flex-1">{v.description}</p>
                
                <button 
                  onClick={() => handleRedeem(v.id, v.points_cost)}
                  disabled={redeemingId === v.id || customerData.loyalty_points < v.points_cost}
                  className={`w-full py-2.5 rounded-xl font-bold transition flex items-center justify-center ${
                    customerData.loyalty_points >= v.points_cost 
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {redeemingId === v.id ? <Loader2 className="w-5 h-5 animate-spin" /> : "Đổi ngay"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
