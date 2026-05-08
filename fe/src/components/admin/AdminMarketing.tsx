import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Megaphone, Image as ImageIcon, Layers, Plus, Trash2, Save, X, Eye, EyeOff, Search, ChevronLeft, ChevronRight, Check, Pencil, Tags, CheckCircle } from 'lucide-react';
import { PLACEHOLDER_IMAGE, handleImageError } from '@/lib/imageUtils';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export default function AdminMarketing() {
  const [activeTab, setActiveTab] = useState<'banners' | 'collections' | 'search' | 'moderation'>('banners');

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
            <Layers className="w-4 h-4 inline-block mr-2" /> Bộ Sưu Tập
          </button>
          <button 
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'search' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Tags className="w-4 h-4 inline-block mr-2" /> Tối ưu Tìm kiếm
          </button>
          <button 
            onClick={() => setActiveTab('moderation')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'moderation' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <CheckCircle className="w-4 h-4 inline-block mr-2" /> Duyệt bài đăng
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 bg-slate-50/50">
        {activeTab === 'banners' && <BannersTab />}
        {activeTab === 'collections' && <CollectionsTab />}
        {activeTab === 'search' && <SearchTuningTab />}
        {activeTab === 'moderation' && <CommunityModerationTab />}
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<{
    title: string;
    image_url: string;
    target_url: string;
    display_order: number;
    is_active: boolean;
    image_file: File | null;
  }>({
    title: '',
    image_url: '',
    target_url: '',
    display_order: 0,
    is_active: true,
    image_file: null
  });

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
    if (!formData.title) return alert('Vui lòng nhập tiêu đề');
    
    const data = new FormData();
    data.append('title', formData.title);
    data.append('target_url', formData.target_url);
    data.append('display_order', formData.display_order.toString());
    data.append('is_active', formData.is_active.toString());
    
    if (formData.image_file) {
      data.append('image', formData.image_file);
    }
    if (formData.image_url) {
      data.append('image_url', formData.image_url);
    }

    const method = editingId ? 'PATCH' : 'POST';
    const url = editingId 
      ? `${API_BASE}/api/discovery/banners/${editingId}/` 
      : `${API_BASE}/api/discovery/banners/`;

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        },
        body: data
      });
      if (res.ok) {
        alert(editingId ? 'Cập nhật banner thành công' : 'Thêm banner thành công');
        setIsAdding(false);
        setEditingId(null);
        setFormData({ title: '', image_url: '', target_url: '', display_order: 0, is_active: true, image_file: null });
        fetchBanners();
      } else {
        alert('Lỗi lưu banner');
      }
    } catch (err) {
      alert('Lỗi mạng');
    }
  };

  const startEdit = (b: any) => {
    setEditingId(b.id);
    setFormData({
      title: b.title,
      image_url: b.image_url || '',
      target_url: b.target_url || '',
      display_order: b.display_order || 0,
      is_active: b.is_active,
      image_file: null
    });
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          onClick={() => {
            setIsAdding(!isAdding);
            if (isAdding) {
              setEditingId(null);
              setFormData({ title: '', image_url: '', target_url: '', display_order: 0, is_active: true, image_file: null });
            }
          }}
          className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAdding ? 'Hủy' : 'Thêm Banner Mới'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-5 rounded-xl border border-fuchsia-100 shadow-sm mb-6 animate-fadeIn">
          <h3 className="font-bold text-slate-800 mb-4">{editingId ? 'Sửa Banner' : 'Thêm Banner'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Tiêu đề (Nội bộ)</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="VD: Khuyến mãi mùa Hè..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Chọn ảnh từ tệp (Khuyên dùng)</label>
              <input type="file" accept="image/*" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" onChange={e => setFormData({...formData, image_file: e.target.files?.[0] || null})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Hoặc Link Ảnh (URL)</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Link Đích (Tùy chọn)</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400" value={formData.target_url} onChange={e => setFormData({...formData, target_url: e.target.value})} placeholder="/restaurant/123" />
            </div>
            <div className="flex items-center gap-4">
               <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Thứ tự</label>
                  <input type="number" className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" value={formData.display_order} onChange={e => setFormData({...formData, display_order: parseInt(e.target.value) || 0})} />
               </div>
               <label className="flex items-center gap-2 mt-5 cursor-pointer">
                  <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="rounded text-fuchsia-500" />
                  <span className="text-sm font-bold text-slate-600">Hiển thị</span>
               </label>
            </div>
            <div className="flex items-end">
              <button onClick={handleSave} className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 font-bold text-sm hover:bg-slate-700 transition">
                <Save className="w-4 h-4 inline-block mr-2" /> {editingId ? 'Cập Nhật' : 'Lưu Banner'}
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
                <button onClick={() => startEdit(b)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors mr-1" title="Sửa">
                  <Pencil className="w-4 h-4" />
                </button>
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    cover_image_url: string;
    cover_image_file: File | null;
  }>({
    title: '',
    description: '',
    cover_image_url: '',
    cover_image_file: null
  });

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
    
    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    
    if (formData.cover_image_file) {
      data.append('cover_image', formData.cover_image_file);
    }
    if (formData.cover_image_url) {
      data.append('cover_image_url', formData.cover_image_url);
    }

    const method = editingId ? 'PATCH' : 'POST';
    const url = editingId 
      ? `${API_BASE}/api/discovery/collections/${editingId}/` 
      : `${API_BASE}/api/discovery/collections/`;

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        },
        body: data
      });
      if (res.ok) {
        alert(editingId ? 'Cập nhật thành công' : 'Tạo bộ sưu tập thành công');
        setIsAdding(false);
        setEditingId(null);
        setFormData({ title: '', description: '', cover_image_url: '', cover_image_file: null });
        fetchCollections();
      }
    } catch (err) {
      alert('Lỗi kết nối');
    }
  };

  const startEdit = (c: any) => {
    setEditingId(c.id);
    setFormData({
      title: c.title,
      description: c.description || '',
      cover_image_url: c.cover_image_url || '',
      cover_image_file: null
    });
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
           onClick={() => {
             setIsAdding(!isAdding);
             if (isAdding) {
               setEditingId(null);
               setFormData({ title: '', description: '', cover_image_url: '', cover_image_file: null });
             }
           }}
           className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm"
         >
           {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {editingId ? 'Đang Sửa' : 'Tạo Mới'}
         </button>
      </div>

      {isAdding && (
        <div className="bg-white p-5 rounded-xl border border-fuchsia-100 shadow-sm animate-fadeIn">
          <h3 className="font-bold text-slate-800 mb-4">{editingId ? 'Cập Nhật Bộ Sưu Tập' : 'Tạo Mới Bộ Sưu Tập'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Tiêu đề Bộ sưu tập</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="VD: Quán ngon Hà Nội" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Mô tả (Ngắn gọn)</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Ăn sập thủ đô..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Chọn ảnh từ tệp</label>
              <input type="file" accept="image/*" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" onChange={e => setFormData({...formData, cover_image_file: e.target.files?.[0] || null})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Hoặc Link ảnh Cover</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400" value={formData.cover_image_url} onChange={e => setFormData({...formData, cover_image_url: e.target.value})} placeholder="https://..." />
            </div>
            <div className="lg:col-span-4 flex justify-end">
              <button onClick={handleSaveCollection} className="bg-slate-800 text-white rounded-lg px-6 py-2 font-bold text-sm hover:bg-slate-700 transition flex items-center gap-2">
                <Save className="w-4 h-4" /> {editingId ? 'Cập Nhật' : 'Tạo Ngay'}
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
                 {c.image_url || c.cover_image_url ? (
                    <img src={c.image_url || c.cover_image_url} alt="" className="w-16 h-16 rounded-xl object-cover bg-slate-100 shadow-sm" onError={handleImageError} />
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
              <div className="flex gap-2">
                <button onClick={() => startEdit(c)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition" title="Sửa thông tin">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDeleteCollection(c.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition" title="Xóa Bộ sưu tập">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List items */}
            <div className="pl-20 pr-4">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
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

// ======================================
// SEARCH TUNING TAB
// ======================================
function SearchTuningTab() {
  const [aliases, setAliases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    canonical_name: '',
    alias: '',
    match_target: 'CUISINE',
    is_active: true
  });

  const fetchAliases = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/restaurants/cuisine-aliases/`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAliases(data.results || data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAliases();
  }, []);

  const handleSave = async () => {
    if (!formData.canonical_name || !formData.alias) {
      return alert('Vui lòng nhập đủ Tên chuẩn và Từ khóa đồng nghĩa');
    }

    try {
      const url = editingId 
        ? `${API_BASE}/api/restaurants/cuisine-aliases/${editingId}/`
        : `${API_BASE}/api/restaurants/cuisine-aliases/`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setFormData({ canonical_name: '', alias: '', match_target: 'CUISINE', is_active: true });
        setEditingId(null);
        fetchAliases();
      } else {
        const err = await res.json();
        alert(err.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      canonical_name: item.canonical_name,
      alias: item.alias,
      match_target: item.match_target,
      is_active: item.is_active
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa từ khóa này?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/restaurants/cuisine-aliases/${id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      if (res.ok) fetchAliases();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="py-10 text-center text-slate-400">Đang tải...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
          {editingId ? 'Sửa từ khóa' : 'Thêm từ khóa đồng nghĩa mới'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên chuẩn (VD: Món Nhật)</label>
            <input 
              type="text" 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:border-rose-400 outline-none"
              placeholder="Nhóm chính..."
              value={formData.canonical_name}
              onChange={e => setFormData({...formData, canonical_name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Từ đồng nghĩa (VD: Sushi)</label>
            <input 
              type="text" 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:border-rose-400 outline-none"
              placeholder="Từ khóa phụ..."
              value={formData.alias}
              onChange={e => setFormData({...formData, alias: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Loại đối chiếu</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:border-rose-400 outline-none"
              value={formData.match_target}
              onChange={e => setFormData({...formData, match_target: e.target.value})}
            >
              <option value="CUISINE">Loại hình ẩm thực</option>
              <option value="DISH">Tên món ăn / Thực đơn</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleSave}
              className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition shadow-sm"
            >
              <Save className="w-4 h-4" /> {editingId ? 'Cập nhật' : 'Thêm mới'}
            </button>
            {editingId && (
              <button 
                onClick={() => { setEditingId(null); setFormData({ canonical_name: '', alias: '', match_target: 'CUISINE', is_active: true }); }}
                className="bg-slate-200 hover:bg-slate-300 text-slate-600 p-2 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-3 italic">* Hệ thống sẽ tự động tìm kiếm cả từ đồng nghĩa khi khách hàng nhập từ khóa chuẩn.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 font-bold text-slate-600 uppercase text-[10px] tracking-wider">Tên chuẩn</th>
              <th className="px-6 py-3 font-bold text-slate-600 uppercase text-[10px] tracking-wider">Từ đồng nghĩa</th>
              <th className="px-6 py-3 font-bold text-slate-600 uppercase text-[10px] tracking-wider">Áp dụng cho</th>
              <th className="px-6 py-3 font-bold text-slate-600 uppercase text-[10px] tracking-wider text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {aliases.map(item => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition">
                <td className="px-6 py-4 font-black text-slate-800">{item.canonical_name}</td>
                <td className="px-6 py-4">
                  <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded text-xs font-bold border border-rose-100">
                    {item.alias}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500 font-medium">
                  {item.match_target === 'CUISINE' ? 'Loại hình ẩm thực' : 'Món ăn / Thực đơn'}
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => startEdit(item)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition mr-1">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {aliases.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-slate-400 italic">Chưa có dữ liệu từ khóa</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ======================================
// COMMUNITY MODERATION TAB
// ======================================
function CommunityModerationTab() {
  const [pendingPosts, setPendingPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/community/posts/pending_approval/`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingPosts(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (slug: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/community/posts/${slug}/approve/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      if (res.ok) fetchPending();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (slug: string) => {
    if (!confirm('Bạn có chắc muốn từ chối bài viết này?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/community/posts/${slug}/reject/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
      });
      if (res.ok) fetchPending();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="py-10 text-center text-slate-400">Đang tải danh sách chờ...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-black text-slate-800">Kiểm duyệt bài viết</h3>
          <p className="text-sm text-slate-500">Danh sách các bài đăng đang chờ được phê duyệt để hiển thị công khai.</p>
        </div>
        <div className="bg-amber-100 text-amber-600 px-4 py-2 rounded-xl text-sm font-bold border border-amber-200">
          {pendingPosts.length} bài đang chờ
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pendingPosts.map(post => (
          <div key={post.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition">
            <div className="flex gap-6">
              <div className="w-40 aspect-video bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
                <img 
                  src={post.thumbnail ? (post.thumbnail.startsWith('http') ? post.thumbnail : `${API_BASE}${post.thumbnail}`) : PLACEHOLDER_IMAGE} 
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                    {post.category_display}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    Đăng bởi: {post.author_name} • {new Date(post.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
                <h4 className="font-black text-slate-800 mb-2 truncate text-lg">{post.title}</h4>
                <p className="text-sm text-slate-500 line-clamp-2 mb-4 italic">
                  "{post.excerpt || 'Không có mô tả ngắn...'}"
                </p>
                
                <div className="flex items-center gap-3">
                  <Link 
                    to={`/community/post/${post.slug}`} 
                    target="_blank"
                    className="text-blue-500 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition"
                  >
                    <Eye className="w-4 h-4" /> Xem nội dung
                  </Link>
                  <div className="ml-auto flex gap-2">
                    <button 
                      onClick={() => handleReject(post.slug)}
                      className="bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 px-5 py-2 rounded-xl text-sm font-bold transition"
                    >
                      Từ chối
                    </button>
                    <button 
                      onClick={() => handleApprove(post.slug)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-black shadow-lg shadow-emerald-100 flex items-center gap-2 transition"
                    >
                      <Check className="w-4 h-4" /> Duyệt bài
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {pendingPosts.length === 0 && (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-slate-200" />
             </div>
             <h4 className="text-lg font-bold text-slate-800">Tuyệt vời!</h4>
             <p className="text-slate-500 text-sm">Không còn bài viết nào đang chờ duyệt.</p>
          </div>
        )}
      </div>
    </div>
  );
}
