import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, Clock, ChevronRight } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import RestaurantCard from '@/components/restaurant/RestaurantCard';
import { PLACEHOLDER_IMAGE, handleImageError } from '@/lib/imageUtils';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export default function CollectionDetail() {
  const { id } = useParams();
  const [collection, setCollection] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCollection();
  }, [id]);

  const fetchCollection = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/discovery/collections/${id}/`);
      if (res.ok) {
        const data = await res.json();
        setCollection(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center"><div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>
      <Footer />
    </div>
  );

  if (!collection) return null;

  const imageUrl = collection.cover_image 
    ? (collection.cover_image.startsWith('http') ? collection.cover_image : `${API_BASE}${collection.cover_image}`)
    : (collection.cover_image_url || PLACEHOLDER_IMAGE);

  const items = collection.items || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      {/* Header Banner */}
      <div className="relative h-[40vh] bg-slate-900 overflow-hidden">
        <img 
          src={imageUrl}
          className="w-full h-full object-cover opacity-50"
          alt={collection.title}
          onError={handleImageError}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 to-transparent" />
        
        <div className="absolute inset-0 flex items-center">
           <div className="container mx-auto max-w-6xl px-4">
              <Link to="/collections" className="inline-flex items-center gap-2 text-white/80 hover:text-white font-bold text-sm mb-6 transition">
                <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
              </Link>
              <h1 className="text-4xl md:text-6xl font-black text-slate-900 leading-tight">
                {collection.title}
              </h1>
              <p className="text-slate-600 text-lg max-w-2xl mt-4">
                {collection.description}
              </p>
           </div>
        </div>
      </div>

      <main className="container mx-auto max-w-6xl px-4 py-12 flex-1">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-2xl font-black text-slate-800">
            Danh sách nhà hàng ({items.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((item: any) => (
            <RestaurantCard 
              key={item.restaurant.id} 
              restaurant={item.restaurant} 
            />
          ))}
        </div>
        {items.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
             <h3 className="text-xl font-bold text-slate-800">Bộ sưu tập này đang được cập nhật</h3>
             <p className="text-slate-500">Hãy quay lại sau để khám phá những địa điểm mới nhé.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
