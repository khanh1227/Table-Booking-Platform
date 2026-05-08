import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, ArrowRight, Utensils } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import CollectionCard from '@/components/discovery/CollectionCard';
import { PLACEHOLDER_IMAGE, handleImageError } from '@/lib/imageUtils';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export default function Collections() {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/discovery/collections/`);
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      {/* Hero Section */}
      <section className="bg-white border-b border-slate-100 py-10 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <div className="inline-flex items-center gap-2 bg-rose-50 text-rose-500 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-4 border border-rose-100">
            <LayoutGrid className="w-4 h-4" /> Khám phá theo chủ đề
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 tracking-tight">Bộ Sưu Tập Nhà Hàng</h1>
          <p className="text-slate-500 text-base max-w-2xl mx-auto">
            Tổng hợp những địa điểm ăn uống đặc sắc được phân loại theo nhu cầu, sở thích và không gian để bạn dễ dàng lựa chọn.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="container mx-auto max-w-6xl px-4 py-8 flex-1">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="aspect-[4/5] bg-white rounded-3xl animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {collections.map(col => (
              <CollectionCard key={col.id} collection={col} />
            ))}
          </div>
        )}

        {!loading && collections.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <h3 className="text-xl font-bold text-slate-800">Chưa có bộ sưu tập nào</h3>
            <p className="text-slate-500">Chúng tôi đang cập nhật những chủ đề mới nhất...</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

