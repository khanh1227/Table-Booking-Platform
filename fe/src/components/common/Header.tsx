import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Utensils, User, LogOut, UserCircle2, Briefcase, CalendarCheck, ShieldCheck, Heart } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

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

  const getRoleLinks = () => {
    if (!isLoggedIn) {
      return (
        <div className="px-4 py-2">
          <Link to="/register_partner" className="text-orange-600 hover:text-orange-700 font-semibold transition">
            Đối tác
          </Link>
        </div>
      );
    }

    const links = [];

    // Always add "Đặt bàn của tôi" for logged in users
    links.push(
      <button key="my-bookings" onClick={() => { setAccountMenuOpen(false); navigate("/my-bookings"); }} className="w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 text-left text-orange-600 hover:text-orange-700 font-semibold transition">
        <CalendarCheck className="w-5 h-5" />
        <span>Đặt bàn của tôi</span>
      </button>
    );

    if (currentUser?.role === "PARTNER") {
      links.push(
        <button key="partner-panel" onClick={() => { setAccountMenuOpen(false); navigate("/partner"); }} className="w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 text-left text-orange-600 hover:text-orange-700 font-semibold transition">
          <Briefcase className="w-5 h-5" />
          <span>Quản lý nhà hàng</span>
        </button>
      );
    } else if (currentUser?.role === "ADMIN") {
      links.push(
        <button key="admin-panel" onClick={() => { setAccountMenuOpen(false); navigate("/admin"); }} className="w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 text-left text-orange-600 hover:text-orange-700 font-semibold transition">
          <ShieldCheck className="w-5 h-5" />
          <span>Admin Panel</span>
        </button>
      );
    }

    return links;
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
        <div className="hidden md:flex items-center space-x-3 lg:space-x-5 text-sm font-medium text-gray-700 min-w-0 flex-1 justify-center px-4 overflow-hidden">
          <Link 
            to="/explore" 
            className={`transition-colors whitespace-nowrap hover:text-red-600 ${location.pathname === '/explore' ? 'text-red-600 font-bold' : ''}`}
          >
            Khám phá
          </Link>
          <Link 
            to="/collections" 
            className={`transition-colors whitespace-nowrap hover:text-red-600 ${location.pathname.startsWith('/collection') ? 'text-red-600 font-bold' : ''}`}
          >
            Bộ sưu tập
          </Link>
          <a href="#" className="flex items-center gap-0.5 hover:text-red-600 transition-colors whitespace-nowrap">
            Ăn uống
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </a>
          <a href="#" className="hover:text-red-600 transition-colors whitespace-nowrap">Ưu đãi hot</a>
          <a href="#" className="hover:text-red-600 transition-colors whitespace-nowrap">Mới nhất</a>
          <Link 
            to="/community" 
            className={`flex items-center gap-0.5 transition-colors whitespace-nowrap hover:text-red-600 ${location.pathname.startsWith('/community') ? 'text-red-600 font-bold' : ''}`}
          >
            Tin tức & Blog
          </Link>
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
                <span className="max-w-[180px] truncate">{displayName}</span>
              </button>
              {accountMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-2 text-sm z-50">
                  <button onClick={() => { setAccountMenuOpen(false); navigate("/profile"); }} className="w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 text-left">
                    <User className="w-4 h-4 text-red-500" /><span>Trang cá nhân</span>
                  </button>
                  <button onClick={() => { setAccountMenuOpen(false); navigate("/favorites"); }} className="w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 text-left">
                    <Heart className="w-4 h-4 text-red-500" /><span>Nhà hàng yêu thích</span>
                  </button>
                  {getRoleLinks()}
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
