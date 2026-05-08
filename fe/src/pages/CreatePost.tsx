import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Image as ImageIcon, Send, Briefcase, Info, Search, Star } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

const CATEGORIES = [
  { id: 'NEWS', label: 'Tin tức & Sự kiện', icon: <Info className="w-4 h-4" /> },
  { id: 'RECRUITMENT', label: 'Tuyển dụng', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'SEEKING', label: 'Tìm việc', icon: <Search className="w-4 h-4" /> },
  { id: 'REVIEW', label: 'Review ẩm thực', icon: <Star className="w-4 h-4" /> },
];

export default function CreatePost() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: 'NEWS',
    content: '',
    excerpt: '',
    location_city: '',
    salary_text: '',
    thumbnail: null as File | null
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, thumbnail: file });
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return alert('Vui lòng nhập tiêu đề và nội dung');

    setLoading(true);
    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('category', formData.category);
      data.append('content', formData.content);
      data.append('excerpt', formData.excerpt);
      if (formData.location_city) data.append('location_city', formData.location_city);
      if (formData.salary_text) data.append('salary_text', formData.salary_text);
      if (formData.thumbnail) data.append('thumbnail', formData.thumbnail);

      const res = await fetch(`${API_BASE}/api/community/posts/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        },
        body: data
      });

      if (res.ok) {
        alert('Gửi bài viết thành công! Vui lòng chờ Admin duyệt.');
        navigate('/community');
      } else {
        const err = await res.json();
        alert(err.error || 'Vui lòng đăng nhập để đăng bài');
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi gửi bài');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-12 flex-1">
        <Link to="/community" className="inline-flex items-center gap-2 text-slate-500 hover:text-rose-500 font-bold text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Quay lại cộng đồng
        </Link>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 p-8 text-white">
            <h1 className="text-2xl font-black mb-2">Đăng bài viết mới</h1>
            <p className="text-slate-400 text-sm">Chia sẻ thông tin của bạn với cộng đồng ẩm thực.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {/* Category selection */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat.id })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    formData.category === cat.id 
                    ? 'border-rose-500 bg-rose-50 text-rose-600' 
                    : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                  }`}
                >
                  {cat.icon}
                  <span className="text-xs font-black text-center">{cat.label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Tiêu đề bài viết</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-lg font-bold focus:bg-white focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all"
                  placeholder="Nhập tiêu đề hấp dẫn..."
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              {/* Recruitment specific fields */}
              {(formData.category === 'RECRUITMENT' || formData.category === 'SEEKING') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Khu vực (Tỉnh/Thành)</label>
                    <input 
                      type="text" 
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-rose-500 outline-none"
                      placeholder="Ví dụ: Hồ Chí Minh"
                      value={formData.location_city}
                      onChange={e => setFormData({ ...formData, location_city: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Mức lương / Mong muốn</label>
                    <input 
                      type="text" 
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-rose-500 outline-none"
                      placeholder="Ví dụ: 7-10 triệu"
                      value={formData.salary_text}
                      onChange={e => setFormData({ ...formData, salary_text: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Thumbnail */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Ảnh đại diện</label>
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="relative group w-full md:w-64 aspect-video bg-slate-100 rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 flex items-center justify-center">
                    {previewUrl ? (
                      <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-slate-300" />
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 text-sm text-slate-500">
                    <p className="font-bold text-slate-700 mb-1">Chọn ảnh đại diện cho bài viết</p>
                    <p>Định dạng: JPG, PNG. Dung lượng tối đa 2MB.</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Nội dung bài viết</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm focus:bg-white focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all min-h-[300px]"
                  placeholder="Viết nội dung chi tiết tại đây..."
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                />
              </div>

              {/* Excerpt */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Mô tả ngắn (Tóm tắt)</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-3 text-sm focus:bg-white outline-none transition-all min-h-[80px]"
                  placeholder="Một vài dòng tóm tắt bài viết..."
                  value={formData.excerpt}
                  onChange={e => setFormData({ ...formData, excerpt: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100 flex justify-end gap-4">
               <button 
                type="button"
                onClick={() => navigate('/community')}
                className="px-8 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition"
               >
                 Hủy bỏ
               </button>
               <button 
                type="submit"
                disabled={loading}
                className="bg-rose-500 hover:bg-rose-600 text-white px-10 py-3 rounded-2xl font-black text-lg flex items-center gap-3 transition shadow-lg shadow-rose-200 disabled:opacity-50"
               >
                 {loading ? 'Đang gửi...' : <><Send className="w-5 h-5" /> Đăng bài ngay</>}
               </button>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
