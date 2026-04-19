import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Building2,
  BookOpen,
  Ticket,
  Wallet,
  LogOut,
  Menu as MenuIcon,
  X,
  Clock,
  Compass
} from 'lucide-react';

import RestaurantList from '@/components/partner/RestaurantList';
import MenuManagement from '@/components/partner/MenuManagement';
import RestaurantImages from '@/components/partner/RestaurantImages';
import TimeSlotManagement from '@/components/partner/TimeSlotManagement';
import BookingList from '@/components/partner/BookingList';
import NotificationBell from '@/components/notifications/NotificationBell';
import PartnerWallet from '@/components/payments/PartnerWallet';
import VoucherManagement from '@/components/partner/VoucherManagement';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import DiscoveryManagement from '@/components/partner/DiscoveryManagement';

type Section = 'dashboard' | 'restaurants' | 'menu' | 'images' | 'slots' | 'bookings' | 'wallet' | 'promotions' | 'analytics' | 'discovery';

export default function Partner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const bookingIdParam = searchParams.get('bookingId');
  const restaurantIdParam = searchParams.get('restaurantId');
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentSection, setCurrentSection] = useState<Section>('dashboard');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [selectedRestaurantName, setSelectedRestaurantName] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [allRestaurants, setAllRestaurants] = useState<any[]>([]);

  // Handle URL deep linking
  useEffect(() => {
    if (sectionParam) {
      setCurrentSection(sectionParam as Section);
    } else if (bookingIdParam) {
      setCurrentSection('bookings');
    }

    if (restaurantIdParam) {
      setSelectedRestaurantId(restaurantIdParam);
    }
  }, [sectionParam, bookingIdParam, restaurantIdParam]);

  useEffect(() => {
    const token = localStorage.getItem('access');
    if (!token) {
      navigate('/login');
      return;
    }

    const userData = localStorage.getItem('user');
    if (userData) {
      const parsed = JSON.parse(userData);
      if (parsed.role !== 'PARTNER' && parsed.role !== 'ADMIN') {
        navigate('/');
        return;
      }
      setUser(parsed);
      fetchWallet();
      loadRestaurants();
    }

    // Auto-detect mobile to close sidebar
    const handleResize = () => {
      if (window.innerWidth < 1024) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [navigate]);

  const loadRestaurants = async () => {
    try {
      const { fetchMyRestaurants } = await import('@/lib/api');
      const data = await fetchMyRestaurants();
      setAllRestaurants(data);
    } catch (err) {
      console.error('Lỗi tải danh sách nhà hàng:', err);
    }
  };

  const fetchWallet = async () => {
    try {
      const { fetchWallets, fetchTransactions } = await import('@/lib/api');
      const [wallets, transactions] = await Promise.all([
        fetchWallets(),
        fetchTransactions()
      ]);

      if (wallets && wallets.length > 0) {
        const w = wallets[0];
        setWallet({
          balance: parseFloat(w.balance) + parseFloat(w.frozen_balance),
          availableBalance: parseFloat(w.balance),
          pendingBalance: parseFloat(w.frozen_balance),
          recentTransactions: transactions.map(tx => ({
             id: String(tx.id),
             type: tx.transaction_type,
             amount: parseFloat(tx.amount),
             description: getTxDescription(tx),
             status: tx.status === 'SUCCESS' ? 'COMPLETED' : tx.status,
             createdAt: new Date(tx.created_at).toLocaleString('vi-VN')
          }))
        });
      }
    } catch (err) {
      console.error('Lỗi tải ví:', err);
    }
  };

  const getTxDescription = (tx: any) => {
    if (tx.transaction_type === 'PAYMENT') return `Thanh toán cọc Booking #${tx.booking}`;
    if (tx.transaction_type === 'WITHDRAWAL') return `Rút tiền về tài khoản`;
    if (tx.transaction_type === 'DEPOSIT') return `Nhận tiền cọc từ khách`;
    if (tx.transaction_type === 'REFUND') return `Hoàn tiền cho khách`;
    return 'Giao dịch hệ thống';
  };

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleSelectRestaurant = (restaurant: any) => {
    setSelectedRestaurantId(String(restaurant.id));
    setSelectedRestaurantName(restaurant.name);
    if (currentSection === 'restaurants') {
      setCurrentSection('menu');
    }
  };

  const mainNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-400' },
    { id: 'bookings', label: 'Booking', icon: BookOpen, color: 'text-emerald-400' },
    { id: 'promotions', label: 'Khuyến mãi', icon: Ticket, color: 'text-purple-400' },
    { id: 'wallet', label: 'Ví Đối Tác', icon: Wallet, color: 'text-amber-400' },
    ...(user?.role === 'ADMIN' ? [{ id: 'discovery', label: 'Khám phá', icon: Compass, color: 'text-indigo-400' }] : []),
  ];

  const restaurantNavItems = [
    { id: 'restaurants', label: 'DS Nhà hàng', icon: Building2, color: 'text-orange-400' },
    { id: 'menu', label: 'Thực đơn', icon: UtensilsCrossed, disabled: !selectedRestaurantId },
    { id: 'images', label: 'Ảnh & Gallery', icon: Building2, disabled: !selectedRestaurantId },
    { id: 'slots', label: 'Lịch & Khung giờ', icon: Clock, disabled: !selectedRestaurantId },
  ];

  return (
    <div className="h-screen bg-[#020617] flex overflow-hidden font-sans selection:bg-orange-500/30 text-slate-200">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-[#0f172a] border-r border-slate-800 transition-all duration-300 transform ${
          sidebarOpen ? 'w-72 translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0 flex flex-col shadow-[10px_0_30px_rgba(0,0,0,0.5)]`}
      >
        <div className="p-6 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 transform hover:scale-105 transition-transform">
                <h1 className="text-xl font-black text-white italic">N4</h1>
             </div>
             <div>
                <p className="text-white font-bold leading-none tracking-tight">Partner</p>
                <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] mt-1 font-bold">Workspace</p>
             </div>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="p-2.5 bg-slate-800/50 rounded-xl text-slate-400 hover:text-white hover:bg-orange-500 transition-all border border-slate-700/50"
            title="Về trang chủ"
          >
            <LayoutDashboard className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-8 custom-scrollbar">
          {/* Restaurant Switcher */}
          <div className="px-2">
             <div className="flex items-center justify-between mb-3 px-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Quản lý cơ sở</p>
                <div className="h-px flex-1 bg-slate-800 ml-3"></div>
             </div>
             <div className="relative group">
                <select 
                  value={selectedRestaurantId || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    const rest = allRestaurants.find(r => String(r.id) === id);
                    if (rest) handleSelectRestaurant(rest);
                    else {
                      setSelectedRestaurantId(null);
                      setSelectedRestaurantName(null);
                    }
                  }}
                  className="w-full bg-[#1e293b]/50 hover:bg-[#1e293b] border border-slate-700 focus:border-orange-500 text-white px-4 py-3 rounded-2xl outline-none appearance-none cursor-pointer transition-all pr-10 font-bold text-sm shadow-inner group-hover:border-slate-600"
                >
                   <option value="">-- Tất cả hệ thống --</option>
                   {allRestaurants.map(r => (
                     <option key={r.id} value={r.id}>{r.name}</option>
                   ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-orange-500 transition-colors">
                   <Building2 className="w-4 h-4" />
                </div>
             </div>
          </div>

          {/* Main Navigation */}
          <div className="space-y-1.5">
            <p className="px-4 mb-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Tổng quan</p>
            {mainNavItems.map((item) => {
              const Icon = item.icon as any;
              const isActive = currentSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentSection(item.id as Section);
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                    isActive
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-xl shadow-orange-500/20 translate-x-1'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent hover:border-slate-700/50'
                  }`}
                >
                  <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'} ${item.color && !isActive ? item.color : ''}`} />
                  <span className="font-bold text-sm tracking-wide">{item.label}</span>
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                </button>
              );
            })}
          </div>

          {/* Restaurant Specific Section */}
          <div className="space-y-1.5">
            <p className="px-4 mb-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Cấu hình quán</p>
            {restaurantNavItems.map((item) => {
              const Icon = item.icon as any;
              const isActive = currentSection === item.id;
              const isDisabled = (item as any).disabled;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (!isDisabled) {
                        setCurrentSection(item.id as Section);
                        if (window.innerWidth < 1024) setSidebarOpen(false);
                    }
                  }}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                    isActive
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-xl shadow-orange-500/20 translate-x-1'
                      : isDisabled
                      ? 'text-slate-700 opacity-40 cursor-not-allowed'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent hover:border-slate-700/50'
                  }`}
                >
                  <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'} ${item.color && !isActive ? item.color : ''}`} />
                  <span className="font-bold text-sm tracking-wide">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User Profile Area */}
        <div className="p-6 bg-[#0f172a] border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-3 mb-6 p-2 bg-slate-900/50 rounded-2xl border border-slate-800">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-orange-400 font-black border border-slate-600 shadow-lg">
                {user?.name?.[0] || 'P'}
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white truncate leading-tight">{user?.name}</p>
                <p className="text-[10px] text-orange-500/80 truncate uppercase font-bold tracking-widest mt-0.5 italic">{user?.role}</p>
             </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all duration-300 border border-red-500/10 hover:border-red-500/20 font-black text-sm uppercase tracking-widest shadow-lg hover:shadow-red-500/20 group"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Background Decorative Gradient */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-orange-600/5 blur-[120px] rounded-full -mr-96 -mt-96 pointer-events-none z-0"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/5 blur-[120px] rounded-full -ml-48 -mb-48 pointer-events-none z-0"></div>
        
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[#020617]/80 backdrop-blur-2xl border-b border-slate-800 min-h-[80px] shrink-0 flex items-center px-6 lg:px-10 justify-between">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2.5 text-slate-300 hover:text-white bg-slate-800/80 rounded-xl hover:bg-orange-500 transition-all border border-slate-700"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
              </button>

              <div className="flex flex-col">
                 <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full font-bold uppercase tracking-tighter border border-slate-700">Root</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                    <span className="text-xs text-orange-500 font-black tracking-tight drop-shadow-[0_0_8px_rgba(249,115,22,0.3)] capitalize">
                       {selectedRestaurantName || 'Tất cả cơ sở'}
                    </span>
                 </div>
                 <h2 className="text-2xl font-black text-white tracking-tight">
                    {[...mainNavItems, ...restaurantNavItems].find((item: any) => item.id === currentSection)?.label}
                 </h2>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-4 px-5 py-2.5 bg-[#1e293b]/30 backdrop-blur-md rounded-2xl border border-slate-700/50 shadow-sm">
                 <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Status</span>
                    <span className="text-xs font-black text-emerald-400 mt-1">HỆ THỐNG ONLINE</span>
                 </div>
                 <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20"></div>
              </div>
              <NotificationBell position="right" />
            </div>
        </header>

        {/* Dynamic Content Area - SCROLL FIX HERE */}
        <main className="flex-1 overflow-y-auto no-scrollbar p-6 lg:p-10 z-10 custom-scrollbar-main">
          <div className="max-w-7xl mx-auto pb-20 animate-fadeIn">
            {currentSection === 'dashboard' && <AnalyticsDashboard restaurantId={selectedRestaurantId} />}

            {currentSection === 'restaurants' && (
              <RestaurantList
                onSelectRestaurant={handleSelectRestaurant}
              />
            )}

            {currentSection === 'menu' && (
              selectedRestaurantId ? (
                <MenuManagement restaurantId={selectedRestaurantId} />
              ) : (
                <RequireRestaurantView onGoToRestaurants={() => setCurrentSection('restaurants')} />
              )
            )}

            {currentSection === 'images' && (
              selectedRestaurantId ? (
                <RestaurantImages restaurantId={selectedRestaurantId} />
              ) : (
                <RequireRestaurantView onGoToRestaurants={() => setCurrentSection('restaurants')} />
              )
            )}

            {currentSection === 'slots' && (
              selectedRestaurantId ? (
                <TimeSlotManagement restaurantId={selectedRestaurantId} />
              ) : (
                <RequireRestaurantView onGoToRestaurants={() => setCurrentSection('restaurants')} />
              )
            )}

            {currentSection === 'bookings' && (
              <BookingList 
                restaurantId={selectedRestaurantId} 
                highlightId={bookingIdParam}
              />
            )}

            {currentSection === 'wallet' && (
              <PartnerWallet 
                wallet={wallet || {
                  balance: 0,
                  availableBalance: 0,
                  pendingBalance: 0,
                  recentTransactions: []
                }} 
              />
            )}

            {currentSection === 'promotions' && <VoucherManagement />}

            {currentSection === 'discovery' && <DiscoveryManagement />}
          </div>
        </main>
      </div>
    </div>
  );
}

