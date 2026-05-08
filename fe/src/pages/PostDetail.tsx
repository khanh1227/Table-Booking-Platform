import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, User, Eye, ArrowLeft, Share2, Briefcase, MapPin, DollarSign, MessageSquare, Send } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import { PLACEHOLDER_IMAGE, handleImageError } from '@/lib/imageUtils';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export default function PostDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [commentContent, setCommentContent] = useState('');

  useEffect(() => {
    fetchPost();
  }, [slug]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/community/posts/${slug}/`);
      if (res.ok) {
        const data = await res.json();
        setPost(data);
      } else {
        navigate('/community');
      }
    } catch (err) {
      console.error('Failed to fetch post:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/community/comments/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        },
        body: JSON.stringify({
          post: post.id,
          content: commentContent
        })
      });

      if (res.ok) {
        setCommentContent('');
        fetchPost(); // Refresh to show new comment
      } else {
        alert('Vui lòng đăng nhập để bình luận');
      }
    } catch (err) {
      console.error('Comment failed:', err);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <Footer />
    </div>
  );

  if (!post) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-8 flex-1">
        {/* Back button */}
        <Link to="/community" className="inline-flex items-center gap-2 text-slate-500 hover:text-rose-500 font-bold text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Quay lại cộng đồng
        </Link>

        <article className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Cover Image */}
          <div className="aspect-[21/9] overflow-hidden bg-slate-100">
            <img 
              src={post.thumbnail ? (post.thumbnail.startsWith('http') ? post.thumbnail : `${API_BASE}${post.thumbnail}`) : PLACEHOLDER_IMAGE}
              alt={post.title}
              className="w-full h-full object-cover"
              onError={handleImageError}
            />
          </div>

          <div className="p-6 md:p-12">
            {/* Header Meta */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest border border-rose-200">
                {post.category_display}
              </span>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {new Date(post.created_at).toLocaleDateString('vi-VN')}</span>
                <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {post.author_details?.full_name || 'Người dùng'}</span>
                <span className="flex items-center gap-1.5"><Eye className="w-4 h-4" /> {post.views_count} lượt xem</span>
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-8 leading-tight">
              {post.title}
            </h1>

            {/* Special Info (Recruitment/Seeking) */}
            {(post.location_city || post.salary_text) && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                 {post.location_city && (
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center"><MapPin className="w-5 h-5 text-rose-500" /></div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Khu vực</p>
                        <p className="text-sm font-black text-slate-700">{post.location_city}</p>
                      </div>
                   </div>
                 )}
                 {post.salary_text && (
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center"><DollarSign className="w-5 h-5 text-emerald-500" /></div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Mức lương</p>
                        <p className="text-sm font-black text-slate-700">{post.salary_text}</p>
                      </div>
                   </div>
                 )}
              </div>
            )}

            {/* Content Body */}
            <div className="prose prose-rose max-w-none text-slate-600 text-lg leading-relaxed mb-12 whitespace-pre-wrap">
              {post.content}
            </div>

            {/* Footer / Actions */}
            <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
               <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition">
                 <Share2 className="w-4 h-4" /> Chia sẻ bài viết
               </button>
               {post.category === 'RECRUITMENT' && (
                 <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-sm transition shadow-lg shadow-emerald-100">
                   Ứng tuyển ngay
                 </button>
               )}
            </div>
          </div>
        </article>

        {/* Comments Section */}
        <div className="mt-12">
           <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
             <MessageSquare className="w-6 h-6 text-rose-500" /> Bình luận ({post.comments?.length || 0})
           </h3>

           <div className="space-y-6">
              {/* Comment Input */}
              <form onSubmit={handlePostComment} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <textarea 
                  placeholder="Viết bình luận của bạn..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 transition-all min-h-[100px]"
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                />
                <div className="flex justify-end mt-3">
                  <button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition">
                    <Send className="w-4 h-4" /> Gửi bình luận
                  </button>
                </div>
              </form>

              {/* Comment List */}
              {post.comments?.map((comment: any) => (
                <div key={comment.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                   <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-black text-white">
                        {comment.author_name?.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm font-black text-slate-800">{comment.author_name}</p>
                      <span className="text-[10px] font-bold text-slate-400">{new Date(comment.created_at).toLocaleDateString('vi-VN')}</span>
                   </div>
                   <p className="text-slate-600 text-sm leading-relaxed">{comment.content}</p>
                </div>
              ))}
           </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
