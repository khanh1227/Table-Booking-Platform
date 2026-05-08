import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, CheckCircle, Ban, Eye, X, Mail, Phone, Calendar, Building2, FileText } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export default function AdminPartnerList() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);

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
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setSelectedPartner(p)}
                      className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white rounded-lg transition-colors border border-blue-200"
                      title="Xem chi tiết"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
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

      {/* Center Modal for Partner Detail */}
      {selectedPartner && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedPartner(null)}></div>
          <div className="relative w-full max-w-xl bg-slate-50 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
              <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-500" />
                Hồ sơ Đối tác
              </h3>
              <button onClick={() => setSelectedPartner(null)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-6">
               <div className="flex items-center gap-4 mb-6">
                 <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black">
                   <Building2 className="w-8 h-8" />
                 </div>
                 <div>
                   <h4 className="font-black text-xl text-slate-800">{selectedPartner.business_name}</h4>
                   <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest mt-1 inline-block ${
                      selectedPartner.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                      selectedPartner.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                     {selectedPartner.status}
                   </span>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3">
                   <Phone className="w-5 h-5 text-slate-400" />
                   <div>
                     <p className="text-xs font-bold text-slate-500 mb-1">Số điện thoại</p>
                     <p className="font-semibold text-slate-700">{selectedPartner.phone}</p>
                   </div>
                 </div>
                 <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3">
                   <Mail className="w-5 h-5 text-slate-400" />
                   <div>
                     <p className="text-xs font-bold text-slate-500 mb-1">Email</p>
                     <p className="font-semibold text-slate-700 truncate max-w-[150px]">{selectedPartner.email || 'Chưa có'}</p>
                   </div>
                 </div>
                 <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3 col-span-2">
                   <FileText className="w-5 h-5 text-slate-400" />
                   <div>
                     <p className="text-xs font-bold text-slate-500 mb-1">Giấy phép Kinh Doanh / Mã số Thuế</p>
                     <p className="font-mono font-semibold text-slate-700">{selectedPartner.business_license || 'Chưa cập nhật'}</p>
                   </div>
                 </div>
                 <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3 col-span-2">
                   <Calendar className="w-5 h-5 text-slate-500" />
                   <div>
                     <p className="text-xs font-bold text-slate-500 mb-1">Ngày đăng ký hệ thống</p>
                     <p className="font-semibold text-slate-700 text-sm">{selectedPartner.joined}</p>
                   </div>
                 </div>
               </div>
            </div>
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
               {selectedPartner.status === 'ACTIVE' ? (
                 <button onClick={() => { handleAction(selectedPartner.id, 'suspend'); setSelectedPartner(null); }} className="px-6 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-xl font-bold transition-all flex items-center gap-2">
                   <Ban className="w-4 h-4" /> Khóa Đối Tác
                 </button>
               ) : (
                 <button onClick={() => { handleAction(selectedPartner.id, 'approve'); setSelectedPartner(null); }} className="px-6 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl font-bold transition-all flex items-center gap-2">
                   <CheckCircle className="w-4 h-4" /> Duyệt / Mở Lại
                 </button>
               )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
