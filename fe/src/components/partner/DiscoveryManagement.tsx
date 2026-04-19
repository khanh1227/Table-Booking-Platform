import { useState, useEffect } from 'react';
import { Compass, Plus, Trash2, Image, FolderOpen, Star, X } from 'lucide-react';
import { fetchCollections, fetchBanners, createCollection, deleteCollection, createBanner, deleteBanner, fetchRestaurants } from '@/lib/api';

type TabType = 'collections' | 'banners';

export default function DiscoveryManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('collections');
  const [collections, setCollections] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Collection form
  const [colTitle, setColTitle] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [colCover, setColCover] = useState('');
  const [selectedRestIds, setSelectedRestIds] = useState<number[]>([]);
  
  // Banner form
  const [banTitle, setBanTitle] = useState('');
  const [banImage, setBanImage] = useState('');
  const [banTarget, setBanTarget] = useState('');
  const [banOrder, setBanOrder] = useState(1);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cols, bans, rests] = await Promise.all([
        fetchCollections(),
        fetchBanners(),
        fetchRestaurants()
      ]);
      setCollections(cols);
      setBanners(bans);
      setRestaurants(rests);
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!colTitle.trim()) return;
    setSubmitting(true);
    try {
      await createCollection({
        title: colTitle,
        description: colDesc,
        cover_image_url: colCover,
        restaurant_ids: selectedRestIds,
      });
      setColTitle(''); setColDesc(''); setColCover(''); setSelectedRestIds([]);
      setShowForm(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCollection = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa bộ sưu tập này?')) return;
    try { await deleteCollection(id); await loadData(); } catch (e: any) { alert(e.message); }
  };

  const handleCreateBanner = async () => {
    if (!banTitle.trim() || !banImage.trim()) return;
    setSubmitting(true);
    try {
      await createBanner({
        title: banTitle,
        image_url: banImage,
        target_url: banTarget,
        display_order: banOrder,
      });
      setBanTitle(''); setBanImage(''); setBanTarget(''); setBanOrder(1);
      setShowForm(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBanner = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa banner này?')) return;
    try { await deleteBanner(id); await loadData(); } catch (e: any) { alert(e.message); }
  };

  const toggleRestaurant = (id: number) => {
    setSelectedRestIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <Compass className="w-7 h-7 mr-2 text-indigo-600" />
            Quản lý Khám phá
          </h2>
          <p className="text-gray-500 mt-1">Quản lý bộ sưu tập và banner hiển thị trên trang chủ</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center shadow-md shadow-indigo-200"
        >
          <Plus className="w-5 h-5 mr-1.5" />
          Tạo mới
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
        <button 
          onClick={() => { setActiveTab('collections'); setShowForm(false); }}
          className={`flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'collections' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FolderOpen className="w-4 h-4" /> Bộ sưu tập ({collections.length})
        </button>
        <button 
          onClick={() => { setActiveTab('banners'); setShowForm(false); }}
          className={`flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'banners' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Image className="w-4 h-4" /> Banner ({banners.length})
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">
              {activeTab === 'collections' ? 'Tạo Bộ sưu tập mới' : 'Tạo Banner mới'}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          
          {activeTab === 'collections' ? (
            <>
              <input value={colTitle} onChange={e => setColTitle(e.target.value)} placeholder="Tên bộ sưu tập *"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              <textarea value={colDesc} onChange={e => setColDesc(e.target.value)} placeholder="Mô tả"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" rows={2} />
              <input value={colCover} onChange={e => setColCover(e.target.value)} placeholder="URL ảnh bìa"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Chọn nhà hàng ({selectedRestIds.length} đã chọn)</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {restaurants.map((r: any) => (
                    <label key={r.id} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                      selectedRestIds.includes(r.id) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                    }`}>
                      <input type="checkbox" checked={selectedRestIds.includes(r.id)} onChange={() => toggleRestaurant(r.id)} className="accent-indigo-600" />
                      <span className="truncate">{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <button onClick={handleCreateCollection} disabled={submitting || !colTitle.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors">
                {submitting ? 'Đang tạo...' : 'Tạo Bộ sưu tập'}
              </button>
            </>
          ) : (
            <>
              <input value={banTitle} onChange={e => setBanTitle(e.target.value)} placeholder="Tiêu đề banner *"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              <input value={banImage} onChange={e => setBanImage(e.target.value)} placeholder="URL hình ảnh *"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              <input value={banTarget} onChange={e => setBanTarget(e.target.value)} placeholder="URL đích (khi click)"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              <input type="number" value={banOrder} onChange={e => setBanOrder(Number(e.target.value))} placeholder="Thứ tự hiển thị"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              
              <button onClick={handleCreateBanner} disabled={submitting || !banTitle.trim() || !banImage.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors">
                {submitting ? 'Đang tạo...' : 'Tạo Banner'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
          <p className="text-gray-500">Đang tải...</p>
        </div>
      ) : activeTab === 'collections' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {collections.map((col: any) => (
            <div key={col.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
              {col.cover_image_url && (
                <img src={col.cover_image_url} alt={col.title} className="w-full h-40 object-cover" />
              )}
              <div className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg">{col.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">{col.description}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                      <Star className="w-3.5 h-3.5" /> {col.items_count || 0} nhà hàng
                    </div>
                  </div>
                  <button onClick={() => handleDeleteCollection(col.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {collections.length === 0 && (
            <div className="col-span-2 text-center py-12 text-gray-500 bg-white rounded-2xl border border-slate-100">
              <FolderOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              Chưa có bộ sưu tập nào. Bấm "Tạo mới" để bắt đầu.
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {banners.map((ban: any) => (
            <div key={ban.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
              <img src={ban.image_url} alt={ban.title} className="w-full h-36 object-cover" />
              <div className="p-4 flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-gray-800">{ban.title}</h4>
                  <span className="text-xs text-gray-400">Thứ tự: {ban.display_order}</span>
                </div>
                <button onClick={() => handleDeleteBanner(ban.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {banners.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-500 bg-white rounded-2xl border border-slate-100">
              <Image className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              Chưa có banner nào. Bấm "Tạo mới" để bắt đầu.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
