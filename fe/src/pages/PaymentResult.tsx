import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowLeft, CreditCard, ChevronRight } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import { verifyVNPAYReturn } from '@/lib/api';

const PaymentResult: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string>('');
  
  const responseCode = searchParams.get('vnp_ResponseCode');
  const amount = searchParams.get('vnp_Amount');
  const txnRef = searchParams.get('vnp_TxnRef');
  
  useEffect(() => {
    const verifyPayment = async () => {
      if (!responseCode) {
        setIsSuccess(false);
        setMessage('Không tìm thấy dữ liệu giao dịch từ VNPay.');
        return;
      }

      try {
        const result = await verifyVNPAYReturn(window.location.search);
        setIsSuccess(result.success);
        setMessage(result.message);
      } catch (err) {
        setIsSuccess(false);
        setMessage(err instanceof Error ? err.message : 'Không xác minh được kết quả thanh toán.');
      }
    };
    
    verifyPayment();
  }, [responseCode]);

  // Extract booking ID from txnRef (format was {booking.id}_{uuid})
  const bookingId = txnRef ? txnRef.split('_')[0] : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-['Outfit']">
      <Header />
      
      <main className="flex-1 flex items-center justify-center p-4 py-20">
        <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 overflow-hidden border border-slate-100">
            {/* Top Status Banner */}
            <div className={`p-10 text-center ${isSuccess ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <div className="flex justify-center mb-6">
                {isSuccess ? (
                  <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-emerald-200 animate-bounce">
                    <CheckCircle size={40} />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-rose-500 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-rose-200 animate-shake">
                    <XCircle size={40} />
                  </div>
                )}
              </div>
              
              <h1 className={`text-2xl font-black mb-2 ${isSuccess ? 'text-emerald-900' : 'text-rose-900'}`}>
                {isSuccess ? 'Thanh toán thành công!' : 'Thanh toán thất bại'}
              </h1>
              <p className={`text-sm font-medium opacity-70 ${isSuccess ? 'text-emerald-700' : 'text-rose-700'}`}>
                {message || (isSuccess
                  ? 'Cảm ơn bạn đã hoàn tất đặt cọc. Chúc bạn có một trải nghiệm ẩm thực tuyệt vời!'
                  : 'Đã có lỗi xảy ra trong quá trình thanh toán hoặc giao dịch bị hủy.')}
              </p>
            </div>

            {/* Transaction Details */}
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-slate-50">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mã giao dịch</span>
                  <span className="text-sm font-mono font-bold text-slate-700">{txnRef || 'N/A'}</span>
                </div>
                
                <div className="flex justify-between items-center py-3 border-b border-slate-50">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Số tiền</span>
                  <span className="text-sm font-black text-slate-900">
                    {amount ? new Intl.NumberFormat('vi-VN').format(Number(amount) / 100) : '0'}đ
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-slate-50">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phương thức</span>
                  <div className="flex items-center gap-2">
                    <CreditCard size={14} className="text-blue-500" />
                    <span className="text-sm font-bold text-slate-700">VNPAY Gateway</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                {isSuccess && bookingId && (
                  <button
                    onClick={() => navigate(`/my-bookings?highlight=${bookingId}`)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                  >
                    Xem đơn đặt của tôi
                    <ChevronRight size={14} />
                  </button>
                )}
                
                <button
                  onClick={() => navigate('/my-bookings')}
                  className="w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
                >
                  <ArrowLeft size={14} />
                  Quay lại danh sách
                </button>

                {!isSuccess && (
                  <button
                    onClick={() => navigate('/')}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
                  >
                    Thử lại hoặc đặt bàn khác
                  </button>
                )}
              </div>
            </div>
            
            {/* Footer Note */}
            <div className="p-6 bg-slate-50 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                Hệ thống hỗ trợ 24/7 <br/> Hotline: 1900 xxxx
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default PaymentResult;
