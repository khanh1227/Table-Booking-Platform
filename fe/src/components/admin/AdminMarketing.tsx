import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, Image as ImageIcon, Layers, Plus, Trash2, Save, X, Eye, EyeOff, Search, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { PLACEHOLDER_IMAGE, handleImageError } from '@/lib/imageUtils';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export default function AdminMarketing() {
  const [activeTab, setActiveTab] = useState<'banners' | 'collections'>('banners');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-fuchsia-500" />
          Quản Lý Marketing & Hiển Thị
        </h2>
        <p className="text-sm text-slate-500 mt-1">Tuỳ chỉnh Banners quảng cáo và Bộ sưu tập (Collections) ngoài trang chủ.</p>
        
        <div className="flex gap-2 mt-6">
          <button 
            onClick={() => setActiveTab('banners')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'banners' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <ImageIcon className="w-4 h-4 inline-block mr-2" /> Banners Trang Chủ
          </button>
          <button 
            onClick={() => setActiveTab('collections')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'collections' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Layers className="w-4 h-4 inline-block mr-2" /> Bộ Sưu Tập (Collections)
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 bg-slate-50/50">
        {activeTab === 'banners' ? <BannersTab /> : <CollectionsTab />}
      </div>
    </div>
  );
}

// ======================================
// BANNERS TAB
// ======================================
function BannersTab() {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', image_url: '', target_url: '', display_order: 0, is_active: true });

  const fetchBanners = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/discovery/banners/`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBanners(data.results || data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleSave = async () => {
    if (!formData.title || !formData.image_url) return alert('Vui lòng nhập tiêu đề và link ảnh');
    try {
      const res = await fetch(`${API_BASE}/api/discovery/banners/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        alert('Thêm banner thành công');
        setIsAdding(false);
        setFormData({ title: '', image_url: '', target_url: '', display_order: 0, is_active: true });
        fetchBanners();
      } else {
        alert('Lỗi tạo banner');
      }
    } catch (err) {
      alert('Lỗi mạng');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa banner này?')) return;
    try {
      await fetch(`${API_BASE}/api/discovery/banners/${id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      fetchBanners();
    } catch (err) { }
  };

  if (loading) return <div className="text-center py-10">Đang tải...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAdding ? 'Hủy' : 'Thêm Banner Mới'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-5 rounded-xl border border-fuchsia-100 shadow-sm mb-6 animate-fadeIn">
          <h3 className="font-bold text-slate-800 mb-4">Thêm Banner</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Tiêu đề (Nội bộ)</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="VD: Khuyến mãi mùa Hè..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Link Ảnh (URL)</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Link Đích (Tùy chọn)</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400" value={formData.target_url} onChange={e => setFormData({...formData, target_url: e.target.value})} placeholder="/restaurant/123" />
            </div>
            <div className="flex items-end">
              <button onClick={handleSave} className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 font-bold text-sm hover:bg-slate-700 transition">
                <Save className="w-4 h-4 inline-block mr-2" /> Lưu Banner
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {banners.map(b => (
          <div key={b.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition">
            <div className="h-40 bg-slate-100 relative group">
              <img src={b.image_url} alt={b.title} className="w-full h-full object-cover" onError={handleImageError} />
              <div className="absolute top-2 right-2 bg-slate-900/60 text-white px-2 py-1 rounded text-[10px] font-bold backdrop-blur-sm">
                Thứ tự: {b.display_order}
              </div>
            </div>
            <div className="p-4 flex flex-col justify-between h-32">
              <div>
                <h4 className="font-bold text-slate-800 line-clamp-1">{b.title}</h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{b.target_url || 'Không có link đích'}</p>
              </div>
              <div className="flex items-center justify-between mt-4">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase ${b.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {b.is_active ? <Eye className="w-3 h-3 inline mr-1" /> : <EyeOff className="w-3 h-3 inline mr-1" />}
                  {b.is_active ? 'Hiển thị' : 'Đang Ẩn'}
                </span>
                <button onClick={() => handleDelete(b.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Xóa">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {banners.length === 0 && <p className="text-center text-slate-400 py-10 font-medium">Chưa có banner nào</p>}
    </div>
  );
}

// ======================================
// COLLECTIONS TAB
// ======================================
function CollectionsTab() {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', cover_image_url: '' });

  const [pickerConfig, setPickerConfig] = useState<{ isOpen: boolean; collectionId: number | null; collectionName: string; currentItemIds: number[] }>({
    isOpen: false,
    collectionId: null,
    collectionName: '',
    currentItemIds: []
  });

  const fetchCollections = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/discovery/collections/`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCollections(data.results || data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleSaveCollection = async () => {
    if (!formData.title) return alert('Nhập tiêu đề');
    try {
      const res = await fetch(`${API_BASE}/api/discovery/collections/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        },
        body: JSON.stringify({...formData, restaurant_ids: []})
      });
      if (res.ok) {
        alert('Tạo bộ sưu tập thành công');
        setIsAdding(false);
        setFormData({ title: '', description: '', cover_image_url: '' });
        fetchCollections();
      }
    } catch (err) {}
  };

  // handled in Modal now

  const handleRemoveRestaurant = async (collectionId: number, restaurantId: number) => {
    if (!confirm('Xóa khỏi bộ sưu tập?')) return;
    try {
      await fetch(`${API_BASE}/api/discovery/collections/${collectionId}/remove-restaurant/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        },
        body: JSON.stringify({ restaurant_id: restaurantId })
      });
      fetchCollections();
    } catch (err) {}
  };

  const handleDeleteCollection = async (id: number) => {
    if (!confirm('Xóa hoàn toàn bộ sưu tập này?')) return;
    try {
      await fetch(`${API_BASE}/api/discovery/collections/${id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      fetchCollections();
    } catch (err) {}
  };

  if (loading) return <div className="text-center py-10">Đang tải...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-fuchsia-50 p-4 rounded-xl border border-fuchsia-100">
         <div>
            <p className="text-fuchsia-900 font-bold text-sm">Gợi ý quản lý</p>
            <p className="text-xs text-fuchsia-700 mt-1">Lấy ID nhà hàng trong tab DUYỆT NHÀ HÀNG để thêm vào Bộ sưu tập.</p>
         </div>
         <button 
           onClick={() => setIsAdding(!isAdding)}
           className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm"
         >
           {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Tạo Mới
         </button>
      </div>

      {isAdding && (
        <div className="bg-white p-5 rounded-xl border border-fuchsia-100 shadow-sm animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Tiêu đề Bộ sưu tập</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="VD: Quán ngon Hà Nội" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Mô tả (Ngắn gọn)</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Ăn sập thủ đô..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Link ảnh Cover</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" value={formData.cover_image_url} onChange={e => setFormData({...formData, cover_image_url: e.target.value})} placeholder="https://..." />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button onClick={handleSaveCollection} className="bg-slate-800 text-white rounded-lg px-6 py-2 font-bold text-sm hover:bg-slate-700 transition">
                Tạo Ngay
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {collections.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <div className="flex gap-4 items-center">
                 {c.cover_image_url ? (
                    <img src={c.cover_image_url} alt="" className="w-16 h-16 rounded-xl object-cover bg-slate-100 shadow-sm" onError={handleImageError} />
                 ) : (
                    <div className="w-16 h-16 rounded-xl bg-fuchsia-100 text-fuchsia-300 flex items-center justify-center">
                       <Layers className="w-8 h-8" />
                    </div>
                 )}
                 <div>
                    <h3 className="font-black text-slate-800 text-lg">{c.title}</h3>
                    <p className="text-slate-500 text-sm mt-0.5">{c.description || 'Không có mô tả'}</p>
                 </div>
              </div>
              <button onClick={() => handleDeleteCollection(c.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition" title="Xóa Bộ sưu tập">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* List items */}
            <div className="pl-20 pr-4">
              <div className="flex items-center gap-2 mb-3">
                        {c.items?.map((item: any) => (
                    <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-lg pr-2 pl-3 py-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
                       <span className="text-xs text-slate-400">#{item.restaurant}</span>
                       <span className="max-w-[150px] truncate">{item.restaurant_name}</span>
                       <button onClick={() => handleRemoveRestaurant(c.id, item.restaurant)} className="text-rose-400 hover:text-rose-600 ml-1">
                          <X className="w-3.5 h-3.5" />
                       </button>
                    </div>
                 ))}
                 {(!c.items || c.items.length === 0) && <span className="text-xs text-slate-400 italic">Trống</span>}
              </div>

              {/* Add Modal trigger */}
              <button 
                onClick={() => setPickerConfig({
                  isOpen: true,
                  collectionId: c.id,
                  collectionName: c.title,
                  currentItemIds: c.items?.map((i: any) => i.restaurant) || []
                })}
                className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-fuchsia-50 hover:text-fuchsia-700 px-3 py-1.5 rounded-lg flex items-center transition"
              >
                <Plus className="w-4 h-4 mr-1" /> Thêm nhà hàng vào bộ sưu tập
              </button>
            </div>
          </div>
        ))}
        {collections.length === 0 && <p className="text-center text-slate-400 py-10 font-medium">Chưa có bộ sưu tập nào</p>}
      </div>

      {pickerConfig.isOpen && pickerConfig.collectionId && (
        <RestaurantPickerModal 
          collectionId={pickerConfig.collectionId}
          collectionName={pickerConfig.collectionName}
          initialAddedIds={pickerConfig.currentItemIds}
          onClose={() => {
            setPickerConfig({ isOpen: false, collectionId: null, collectionName: '', currentItemIds: [] });
            fetchCollections(); // refresh on close
          }}
        />
      )}
    </div>
  );
}

// ======================================
// RESTAURANT PICKER MODAL
// ======================================
function RestaurantPickerModal({ collectionId, collectionName, initialAddedIds, onClose }: { collectionId: number, collectionName: string, initialAddedIds: number[], onClose: () => void }) {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [addedIds, setAddedIds] = useState<number[]>(initialAddedIds);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const fetchRestaurants = async (currentPage = 1, searchQuery = '') => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/restaurants/restaurants/?status=APPROVED&page=${currentPage}&search=${searchQuery}`);
      if (res.ok) {
        const data = await res.json();
        setRestaurants(data.results || data || []);
        if (data.count) {
          setTotalPages(Math.ceil(data.count / 10));
        } else {
          setTotalPages(1);
        }
      }
    } catch (err) { } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchRestaurants(1, search);
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (page > 1) fetchRestaurants(page, search);
  }, [page]);

  const handleAdd = async (restaurantId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/discovery/collections/${collectionId}/add-restaurant/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        },
        body: JSON.stringify({ restaurant_id: restaurantId })
      });
      if (res.ok) {
        setAddedIds(prev => [...prev, restaurantId]);
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi thêm nhà hàng');
      }
    } catch (err) {}
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-fadeIn">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-black text-slate-800 text-lg">Chọn Nhà Hàng</h3>
            <p className="text-xs text-slate-500 font-bold mt-0.5">Thêm vào bộ sưu tập: <span className="text-fuchsia-600">{collectionName}</span></p>
          </div>
          <button onClick={onClose} className="p-2 bg-white text-slate-400 hover:text-slate-600 rounded-xl shadow-sm border border-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100 relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-7 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Tìm theo Tên hoặc Địa chỉ nhà hàng..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400 text-sm font-medium"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 p-4 custom-scrollbar bg-slate-50/30">
          {loading && restaurants.length === 0 ? (
            <div className="text-center py-10"><div className="w-8 h-8 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin mx-auto pb-4"></div><span className="text-slate-500 font-medium text-sm">Đang tải...</span></div>
          ) : restaurants.length === 0 ? (
            <div className="text-center py-10 text-slate-400 font-medium">Không tìm thấy nhà hàng nào :(</div>
          ) : (
            <div className="space-y-3">
              {restaurants.map(r => {
                const isAdded = addedIds.includes(r.id);
                return (
                  <div key={r.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-slate-200 transition">
                    <img src={r.images?.[0]?.image || PLACEHOLDER_IMAGE} alt="" className="w-14 h-14 rounded-lg object-cover bg-slate-100" onError={handleImageError} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 text-sm truncate">{r.name}</h4>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{r.address}</p>
                    </div>
                    <button 
                      onClick={() => !isAdded && handleAdd(r.id)}
                      disabled={isAdded}
                      className={`px-4 py-2 flex items-center gap-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                        isAdded 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-fuchsia-50 text-fuchsia-600 hover:bg-fuchsia-500 hover:text-white hover:shadow-md'
                      }`}
                    >
                      {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      {isAdded ? 'Đã trong BST' : 'Thêm ngay'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-500">Trang {page} / {totalPages}</span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
