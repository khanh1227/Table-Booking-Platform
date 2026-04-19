import { useState, useEffect } from 'react';
import { ShieldAlert, Trash2, CheckCircle, AlertTriangle, User, Store } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export default function AdminReviewModeration() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reviews/reports/`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleResolve = async (id: number) => {
    if (!confirm('Bác bỏ báo cáo và Giữ lại Đánh giá này?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/reviews/reports/${id}/resolve/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      if (res.ok) {
        alert('Đã xử lý xong khiếu nại.');
        fetchReports();
      }
    } catch (err) {}
  };

  const handleDeleteReview = async (id: number) => {
    if (!confirm('Xóa VĨNH VIỄN đánh giá này khỏi hệ thống?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/reviews/reports/${id}/delete_review/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      if (res.ok) {
        alert('Đã xóa đánh giá thành công.');
        fetchReports();
      }
    } catch (err) {}
  };

  if (loading) return <div className="text-center py-10">Đang tải...</div>;

  const pendingReports = reports.filter(r => r.status === 'PENDING');
  const resolvedReports = reports.filter(r => r.status === 'RESOLVED');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
      <div className="p-6 border-b border-slate-200 bg-red-50/30">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-500" />
          Kiểm Duyệt Đánh Giá (Review Moderation)
        </h2>
        <p className="text-sm text-slate-600 mt-1">Danh sách các Đánh giá bị tố cáo Mới do Chủ nhà hàng (Partner) gửi lên hệ thống.</p>
      </div>

      <div className="flex-1 p-6 bg-slate-50/50">
        
        <h3 className="font-black text-lg text-slate-800 mb-4 flex items-center gap-2">
           <AlertTriangle className="w-5 h-5 text-amber-500" /> TICKETS ĐANG CHỜ XỬ LÝ ({pendingReports.length})
        </h3>
        
        <div className="space-y-4 mb-10">
          {pendingReports.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
              {/* Report Info */}
              <div className="p-4 bg-red-50 md:w-1/3 border-b md:border-b-0 md:border-r border-red-100 flex flex-col justify-center">
                 <div className="flex items-center gap-2 mb-2">
                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase">Reported</span>
                    <span className="text-xs text-slate-500 font-bold">{new Date(r.created_at).toLocaleDateString('vi-VN')}</span>
                 </div>
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tin báo từ nhà hàng:</p>
                 <p className="font-black text-slate-800 text-sm mb-3"><Store className="w-3.5 h-3.5 inline mr-1 text-slate-400" />{r.reported_by}</p>
                 <div className="bg-white p-2.5 rounded-lg border border-red-100 shadow-sm">
                    <p className="text-xs font-bold text-red-500 mb-1">Lý do report:</p>
                    <p className="text-sm text-slate-700 font-medium italic">"{r.reason}"</p>
                 </div>
              </div>
              
              {/* Review Content */}
              <div className="p-4 md:w-2/3 flex flex-col justify-between">
                 <div>
                    <div className="flex justify-between items-start mb-2">
                       <p className="font-black text-slate-800 flex items-center gap-1.5"><User className="w-4 h-4 text-slate-400" /> Khách: {r.review.customer_name}</p>
                       <div className="flex">
                         {[...Array(5)].map((_, i) => (
                           <svg key={i} className={`w-4 h-4 ${i < r.review.rating ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                         ))}
                       </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                       <p className="text-slate-700 text-sm">"{r.review.comment || '(Không ghi bình luận)'}"</p>
                    </div>
                 </div>

                 {/* Action Buttons */}
                 <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-slate-100">
                    <button 
                      onClick={() => handleResolve(r.id)}
                      className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle className="w-4 h-4" /> Bác Bỏ Báo Cáo
                    </button>
                    <button 
                      onClick={() => handleDeleteReview(r.id)}
                      className="px-4 py-2 bg-rose-500 text-white hover:bg-rose-600 rounded-lg transition-colors text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" /> XOÁ ĐÁNH GIÁ NÀY
                    </button>
                 </div>
              </div>
            </div>
          ))}
          {pendingReports.length === 0 && (
             <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300">
                <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">Tuyệt vời! Hệ thống sạch sẽ, không có khiếu nại nào.</p>
             </div>
          )}
        </div>

        {resolvedReports.length > 0 && (
           <>
              <h3 className="font-bold text-slate-500 mb-4 flex items-center gap-2 border-t border-slate-200 pt-6">
                 <CheckCircle className="w-4 h-4" /> Lịch sử xử lý ({resolvedReports.length})
              </h3>
              <div className="space-y-3 opacity-60">
                {resolvedReports.slice(0, 10).map(r => (
                   <div key={r.id} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                      <div>
                         <span className="text-xs font-bold text-slate-500 mr-3">[{new Date(r.created_at).toLocaleDateString()}]</span>
                         <span className="text-sm text-slate-700">Ticket from <span className="font-bold">{r.reported_by}</span> ~ Đã bác bỏ báo cáo.</span>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase tracking-widest">Đã Xong</span>
                   </div>
                ))}
              </div>
           </>
        )}
      </div>
    </div>
  );
}
