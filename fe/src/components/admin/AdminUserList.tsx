import { useState, useEffect } from 'react';
import { Users, Shield, Ban } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export default function AdminUserList() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/accounts/admin/users/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.results || data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAction = async (id: number, actionType: string) => {
    if (!confirm(`Xác nhận ${actionType === 'ban' ? 'KHÓA' : 'MỞ KHÓA'} người dùng này?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/accounts/admin/users/${id}/${actionType}/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        }
      });
      if (res.ok) {
        alert('Cập nhật thành công');
        fetchUsers();
      } else {
        alert('Lỗi hệ thống');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-rose-500" />
          Danh Sách Khách Hàng
        </h2>
        <p className="text-sm text-slate-500 mt-1">Quản lý người mua, khách đặt bàn. Cấm đặt bàn với các khách hàng ảo/boom hàng.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest font-bold">
              <th className="p-4 border-b border-slate-200">ID</th>
              <th className="p-4 border-b border-slate-200">Tên Khách Hàng</th>
              <th className="p-4 border-b border-slate-200">Liên Hệ</th>
              <th className="p-4 border-b border-slate-200">Tổng Bookings</th>
              <th className="p-4 border-b border-slate-200">Điểm Thưởng</th>
              <th className="p-4 border-b border-slate-200">Trạng Thái</th>
              <th className="p-4 border-b border-slate-200 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 text-sm font-bold text-slate-500">#{u.id}</td>
                <td className="p-4 font-bold text-slate-800 text-sm">{u.full_name}</td>
                <td className="p-4">
                  <p className="text-sm text-slate-800 font-semibold">{u.phone}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{u.email || '--'}</p>
                </td>
                <td className="p-4">
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-black">
                     {u.total_bookings} đơn
                  </span>
                </td>
                <td className="p-4 font-black tracking-tight text-amber-500">{u.loyalty_points} điểm</td>
                <td className="p-4">
                  {u.is_active ? 
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold uppercase tracking-widest">Active</span> :
                    <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-1 rounded font-bold uppercase tracking-widest">Banned</span>
                  }
                </td>
                <td className="p-4 text-right">
                  {u.is_active ? (
                     <button 
                        onClick={() => handleAction(u.user_id, 'ban')}
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg transition-colors border border-rose-200 text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Ban className="w-3 h-3" /> BAN
                      </button>
                  ) : (
                     <button 
                        onClick={() => handleAction(u.user_id, 'unban')}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors border border-emerald-200 text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Shield className="w-3 h-3" /> BỎ XEM XÉT
                      </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                  Không tìm thấy khách hàng
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
