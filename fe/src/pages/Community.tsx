import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Calendar, User, Eye, ArrowRight, MessageSquare, Briefcase, Info, MessageCircle, Star, Plus } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import { PLACEHOLDER_IMAGE, handleImageError } from '@/lib/imageUtils';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

const CATEGORIES = [
  { id: 'all', label: 'Tất cả', color: 'bg-slate-800' },
  { id: 'NEWS', label: 'Tin tức', color: 'bg-blue-500', icon: <Info className="w-4 h-4" /> },
  { id: 'RECRUITMENT', label: 'Tuyển dụng', color: 'bg-emerald-500', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'SEEKING', label: 'Tìm việc', color: 'bg-amber-500', icon: <Search className="w-4 h-4" /> },
  { id: 'REVIEW', label: 'Review', color: 'bg-rose-500', icon: <Star className="w-4 h-4" /> },
];

export default function Community() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPosts();
  }, [activeCategory]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/community/posts/`;
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.append('category', activeCategory);
      if (searchQuery) params.append('search', searchQuery);
      
      const res = await fetch(`${url}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.results || data);
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPosts();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      {/* Hero Section */}
      <section className="bg-slate-900 text-white py-16 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">Cộng Đồng Ẩm Thực & Tuyển Dụng</h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10">
            Nơi chia sẻ tin tức, review quán ngon và kết nối cơ hội việc làm trong ngành F&B.
          </p>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative">
            <input 
              type="text" 
              placeholder="Tìm kiếm bài viết, tin tuyển dụng..." 
              className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 pl-12 pr-6 text-white placeholder-white/40 focus:bg-white focus:text-slate-900 focus:outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 bg-rose-500 hover:bg-rose-600 text-white px-5 py-2 rounded-xl font-bold text-sm transition">
              Tìm ngay
            </button>
          </form>
        </div>
      </section>

      {/* Filter Tabs */}
      <div className="container mx-auto max-w-6xl px-4 -mt-8 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-2 flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                activeCategory === cat.id 
                ? 'bg-slate-900 text-white shadow-lg' 
                : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
          <div className="ml-auto flex items-center px-4">
             <Link to="/community/create" className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 transition shadow-md shadow-rose-200">
               <Plus className="w-4 h-4" /> Đăng bài mới
             </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto max-w-6xl px-4 py-12 flex-1">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-3xl h-96 animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
            <MessageCircle className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800">Chưa có bài viết nào</h3>
            <p className="text-slate-500">Hãy là người đầu tiên chia sẻ tin tức!</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function PostCard({ post }: { post: any }) {
  const cat = CATEGORIES.find(c => c.id === post.category) || CATEGORIES[1];
  
  return (
    <article className="group bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col h-full">
      {/* Image Container */}
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        <img 
          src={post.thumbnail ? (post.thumbnail.startsWith('http') ? post.thumbnail : `${API_BASE}${post.thumbnail}`) : PLACEHOLDER_IMAGE}
          alt={post.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={handleImageError}
        />
        <div className="absolute top-4 left-4">
          <span className={`${cat.color} text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5`}>
            {cat.icon}
            {post.category_display}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mb-3">
          <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {new Date(post.created_at).toLocaleDateString('vi-VN')}</span>
          <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {post.author_name}</span>
        </div>

        <h3 className="text-lg font-black text-slate-800 line-clamp-2 mb-3 leading-tight group-hover:text-rose-500 transition-colors">
          <Link to={`/community/post/${post.slug}`}>
            {post.title}
          </Link>
        </h3>

        <p className="text-sm text-slate-500 line-clamp-3 mb-6 flex-1">
          {post.excerpt || 'Xem chi tiết bài viết để biết thêm thông tin...'}
        </p>

        <div className="pt-6 border-t border-slate-100 flex items-center justify-between mt-auto">
          <div className="flex items-center gap-3 text-slate-400">
             <span className="flex items-center gap-1.5 text-xs font-bold"><Eye className="w-3.5 h-3.5" /> {post.views_count}</span>
             <span className="flex items-center gap-1.5 text-xs font-bold"><MessageSquare className="w-3.5 h-3.5" /> 0</span>
          </div>
          <Link 
            to={`/community/post/${post.slug}`}
            className="text-rose-500 font-black text-sm flex items-center gap-1 hover:gap-2 transition-all"
          >
            Đọc tiếp <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

