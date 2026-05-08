// src/components/bookings/CancelConfirmDialog.tsx
import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

interface CancelConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

export const CancelConfirmDialog: React.FC<CancelConfirmDialogProps> = ({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  loading 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] max-w-md w-full p-8 shadow-2xl shadow-slate-900/20 animate-in zoom-in-95 duration-300">
        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mb-6 mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        
        <div className="text-center mb-8">
          <h3 className="text-2xl font-black text-slate-900 mb-2">Xác nhận hủy đặt bàn</h3>
          <p className="text-slate-500 font-medium leading-relaxed">
            Bạn có chắc chắn muốn hủy đặt bàn này không? <br/>Hành động này <span className="text-rose-600 font-bold">không thể hoàn tác</span>.
          </p>
        </div>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full py-4 bg-rose-600 text-white rounded-2xl hover:bg-rose-700 transition-all font-black uppercase tracking-widest text-xs shadow-xl shadow-rose-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Đang xử lý..." : "Đồng ý hủy đơn"}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 hover:text-slate-600 transition-all font-black uppercase tracking-widest text-xs disabled:opacity-50"
          >
            Quay lại
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelConfirmDialog;