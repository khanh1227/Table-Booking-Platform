import { Calendar, Heart, PartyPopper, Users, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CollectionData {
  id: number;
  title: string;
  description: string;
  cover_image_url: string;
  iconType?: 'heart' | 'party' | 'group' | 'sparkles';
  places_count: number;
}

interface CollectionListProps {
  collections: CollectionData[];
}

const renderIcon = (type?: string, className: string = "w-6 h-6") => {
  switch (type) {
    case 'heart': return <Heart className={className} />;
    case 'party': return <PartyPopper className={className} />;
    case 'group': return <Users className={className} />;
    case 'sparkles': return <Sparkles className={className} />;
    default: return <Calendar className={className} />;
  }
};

export default function CollectionList({ collections }: CollectionListProps) {
  if (!collections || collections.length === 0) return null;

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Bộ Sưu Tập Nổi Bật</h2>
          <p className="text-gray-500 mt-2">Khám phá các gợi ý quán ngon cho mọi dịp</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {collections.map((col) => (
          <Link 
            key={col.id} 
            to={`/explore?collection_id=${col.id}&collection_name=${encodeURIComponent(col.title)}`}
            className="relative h-64 rounded-2xl overflow-hidden group cursor-pointer shadow-md hover:shadow-xl transition-all duration-300 block"
          >
            <img 
              src={col.cover_image_url} 
              alt={col.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-70 group-hover:opacity-85 transition-opacity duration-300"></div>
            
            {/* Content box */}
            <div className="absolute inset-0 p-6 flex flex-col justify-end">
              <div className="bg-white/20 backdrop-blur-md w-max p-2 rounded-xl mb-3 text-white border border-white/30">
                {renderIcon(col.iconType, "w-6 h-6")}
              </div>
              <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-amber-400 transition-colors">
                {col.title}
              </h3>
              <p className="text-gray-300 text-sm line-clamp-2 mb-3 max-h-0 opacity-0 group-hover:max-h-20 group-hover:opacity-100 transition-all duration-500 ease-in-out">
                {col.description}
              </p>
              <div className="text-sm font-medium text-amber-400 bg-amber-900/40 w-max px-3 py-1 rounded-full backdrop-blur-sm">
                {col.places_count} Địa điểm
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
