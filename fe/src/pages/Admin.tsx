import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  LogOut,
  Menu as MenuIcon,
  X,
  ShieldCheck,
  Megaphone,
  ShieldAlert
} from 'lucide-react';

import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminRestaurantApproval from '@/components/admin/AdminRestaurantApproval';
import AdminPartnerList from '@/components/admin/AdminPartnerList';
import AdminUserList from '@/components/admin/AdminUserList';
import AdminMarketing from '@/components/admin/AdminMarketing';
import AdminReviewModeration from '@/components/admin/AdminReviewModeration';

type Section = 'dashboard' | 'approvals' | 'partners' | 'users' | 'marketing' | 'reviews';

export default function Admin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentSection, setCurrentSection] = useState<Section>('dashboard');
  const [user, setUser] = useState<any>(null);

  // Handle URL deep linking
  useEffect(() => {
    if (sectionParam) {
      setCurrentSection(sectionParam as Section);
    }
  }, [sectionParam]);

  useEffect(() => {
    const token = localStorage.getItem('access');
    if (!token) {
      navigate('/login');
      return;
    }

    const userData = localStorage.getItem('user');
    if (userData) {
      const parsed = JSON.parse(userData);
      if (parsed.role !== 'ADMIN') {
        navigate('/');
        return;
      }
      setUser(parsed);
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

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
    navigate('/');
  };

  const navItems = [
    { id: 'dashboard', label: 'TỔNG QUAN HỆ THỐNG', icon: LayoutDashboard, color: 'text-blue-400' },
    { id: 'approvals', label: 'DUYỆT NHÀ HÀNG', icon: Building2, color: 'text-amber-400' },
    { id: 'partners', label: 'QUẢN LÝ ĐỐI TÁC', icon: Briefcase, color: 'text-emerald-400' },
    { id: 'users', label: 'QUẢN LÝ NGƯỜI DÙNG', icon: Users, color: 'text-purple-400' },
    { id: 'marketing', label: 'QUẢN LÝ MARKETING', icon: Megaphone, color: 'text-fuchsia-400' },
    { id: 'reviews', label: 'KIỂM DUYỆT ĐÁNH GIÁ', icon: ShieldAlert, color: 'text-red-400' },
  ];

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden font-sans selection:bg-rose-500/30">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 transition-all duration-300 transform ${
          sidebarOpen ? 'w-72 translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0 flex flex-col shadow-xl shadow-slate-200/50`}
      >
        <div className="p-6 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/30 transform hover:scale-105 transition-transform">
                <ShieldCheck className="w-6 h-6 text-white" />
             </div>
             <div>
                <p className="font-bold leading-none tracking-tight text-slate-800">Admin Control</p>
                <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] mt-1 font-bold">System Root</p>
             </div>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="p-2.5 bg-slate-100 rounded-xl text-slate-500 hover:text-white hover:bg-rose-500 transition-all"
            title="Về trang chủ"
          >
            <LayoutDashboard className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2 mt-4">
          <p className="px-4 mb-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tính Năng</p>
          {navItems.map((item) => {
            const Icon = item.icon as any;
            const isActive = currentSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentSection(item.id as Section);
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group ${
                  isActive
                    ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/20 translate-x-1 font-bold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'} ${item.color && !isActive ? item.color : ''}`} />
                <span className="text-sm tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* User Profile Area */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-3 mb-6 p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
             <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-rose-600 font-black">
                {user?.name?.[0] || 'A'}
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800 truncate leading-tight">{user?.name}</p>
                <p className="text-[10px] text-rose-500 truncate uppercase font-bold tracking-widest mt-0.5">Quản Trị Viên</p>
             </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white hover:bg-red-50 text-red-500 rounded-xl transition-all duration-300 border border-red-100 font-bold text-sm shadow-sm group"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            ĐỨT KẾT NỐI
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 min-h-[80px] shrink-0 flex items-center px-6 lg:px-10 justify-between">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2.5 text-slate-500 hover:text-white bg-slate-100 rounded-xl hover:bg-rose-500 transition-all"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
              </button>

              <div className="flex flex-col">
                 <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full font-bold uppercase tracking-widest">HỆ THỐNG</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                    <span className="text-xs text-slate-500 font-bold tracking-tight">
                       Control Panel
                    </span>
                 </div>
                 <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                    {navItems.find((item: any) => item.id === currentSection)?.label}
                 </h2>
              </div>
            </div>
        </header>

        {/* Dynamic Content Area */}
        <main className="flex-1 overflow-y-auto no-scrollbar p-6 lg:p-10 z-10 custom-scrollbar-main bg-slate-50/50">
          <div className="max-w-7xl mx-auto pb-20 animate-fadeIn">
            {currentSection === 'dashboard' && <AdminDashboard />}
            {currentSection === 'approvals' && <AdminRestaurantApproval />}
            {currentSection === 'partners' && <AdminPartnerList />}
            {currentSection === 'users' && <AdminUserList />}
            {currentSection === 'marketing' && <AdminMarketing />}
            {currentSection === 'reviews' && <AdminReviewModeration />}
          </div>
        </main>
      </div>
    </div>
  );
}
