import { useState, useEffect } from 'react';
import { ShieldAlert, Trash2, CheckCircle, AlertTriangle, User, Store, Flag, MessageSquare } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export default function AdminReviewModeration() {
  const [activeTab, setActiveTab] = useState<'reviews' | 'restaurants'>('reviews');
  const [reviewReports, setReviewReports] = useState<any[]>([]);
  const [restaurantReports, setRestaurantReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('access')}` };
      
      const [reviewRes, restaurantRes] = await Promise.all([
        fetch(`${API_BASE}/api/reviews/reports/`, { headers }),
        fetch(`${API_BASE}/api/restaurants/reports/`, { headers })
      ]);

      if (reviewRes.ok) {
        const data = await reviewRes.json();
        setReviewReports(data || []);
      }
      if (restaurantRes.ok) {
        const data = await restaurantRes.json();
        setRestaurantReports(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Review Actions
  const handleResolveReview = async (id: number) => {
    if (!confirm('Bác bỏ báo cáo và Giữ lại Đánh giá này?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/reviews/reports/${id}/resolve/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      if (res.ok) {
        alert('Đã xử lý xong khiếu nại.');
        fetchData();
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
        fetchData();
      }
    } catch (err) {}
  };

  // Restaurant Actions
  const handleResolveRestaurant = async (id: number) => {
    if (!confirm('Đánh dấu đã xử lý báo cáo này?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/restaurants/reports/${id}/resolve/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      if (res.ok) {
        alert('Đã xử lý xong.');
        fetchData();
      }
    } catch (err) {}
  };

  if (loading) return <div className="text-center py-10">Đang tải...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
      <div className="p-6 border-b border-slate-200 bg-slate-50/50">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-500" />
          Trung Tâm Kiểm Duyệt & Báo Cáo
        </h2>
        
        <div className="flex gap-2 mt-6">
          <button 
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'reviews' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            <MessageSquare className="w-4 h-4" /> Báo cáo Đánh giá ({reviewReports.filter(r => r.status === 'PENDING').length})
          </button>
          <button 
            onClick={() => setActiveTab('restaurants')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'restaurants' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            <Flag className="w-4 h-4" /> Báo cáo Nhà hàng ({restaurantReports.filter(r => r.status === 'PENDING').length})
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 bg-slate-50/30">
        {activeTab === 'reviews' ? (
          <ReviewReportsList reports={reviewReports} onResolve={handleResolveReview} onDelete={handleDeleteReview} />
        ) : (
          <RestaurantReportsList reports={restaurantReports} onResolve={handleResolveRestaurant} />
        )}
      </div>
    </div>
  );
}

function ReviewReportsList({ reports, onResolve, onDelete }: any) {
  const pending = reports.filter((r: any) => r.status === 'PENDING');
  const resolved = reports.filter((r: any) => r.status === 'RESOLVED');

  return (
    <div className="space-y-6">
       <div className="space-y-4">
          {pending.map((r: any) => (
             <div key={r.id} className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden flex flex-col md:flex-row animate-fadeIn">
                <div className="p-4 bg-red-50/50 md:w-1/3 border-b md:border-b-0 md:border-r border-red-100 flex flex-col justify-center">
                   <div className="flex items-center gap-2 mb-2">
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase">Reported</span>
                      <span className="text-xs text-slate-500 font-bold">{new Date(r.created_at).toLocaleDateString('vi-VN')}</span>
                   </div>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tin báo từ nhà hàng:</p>
                   <p className="font-black text-slate-800 text-sm mb-3"><Store className="w-3.5 h-3.5 inline mr-1 text-slate-400" />{r.reported_by}</p>
                   <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                      <p className="text-xs font-bold text-red-500 mb-1">Lý do report:</p>
                      <p className="text-sm text-slate-700 font-medium italic">"{r.reason}"</p>
                   </div>
                </div>
                
                <div className="p-4 md:w-2/3 flex flex-col justify-between bg-white">
                   <div>
                      <div className="flex justify-between items-start mb-2">
                         <div>
                            <p className="font-black text-slate-800 flex items-center gap-1.5"><User className="w-4 h-4 text-slate-400" /> Khách: {r.review.customer_name}</p>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-tighter">Tại: {r.review.restaurant_name}</p>
                         </div>
                         <div className="flex">
                           {[...Array(5)].map((_, i) => (
                             <svg key={i} className={`w-4 h-4 ${i < r.review.rating ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                           ))}
                         </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
                         <p className="text-slate-700 text-sm">"{r.review.comment || '(Không ghi bình luận)'}"</p>
                      </div>
                   </div>

                   <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-slate-100">
                      <button 
                        onClick={() => onResolve(r.id)}
                        className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        <CheckCircle className="w-4 h-4" /> Bác Bỏ Báo Cáo
                      </button>
                      <button 
                        onClick={() => onDelete(r.id)}
                        className="px-4 py-2 bg-rose-500 text-white hover:bg-rose-600 rounded-lg transition-colors text-xs font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" /> XOÁ ĐÁNH GIÁ NÀY
                      </button>
                   </div>
                </div>
             </div>
          ))}
          {pending.length === 0 && (
             <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <ShieldAlert className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500 font-bold">Không có báo cáo đánh giá nào đang chờ xử lý.</p>
             </div>
          )}
       </div>

       {resolved.length > 0 && (
          <div className="mt-10 opacity-60">
             <h3 className="font-bold text-slate-500 mb-4 flex items-center gap-2">Lịch sử xử lý ({resolved.length})</h3>
             <div className="space-y-2">
                {resolved.map((r: any) => (
                   <div key={r.id} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                      <span className="text-slate-700">Ticket from <span className="font-bold">{r.reported_by}</span> đã được bác bỏ.</span>
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black uppercase">Đã Xong</span>
                   </div>
                ))}
             </div>
          </div>
       )}
    </div>
  );
}

function RestaurantReportsList({ reports, onResolve }: any) {
  const pending = reports.filter((r: any) => r.status === 'PENDING');
  const resolved = reports.filter((r: any) => r.status === 'RESOLVED');

  return (
    <div className="space-y-6">
       <div className="space-y-4">
          {pending.map((r: any) => (
             <div key={r.id} className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden flex animate-fadeIn">
                <div className="p-4 bg-amber-50/50 w-1/3 border-r border-amber-100 flex flex-col justify-center">
                   <div className="flex items-center gap-2 mb-2">
                      <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase">Reported</span>
                      <span className="text-xs text-slate-500 font-bold">{new Date(r.created_at).toLocaleDateString('vi-VN')}</span>
                   </div>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Người báo cáo:</p>
                   <p className="font-black text-slate-800 text-sm mb-3"><User className="w-3.5 h-3.5 inline mr-1 text-slate-400" />{r.reported_by}</p>
                   <div className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
                      <p className="text-xs font-bold text-amber-500 mb-1">Nội dung tố cáo:</p>
                      <p className="text-sm text-slate-700 font-medium italic">"{r.reason}"</p>
                   </div>
                </div>
                
                <div className="p-6 w-2/3 flex flex-col justify-between bg-white">
                   <div className="flex gap-4">
                      <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                         <Store className="w-8 h-8" />
                      </div>
                      <div>
                         <h4 className="font-black text-slate-800 text-lg uppercase">{r.restaurant.name}</h4>
                         <p className="text-sm text-slate-500 flex items-center gap-1 mt-1 font-medium">
                            {r.restaurant.address}
                         </p>
                         <p className="text-[10px] text-fuchsia-500 font-black mt-2 uppercase tracking-widest bg-fuchsia-50 px-2 py-0.5 rounded-full inline-block">ID: #{r.restaurant.id}</p>
                      </div>
                   </div>

                   <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-slate-100">
                      <button 
                        onClick={() => onResolve(r.id)}
                        className="px-6 py-2.5 bg-slate-800 text-white hover:bg-slate-700 rounded-xl transition-all text-xs font-bold flex items-center gap-2 shadow-lg shadow-slate-200"
                      >
                        <CheckCircle className="w-4 h-4" /> ĐÃ XỬ LÝ / ĐÓNG KHIẾU NẠI
                      </button>
                   </div>
                </div>
             </div>
          ))}
          {pending.length === 0 && (
             <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <Flag className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500 font-bold">Không có báo cáo nhà hàng nào đang chờ xử lý.</p>
             </div>
          )}
       </div>

       {resolved.length > 0 && (
          <div className="mt-10 opacity-60">
             <h3 className="font-bold text-slate-500 mb-4 flex items-center gap-2">Lịch sử xử lý ({resolved.length})</h3>
             <div className="space-y-2">
                {resolved.map((r: any) => (
                   <div key={r.id} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                      <span className="text-slate-700">Report for <span className="font-bold">{r.restaurant.name}</span> by <span className="font-bold">{r.reported_by}</span> đã xử lý.</span>
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-black uppercase">Resolved</span>
                   </div>
                ))}
             </div>
          </div>
       )}
    </div>
  );
}
