import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Building2, MapPin, Eye, Clock, CreditCard, FileText, Phone, Mail, User, X, ChevronRight, Briefcase } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

const getImgUrl = (url: string) => {
  if (!url) return '/images/placeholder.png';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/media/')) return `${API_BASE}${url}`;
  return `${API_BASE}/media/${url}`;
};

export default function AdminRestaurantApproval() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  // Detail Modal State
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchRestaurants = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/restaurants/restaurants/my-restaurants/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
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

  const handleAction = async (id: number, actionType: string, reason?: string) => {
    if (!confirm(`Bạn có chắc chắn muốn ${actionType === 'approve' ? 'DUYỆT' : actionType === 'suspend' ? 'ĐÌNH CHỈ' : 'TỪ CHỐI'} nhà hàng này?`)) return;

    try {
      const payload: any = { action_type: actionType };
      if (reason) payload.reason = reason;

      const res = await fetch(`${API_BASE}/api/restaurants/restaurants/${id}/admin-action/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        alert('Cập nhật trạng thái thành công');
        fetchRestaurants();
        if (selectedId === id) closeDetail();
      } else {
        const error = await res.json();
        alert(error.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const openDetail = async (id: number) => {
    setSelectedId(id);
    setLoadingDetail(true);
    setShowRejectInput(false);
    try {
      const res = await fetch(`${API_BASE}/api/restaurants/restaurants/${id}/`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      if (res.ok) {
        setDetailData(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetailData(null);
    setShowRejectInput(false);
    setRejectReason('');
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-rose-500" />
            Duyệt Xét Cơ Sở
          </h2>
          <p className="text-sm text-slate-500 mt-1">Xác thực hệ thống nhà hàng đăng ký bởi Partner</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
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
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {r.location?.full_address || 'Chưa cập nhật địa điểm'}
                    </p>
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
                    <button 
                      onClick={() => openDetail(r.id)}
                      className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white rounded-lg transition-colors border border-blue-200"
                      title="Xem chi tiết"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {r.status === 'PENDING' && (
                      <button 
                        onClick={() => handleAction(r.id, 'approve')}
                        className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors border border-emerald-200"
                        title="Duyệt nhanh"
                      >
                        <CheckCircle className="w-4 h-4" />
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

      {/* Centered Detail Modal via Portal */}
      {selectedId && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeDetail}></div>
          <div className="relative w-full max-w-3xl bg-slate-50 max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
            
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
              <h3 className="font-black text-xl text-slate-800">Chi tiết Hồ sơ Nhà hàng</h3>
              <button onClick={closeDetail} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetail ? (
                <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div></div>
              ) : detailData ? (
                <>
                  {/* Status Banner */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    detailData.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-200' :
                    detailData.status === 'PENDING' ? 'bg-amber-50 border-amber-200' :
                    'bg-rose-50 border-rose-200'
                  }`}>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Trạng thái hiện tại</p>
                      <p className={`font-black text-lg ${
                        detailData.status === 'APPROVED' ? 'text-emerald-700' :
                        detailData.status === 'PENDING' ? 'text-amber-700' : 'text-rose-700'
                      }`}>{detailData.status}</p>
                    </div>
                  </div>

                  {/* Partner / Legal Info */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-indigo-500" /> Thông tin Pháp lý & Đối tác
                    </h4>
                    {detailData.partner_details ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-500 font-semibold mb-1">Doanh nghiệp / Cá nhân</p>
                          <p className="font-bold text-slate-800">{detailData.partner_details.business_name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold mb-1">Người đại diện</p>
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <p className="font-semibold text-slate-700">{detailData.partner_details.owner_name || 'N/A'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold mb-1">Giấy phép KD</p>
                          <div className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <p className="font-semibold text-slate-700">{detailData.partner_details.business_license || 'Chưa cung cấp'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold mb-1">Mã số thuế</p>
                          <div className="flex items-center gap-1">
                            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                            <p className="font-semibold text-slate-700">{detailData.partner_details.tax_code || 'Chưa cung cấp'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold mb-1">Số điện thoại</p>
                          <div className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <p className="font-semibold text-slate-700">{detailData.partner_details.owner_phone || 'N/A'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold mb-1">Email</p>
                          <div className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <p className="font-semibold text-slate-700">{detailData.partner_details.owner_email || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-rose-500 italic">Không tìm thấy thông tin Đối tác (Lỗi dữ liệu)</p>
                    )}
                  </div>

                  {/* Restaurant Info */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-rose-500" /> Thông tin Cơ sở
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-slate-500 font-semibold mb-1">Tên cơ sở</p>
                        <p className="font-bold text-slate-800 text-lg">{detailData.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-semibold mb-1">Địa chỉ</p>
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                          <p className="font-semibold text-slate-700">
                            {detailData.address}
                            {detailData.location?.full_address && `, ${detailData.location.full_address}`}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-500 font-semibold mb-1">SĐT Liên hệ quán</p>
                          <p className="font-semibold text-slate-700">{detailData.phone_number}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold mb-1">Loại ẩm thực</p>
                          <p className="font-semibold text-slate-700">{detailData.cuisine_type || 'Chưa cập nhật'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-semibold mb-2">Hình ảnh cơ sở</p>
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                          {detailData.images && detailData.images.length > 0 ? (
                            detailData.images.map((img: any, idx: number) => (
                              <img 
                                key={idx} 
                                src={getImgUrl(img.image_url)} 
                                alt="Restaurant" 
                                className="w-24 h-24 object-cover rounded-lg shrink-0 border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity hover:border-rose-300" 
                                onClick={() => setPreviewImage(getImgUrl(img.image_url))}
                              />
                            ))
                          ) : (
                            <img src="/images/placeholder.png" alt="No image" className="w-24 h-24 object-cover rounded-lg shrink-0 border border-slate-200 opacity-50 grayscale" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </>
              ) : (
                <p className="text-center text-slate-500 mt-10">Không tải được dữ liệu.</p>
              )}
            </div>

            {/* Action Footer */}
            {detailData && (
              <div className="p-6 bg-white border-t border-slate-200 shrink-0">
                {showRejectInput ? (
                  <div className="animate-fadeIn">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Lý do từ chối (Gửi cho Đối tác):</label>
                    <textarea 
                      className="w-full border border-slate-300 rounded-xl p-3 text-sm mb-4 outline-none focus:border-rose-500"
                      rows={3}
                      placeholder="Ví dụ: Giấy phép kinh doanh không hợp lệ, hình ảnh sai lệch..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    ></textarea>
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setShowRejectInput(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Hủy</button>
                      <button 
                        onClick={() => handleAction(detailData.id, 'reject', rejectReason)}
                        className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold shadow-lg shadow-rose-600/30 hover:bg-rose-700"
                      >Xác nhận Từ chối</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row justify-end gap-3">
                    {detailData.status === 'PENDING' && (
                      <>
                        <button onClick={() => setShowRejectInput(true)} className="px-6 py-3 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold rounded-xl transition-colors">
                          Từ chối
                        </button>
                        <button onClick={() => handleAction(detailData.id, 'approve')} className="px-6 py-3 bg-emerald-500 text-white hover:bg-emerald-600 font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2">
                          <CheckCircle className="w-5 h-5" /> Phê Duyệt Ngay
                        </button>
                      </>
                    )}
                    {detailData.status === 'APPROVED' && (
                      <button onClick={() => handleAction(detailData.id, 'suspend')} className="px-6 py-3 bg-slate-800 text-white hover:bg-slate-900 font-bold rounded-xl shadow-lg transition-all">
                        Đình chỉ hoạt động
                      </button>
                    )}
                    {['REJECTED', 'SUSPENDED'].includes(detailData.status) && (
                      <button onClick={() => handleAction(detailData.id, 'approve')} className="px-6 py-3 bg-emerald-500 text-white hover:bg-emerald-600 font-bold rounded-xl shadow-lg transition-all">
                        Mở lại (Duyệt)
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Image Preview Modal (Lightbox) */}
      {previewImage && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 animate-fadeIn" onClick={() => setPreviewImage(null)}>
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"
            onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={previewImage} 
            alt="Preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" 
            onClick={(e) => e.stopPropagation()} 
          />
        </div>,
        document.body
      )}
    </div>
  );
}
