import React from 'react';
import { Star, MessageCircle, User, X } from 'lucide-react';

export interface ReviewData {
  id: number;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  reply?: string;
  images?: string[];
}

interface ReviewListProps {
  reviews: ReviewData[];
  ratingAverage: number;
  ratingCount: number;
}

export default function ReviewList({ reviews, ratingAverage, ratingCount }: ReviewListProps) {
  const [lightboxImage, setLightboxImage] = React.useState<string | null>(null);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center">
          <MessageCircle className="w-6 h-6 mr-2 text-amber-500" />
          Đánh Giá Từ Thực Khách
        </h3>
        <div className="flex items-center justify-center bg-amber-50 px-4 py-2 rounded-xl">
          <Star className="w-6 h-6 text-amber-500 fill-amber-500 mr-2" />
          <span className="text-2xl font-bold text-gray-900 mr-1">{ratingAverage.toFixed(1)}</span>
          <span className="text-gray-500 font-medium">({ratingCount} đánh giá)</span>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500 text-lg">Chưa có đánh giá nào cho nhà hàng này.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-gray-100 last:border-0 pb-6 last:pb-0">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-slate-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">{review.customerName}</h4>
                    <p className="text-xs text-gray-500">{review.createdAt}</p>
                  </div>
                </div>
                <div className="flex space-x-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < review.rating ? 'text-amber-500 fill-amber-500' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              
              <p className="text-gray-700 leading-relaxed ml-13">
                {review.comment || <span className="text-gray-400 italic">Không có bình luận</span>}
              </p>

              {review.reply && (
                <div className="ml-13 mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center mb-1">
                    <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded mr-2">
                      Phản hồi từ Nhà Hàng
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{review.reply}</p>
                </div>
              )}

              {/* Review Images */}
              {review.images && review.images.length > 0 && (
                <div className="ml-13 mt-3 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                  {review.images.map((img, idx) => (
                    <div 
                      key={idx} 
                      className="w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:opacity-80 transition"
                      onClick={() => setLightboxImage(img)}
                    >
                      <img src={img} alt="review image" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors p-2"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src={lightboxImage} 
            alt="Enlarged review" 
            className="max-w-full max-h-[90vh] object-contain rounded-md"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
}