// Helper views for empty states
function RequireRestaurantView({ onGoToRestaurants }: { onGoToRestaurants: () => void }) {
  return (
    <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-12 lg:p-20 text-center shadow-2xl relative overflow-hidden group transition-all duration-500 hover:shadow-orange-500/5">
       <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-30"></div>
       <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-orange-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-[0_20px_50px_rgba(249,115,22,0.3)] transform group-hover:rotate-6 transition-transform">
          <Building2 className="w-12 h-12 text-white" />
       </div>
       <h3 className="text-3xl font-black text-white mb-4 tracking-tight">Chưa xác định cơ sở</h3>
       <p className="text-slate-400 max-w-md mx-auto mb-10 text-lg leading-relaxed font-medium">Bạn cần chọn một chi nhánh nhà hàng từ <b>Danh sách</b> hoặc <b>Dropdown</b> tại thanh menu bên trái để bắt đầu quản lý nghiệp vụ.</p>
       <button 
         onClick={onGoToRestaurants}
         className="px-10 py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all shadow-[0_15px_30px_rgba(249,115,22,0.2)] hover:shadow-orange-500/40 hover:-translate-y-1 active:scale-95 uppercase tracking-widest text-sm"
       >
         Đi tới danh sách nhà hàng
       </button>
    </div>
  );
}
