import { useState, useEffect } from 'react';
import { Briefcase, CheckCircle, Ban } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export default function AdminPartnerList() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPartners = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/accounts/admin/partners/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPartners(data.results || data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleAction = async (id: number, actionType: string) => {
    if (!confirm(`Xác nhận ${actionType === 'approve' ? 'MỞ KHÓA/DUYỆT' : 'KHÓA'} đối tác này?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/accounts/admin/partners/${id}/${actionType}/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        }
      });
      if (res.ok) {
        alert('Cập nhật trạng thái đối tác thành công');
        fetchPartners();
      } else {
        alert('Lỗi khi thực hiện thao tác');
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
          <Briefcase className="w-5 h-5 text-rose-500" />
          Quản Lý Tài Khoản Đối Tác
        </h2>
        <p className="text-sm text-slate-500 mt-1">Danh sách đối tác và cấp quyền truy cập Merchant Portal</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest font-bold">
              <th className="p-4 border-b border-slate-200">ID</th>
              <th className="p-4 border-b border-slate-200">Doanh Nghiệp</th>
              <th className="p-4 border-b border-slate-200">GPKD</th>
              <th className="p-4 border-b border-slate-200">Liên Hệ</th>
              <th className="p-4 border-b border-slate-200">Trạng Thái</th>
              <th className="p-4 border-b border-slate-200 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {partners.map(p => (
              <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 text-sm font-bold text-slate-500">#{p.id}</td>
                <td className="p-4 font-bold text-slate-800 text-sm">{p.business_name}</td>
                <td className="p-4 text-xs font-mono text-slate-400 bg-slate-50 rounded px-2">{p.business_license || 'N/A'}</td>
                <td className="p-4">
                  <p className="text-sm text-slate-800">{p.phone}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{p.email || 'Không có email'}</p>
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1 items-start">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase ${
                      p.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                      p.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {p.status}
                    </span>
                    {!p.is_active && <span className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">Tài Khoản Khóa</span>}
                  </div>
                </td>
                <td className="p-4 text-right">
                  {p.status === 'ACTIVE' ? (
                     <button 
                        onClick={() => handleAction(p.id, 'suspend')}
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg transition-colors border border-rose-200 text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Ban className="w-3 h-3" /> KHÓA
                      </button>
                  ) : (
                     <button 
                        onClick={() => handleAction(p.id, 'approve')}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors border border-emerald-200 text-xs font-bold inline-flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" /> DUYỆT / MỞ
                      </button>
                  )}
                </td>
              </tr>
            ))}
            {partners.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                  Không tìm thấy đối tác
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
