import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, Shield, Ban, Eye, X, Mail, Phone, Calendar, Star } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export default function AdminUserList() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);

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
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setSelectedUser(u)}
                      className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white rounded-lg transition-colors border border-blue-200"
                      title="Xem chi tiết"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
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

      {/* Center Modal for User Detail */}
      {selectedUser && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedUser(null)}></div>
          <div className="relative w-full max-w-xl bg-slate-50 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
              <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                Hồ sơ Khách hàng
              </h3>
              <button onClick={() => setSelectedUser(null)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-6">
               <div className="flex items-center gap-4 mb-6">
                 <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-2xl">
                   {selectedUser.full_name?.charAt(0) || 'U'}
                 </div>
                 <div>
                   <h4 className="font-black text-xl text-slate-800">{selectedUser.full_name}</h4>
                   <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest mt-1 inline-block ${selectedUser.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                     {selectedUser.is_active ? 'Đang hoạt động' : 'Tài khoản bị khóa'}
                   </span>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3">
                   <Phone className="w-5 h-5 text-slate-400" />
                   <div>
                     <p className="text-xs font-bold text-slate-500 mb-1">Số điện thoại</p>
                     <p className="font-semibold text-slate-700">{selectedUser.phone}</p>
                   </div>
                 </div>
                 <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3">
                   <Mail className="w-5 h-5 text-slate-400" />
                   <div>
                     <p className="text-xs font-bold text-slate-500 mb-1">Email</p>
                     <p className="font-semibold text-slate-700 truncate max-w-[150px]">{selectedUser.email || 'Chưa có'}</p>
                   </div>
                 </div>
                 <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3">
                   <Calendar className="w-5 h-5 text-slate-400" />
                   <div>
                     <p className="text-xs font-bold text-slate-500 mb-1">Ngày gia nhập</p>
                     <p className="font-semibold text-slate-700 text-sm">{selectedUser.joined}</p>
                   </div>
                 </div>
                 <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 shadow-sm flex items-start gap-3">
                   <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                   <div>
                     <p className="text-xs font-bold text-indigo-500 mb-1">Điểm tín nhiệm</p>
                     <p className="font-black text-indigo-700">{selectedUser.loyalty_points} <span className="text-xs font-semibold">điểm</span></p>
                   </div>
                 </div>
               </div>

               <div className="bg-slate-100 p-4 rounded-xl flex items-center justify-between border border-slate-200">
                 <span className="font-bold text-slate-600">Tổng số lượt đặt bàn:</span>
                 <span className="font-black text-xl text-slate-800">{selectedUser.total_bookings}</span>
               </div>
            </div>
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
               {selectedUser.is_active ? (
                 <button onClick={() => { handleAction(selectedUser.user_id, 'ban'); setSelectedUser(null); }} className="px-6 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-xl font-bold transition-all">Khóa Tài Khoản</button>
               ) : (
                 <button onClick={() => { handleAction(selectedUser.user_id, 'unban'); setSelectedUser(null); }} className="px-6 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl font-bold transition-all">Mở Khóa Lại</button>
               )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
