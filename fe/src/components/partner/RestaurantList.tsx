// components/partner/RestaurantList.tsx
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertCircle, Building2, ArrowRight } from 'lucide-react';
import { fetchMyRestaurants, deleteRestaurant } from '@/lib/api'; // ✅ Đổi thành fetchMyRestaurants
import RestaurantForm from './RestaurantForm';

interface RestaurantListProps {
  onSelectRestaurant: (restaurant: any) => void;
}

export default function RestaurantList({ onSelectRestaurant }: RestaurantListProps) {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      const data = await fetchMyRestaurants(); // ✅ Dùng API mới - chỉ lấy nhà hàng của mình
      setRestaurants(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn chắc chắn muốn xóa nhà hàng này?')) return;

    try {
      await deleteRestaurant(id);
      setRestaurants(restaurants.filter((r) => r.id !== Number(id)));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingId(null);
    loadRestaurants();
  };

  if (showForm) {
    return (
      <RestaurantForm
        restaurantId={editingId || undefined}
        onSuccess={handleFormSubmit}
        onCancel={() => {
          setShowForm(false);
          setEditingId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0f172a]/40 backdrop-blur-md p-6 rounded-[2rem] border border-slate-800 shadow-xl">
        <div>
           <h2 className="text-3xl font-black text-white tracking-tight">Hệ thống cơ sở</h2>
           <p className="text-slate-500 text-sm font-medium mt-1">Quản lý và cập nhật thông tin các chi nhánh của bạn</p>
        </div>

        <button
          onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}
          className="flex items-center gap-3 px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-orange-500/20 active:scale-95 uppercase tracking-widest text-xs"
        >
          <Plus className="w-5 h-5" />
          Thêm cơ sở mới
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-5 rounded-2xl animate-shake flex items-start gap-4">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
           <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
           <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Đang truy xuất dữ liệu...</p>
        </div>
      ) : restaurants.length === 0 ? (
        // Empty
        <div className="bg-[#0f172a]/60 border-2 border-dashed border-slate-800 rounded-[3rem] p-20 text-center group hover:border-orange-500/30 transition-colors">
          <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
             <Building2 className="w-10 h-10 text-slate-600 group-hover:text-orange-500 transition-colors" />
          </div>
          <p className="text-slate-400 mb-8 font-medium text-lg">Hệ thống ghi nhận bạn chưa có cơ sở nào được đăng ký.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#1e293b] hover:bg-orange-500 text-white font-black rounded-2xl transition-all border border-slate-700 hover:border-orange-400 uppercase tracking-widest text-xs"
          >
            <Plus className="w-5 h-5" />
            Bắt đầu tạo cơ sở đầu tiên
          </button>
        </div>
      ) : (
        // List
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {restaurants.map((restaurant) => (
            <div
              key={restaurant.id}
              className="group bg-[#0f172a]/60 backdrop-blur-md border border-slate-800 rounded-[2.5rem] overflow-hidden hover:border-orange-500/50 transition-all duration-500 shadow-lg hover:shadow-orange-500/5 flex flex-col"
            >
              <div className="p-8 flex-1">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1 opacity-80">Chi nhánh #{restaurant.id}</span>
                     <h3 className="text-2xl font-black text-white group-hover:text-orange-400 transition-colors leading-tight">{restaurant.name}</h3>
                  </div>
                  
                  {/* Status Badge */}
                  <span className={`px-4 py-1.5 text-[10px] font-black rounded-full uppercase tracking-widest border transition-all duration-500 ${
                    restaurant.status === 'APPROVED' ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' :
                    restaurant.status === 'PENDING' ? 'bg-amber-500/5 text-amber-400 border-amber-500/20' :
                    restaurant.status === 'SUSPENDED' ? 'bg-red-500/5 text-red-400 border-red-500/20' :
                    'bg-slate-500/5 text-slate-400 border-slate-500/20'
                  }`}>
                    {restaurant.status === 'APPROVED' ? 'Đã kích hoạt' :
                     restaurant.status === 'PENDING' ? 'Đang chờ duyệt' :
                     restaurant.status === 'SUSPENDED' ? 'Đang tạm dừng' : 'Ngừng hoạt động'}
                  </span>
                </div>

                {restaurant.description && (
                  <p className="text-slate-400 text-sm mb-8 line-clamp-3 leading-relaxed font-medium">
                    {restaurant.description}
                  </p>
                )}

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-slate-900/40 rounded-3xl border border-slate-800/50 mb-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vị trí</p>
                    <p className="text-sm text-slate-300 font-bold truncate">{restaurant.address}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hotline</p>
                    <p className="text-sm text-slate-300 font-bold">{restaurant.phone_number}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ẩm thực</p>
                    <p className="text-sm text-slate-300 font-bold">{restaurant.cuisine_type || 'Đang cập nhật'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hoạt động</p>
                    <p className="text-sm text-slate-300 font-bold">
                       {restaurant.opening_time ? `${restaurant.opening_time.slice(0,5)} - ${restaurant.closing_time.slice(0,5)}` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-800/50 mt-auto">
                  <button
                    onClick={() => onSelectRestaurant(restaurant)}
                    className="flex-1 min-w-[140px] px-6 py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-orange-500/10 hover:shadow-orange-500/30 uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                  >
                    <span>Quản lý nghiệp vụ</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setEditingId(String(restaurant.id));
                        setShowForm(true);
                      }}
                      className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-all border border-slate-700 shadow-sm group/btn"
                      title="Chỉnh sửa cơ bản"
                    >
                      <Edit2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                    </button>

                    <button
                      onClick={() => handleDelete(String(restaurant.id))}
                      className="p-4 bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all border border-red-500/10 hover:border-red-500/30 shadow-sm group/btn"
                      title="Gỡ bỏ cơ sở"
                    >
                      <Trash2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}