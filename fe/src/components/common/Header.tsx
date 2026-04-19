import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Utensils, User, LogOut, UserCircle2, Briefcase, CalendarCheck, ShieldCheck, Heart } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export default function Header() {
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    const access = localStorage.getItem("access");
    setIsLoggedIn(!!access);

    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch {
        setCurrentUser(null);
      }
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setLogoutLoading(true);
    setAccountMenuOpen(false);
    try {
      const refresh = localStorage.getItem("refresh");
      const access = localStorage.getItem("access");

      if (refresh) {
        try {
          await fetch(`${API_BASE}/api/accounts/logout/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(access ? { Authorization: `Bearer ${access}` } : {}),
            },
            body: JSON.stringify({ refresh }),
          });
        } catch (err) {
          console.error("Logout request error:", err);
        }
      }
    } finally {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("user");
      setIsLoggedIn(false);
      setCurrentUser(null);
      setLogoutLoading(false);
      navigate("/");
    }
  }, [navigate]);

  const displayName =
    currentUser?.full_name ||
    currentUser?.phone_number ||
    currentUser?.email ||
    "Tài khoản";

  const getRoleButton = () => {
    if (!isLoggedIn) {
      return (
        <Link
          to="/register_partner"
          className="text-orange-600 hover:text-orange-700 font-semibold transition"
        >
          Đối tác
        </Link>
      );
    }

    switch (currentUser?.role) {
      case "PARTNER":
        return (
          <Link
            to="/partner"
            className="flex items-center space-x-2 text-orange-600 hover:text-orange-700 font-semibold transition"
          >
            <Briefcase className="w-5 h-5" />
            <span>Quản lý nhà hàng</span>
          </Link>
        );
      case "CUSTOMER":
        return (
          <Link
            to="/my-bookings"
            className="flex items-center space-x-2 text-orange-600 hover:text-orange-700 font-semibold transition"
          >
            <CalendarCheck className="w-5 h-5" />
            <span>Đặt bàn của tôi</span>
          </Link>
        );
      case "ADMIN":
        return (
          <Link
            to="/admin"
            className="flex items-center space-x-2 text-orange-600 hover:text-orange-700 font-semibold transition"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>Admin Panel</span>
          </Link>
        );
      default:
        return null;
    }
  };

  return (
    <header className="bg-white sticky top-0 z-40 shadow-sm border-b border-gray-100">
      <nav className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <Utensils className="w-6 h-6 text-red-600" />
          <Link to="/">
            <span className="text-xl font-bold bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">
              TableBooking
            </span>
          </Link>
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center space-x-5 text-sm font-medium text-gray-700">
          <Link to="/explore" className="hover:text-red-600 transition-colors whitespace-nowrap">Gần bạn</Link>
          <a href="#" className="hover:text-red-600 transition-colors whitespace-nowrap">Bộ sưu tập</a>
          <a href="#" className="flex items-center gap-0.5 hover:text-red-600 transition-colors whitespace-nowrap">
            Ăn uống
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </a>
          <Link to="/discovery" className="hover:text-red-600 transition-colors whitespace-nowrap">Nhà hàng uy tín</Link>
          <a href="#" className="hover:text-red-600 transition-colors font-semibold text-red-600 whitespace-nowrap">Ưu đãi hot</a>
          <a href="#" className="hover:text-red-600 transition-colors whitespace-nowrap">Mới nhất</a>
          <a href="#" className="flex items-center gap-0.5 hover:text-red-600 transition-colors whitespace-nowrap">
            Tin tức &amp; Blog
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </a>
          <a href="#" className="flex items-center gap-0.5 hover:text-red-600 transition-colors whitespace-nowrap">
            Video
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </a>
        </div>

        {/* Right side: bell + account */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {isLoggedIn && <NotificationBell position="right" />}
          {isLoggedIn ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-gray-700 hover:text-red-600 font-medium text-sm transition-colors"
              >
                <UserCircle2 className="w-5 h-5" />
                <span className="max-w-[100px] truncate">{displayName}</span>
              </button>
              {accountMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-2 text-sm z-50">
                  <button onClick={() => { setAccountMenuOpen(false); navigate("/profile"); }} className="w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 text-left">
                    <User className="w-4 h-4 text-red-500" /><span>Trang cá nhân</span>
                  </button>
                  <button onClick={() => { setAccountMenuOpen(false); navigate("/favorites"); }} className="w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 text-left">
                    <Heart className="w-4 h-4 text-red-500" /><span>Nhà hàng yêu thích</span>
                  </button>
                  {(() => { const btn = getRoleButton(); return btn ? <div className="px-4 py-2">{btn}</div> : null; })()}
                  <button onClick={handleLogout} disabled={logoutLoading} className="w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 text-left text-red-600">
                    <LogOut className="w-4 h-4" />
                    <span>{logoutLoading ? "Đang đăng xuất..." : "Đăng xuất"}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-1.5 rounded-full transition-colors">
              <User className="w-3.5 h-3.5" /><span>Đăng nhập</span>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
