import { Link } from 'react-router-dom';
import { Utensils, ArrowRight } from 'lucide-react';
import { PLACEHOLDER_IMAGE, handleImageError } from '@/lib/imageUtils';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

interface CollectionCardProps {
  collection: {
    id: number;
    title: string;
    description?: string;
    cover_image?: string;
    cover_image_url?: string;
    items_count?: number;
    items?: any[];
  };
}

export default function CollectionCard({ collection }: CollectionCardProps) {
  // Use cover_image_url or cover_image
  const imageUrl = collection.cover_image 
    ? (collection.cover_image.startsWith('http') ? collection.cover_image : `${API_BASE}${collection.cover_image}`)
    : (collection.cover_image_url || PLACEHOLDER_IMAGE);

  return (
    <Link 
      to={`/collection/${collection.id}`}
      className="group relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-slate-900 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
    >
      {/* Background Image */}
      <img 
        src={imageUrl}
        alt={collection.title}
        className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-60 group-hover:scale-110 transition-all duration-700"
        onError={handleImageError}
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/20 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 p-8 flex flex-col justify-end">
        <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
          <div className="flex items-center gap-2 text-rose-400 font-black text-[10px] uppercase tracking-widest mb-2">
            <Utensils className="w-3.5 h-3.5" />
            {collection.items_count || collection.items?.length || 0} Nhà hàng
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-white mb-2 leading-tight">
            {collection.title}
          </h3>
          <p className="text-slate-300 text-sm line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
            {collection.description || 'Khám phá ngay danh sách những nhà hàng tuyệt vời nhất trong chủ đề này.'}
          </p>
          
          <div className="mt-6 flex items-center gap-2 text-white font-bold text-sm opacity-0 group-hover:opacity-100 transition-all duration-500 delay-200">
            Xem danh sách <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}
