import React, { useState } from 'react';
import { Star, MessageCircle, X } from 'lucide-react';

interface ReviewFormProps {
  bookingId: number;
  restaurantName: string;
  onClose: () => void;
  onSubmit: (data: { rating: number; comment: string; images: File[] }) => void;
}

export default function ReviewForm({ bookingId, restaurantName, onClose, onSubmit }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<File[]>([]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      if (images.length + filesArray.length > 5) {
        alert("Chỉ được tải lên tối đa 5 ảnh.");
        return;
      }
      setImages(prev => [...prev, ...filesArray]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      alert("Vui lòng chọn số sao đánh giá!");
      return;
    }
    onSubmit({ rating, comment, images });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-6 text-white text-center">
          <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-90" />
          <h2 className="text-2xl font-bold">Đánh giá Trải nghiệm</h2>
          <p className="opacity-90 mt-1">Tại {restaurantName}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="text-center">
            <label className="block text-gray-700 font-medium mb-3 text-lg">
              Bạn đánh giá bao nhiêu sao?
            </label>
            <div className="flex justify-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= (hoverRating || rating)
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {rating === 0 ? "Chưa chọn đánh giá" : `${rating} Sao`}
            </p>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Chia sẻ cảm nhận của bạn (Tuỳ chọn)
            </label>
            <textarea
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all resize-none h-24 text-sm"
              placeholder="Thức ăn ngon, phục vụ chu đáo..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2 flex items-center justify-between">
              <span>Đính kèm hình ảnh (Tối đa 5 ảnh)</span>
              <span className="text-xs text-gray-400">{images.length}/5</span>
            </label>
            <div className="flex gap-3 overflow-x-auto pb-2 mb-1 custom-scrollbar">
              {images.map((img, index) => (
                <div key={index} className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-gray-200">
                  <img src={URL.createObjectURL(img)} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/80 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <label className="w-20 h-20 shrink-0 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 hover:bg-amber-50 transition">
                  <span className="text-gray-400 text-2xl leading-none">+</span>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageChange}
                  />
                </label>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-amber-600 outline-none hover:bg-orange-600 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-300 hover:shadow-lg flex justify-center items-center"
          >
            Gửi Đánh Giá
          </button>
        </form>
      </div>
    </div>
  );
}
