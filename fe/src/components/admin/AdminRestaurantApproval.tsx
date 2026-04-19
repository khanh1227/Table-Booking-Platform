import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Building2, MapPin } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export default function AdminRestaurantApproval() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const fetchRestaurants = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/restaurants/restaurants/my-restaurants/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        // data from API is array (as Admin fetches all without pagination currently or with pagination depending on the endpoint setup, assuming array returned by RestaurantViewSet for DRF)
        setRestaurants(data.results || data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const handleAction = async (id: number, actionType: string) => {
    if (!confirm(`Bạn có chắc chắn muốn ${actionType === 'approve' ? 'DUYỆT' : 'TỪ CHỐI'} nhà hàng này?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/restaurants/restaurants/${id}/admin-action/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        },
        body: JSON.stringify({ action_type: actionType })
      });
      
      if (res.ok) {
        alert('Cập nhật trạng thái thành công');
        fetchRestaurants();
      } else {
        const error = await res.json();
        alert(error.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const filtered = restaurants.filter(r => filter === 'ALL' || r.status === filter);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-rose-500" />
            Duyệt Xét Cơ Sở
          </h2>
          <p className="text-sm text-slate-500 mt-1">Xác thực hệ thống nhà hàng đăng ký bởi Partner</p>
        </div>
        
        <div className="flex items-center gap-2">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filter === f 
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest font-bold">
              <th className="p-4 border-b border-slate-200">ID</th>
              <th className="p-4 border-b border-slate-200">Nhà Hàng</th>
              <th className="p-4 border-b border-slate-200">Đối Tác</th>
              <th className="p-4 border-b border-slate-200">Địa Chỉ</th>
              <th className="p-4 border-b border-slate-200">Trạng Thái</th>
              <th className="p-4 border-b border-slate-200 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 text-sm font-bold text-slate-500">#{r.id}</td>
                <td className="p-4">
                  <p className="font-bold text-slate-800 text-sm">{r.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.phone_number}</p>
                </td>
                <td className="p-4"><span className="text-sm font-semibold text-indigo-600">{r.partner_name || 'N/A'}</span></td>
                <td className="p-4">
                  <div className="flex items-start gap-1 max-w-[200px]">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-500 line-clamp-2">{r.address}</p>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase ${
                    r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                    r.status === 'PENDING' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                    'bg-rose-100 text-rose-700'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    {r.status === 'PENDING' && (
                      <>
                        <button 
                          onClick={() => handleAction(r.id, 'approve')}
                          className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors border border-emerald-200"
                          title="Duyệt"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleAction(r.id, 'reject')}
                          className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg transition-colors border border-rose-200"
                          title="Từ chối"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {r.status === 'APPROVED' && (
                      <button 
                        onClick={() => handleAction(r.id, 'suspend')}
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg transition-colors border border-rose-200 text-xs font-bold"
                      >
                        ĐÌNH CHỈ
                      </button>
                    )}
                    {['REJECTED', 'SUSPENDED'].includes(r.status) && (
                      <button 
                        onClick={() => handleAction(r.id, 'approve')}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors border border-emerald-200 text-xs font-bold"
                      >
                        MỞ LẠI
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                  Không tìm thấy nhà hàng nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
