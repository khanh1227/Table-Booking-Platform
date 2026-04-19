import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, TrendingUp, History, Download } from 'lucide-react';

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'FEE' | 'REFUND' | 'PAYMENT';
  amount: number;
  description: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  createdAt: string;
}

interface WalletData {
  balance: number;
  availableBalance: number;
  pendingBalance: number;
  recentTransactions: Transaction[];
}

interface PartnerWalletProps {
  wallet: WalletData;
}

export default function PartnerWallet({ wallet }: PartnerWalletProps) {
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
      case 'PAYMENT':
      case 'REFUND':
        return <ArrowDownLeft className="w-5 h-5 text-green-500" />;
      case 'WITHDRAWAL':
      case 'FEE':
        return <ArrowUpRight className="w-5 h-5 text-red-500" />;
      default:
        return <TrendingUp className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTransactionColor = (type: string) => {
    if (type === 'DEPOSIT' || type === 'PAYMENT' || type === 'REFUND') return 'text-green-600';
    return 'text-red-600';
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'Thành công';
      case 'PENDING': return 'Đang xử lý';
      case 'FAILED': return 'Thất bại';
      default: return status;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-blue-100 font-medium tracking-wide">Tổng số dư</h3>
              <WalletIcon className="w-6 h-6 text-blue-200" />
            </div>
            <p className="text-4xl font-bold tracking-tight">
              {formatCurrency(wallet.balance)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-medium">Khả dụng rút</h3>
            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {formatCurrency(wallet.availableBalance)}
          </p>
          <button className="mt-4 w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-2 rounded-xl transition-colors">
            Rút tiền ngay
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-medium">Đang chờ xử lý</h3>
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
              <History className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {formatCurrency(wallet.pendingBalance)}
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Tiền cọc từ các booking chưa hoàn thành
          </p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">Lịch sử giao dịch</h3>
          <button className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg transition-colors">
            <Download className="w-4 h-4 mr-2" />
            Xuất báo cáo
          </button>
        </div>
        
        <div className="divide-y divide-gray-100">
          {wallet.recentTransactions.map((tx) => (
            <div key={tx.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {getTransactionIcon(tx.type)}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{tx.description}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-sm text-gray-500">{tx.createdAt}</span>
                    <span className="text-gray-300">•</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      tx.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      tx.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {getStatusLabel(tx.status)}
                    </span>
                  </div>
                </div>
              </div>
              <div className={`text-lg font-bold ${getTransactionColor(tx.type)}`}>
                {tx.type === 'DEPOSIT' || tx.type === 'PAYMENT' || tx.type === 'REFUND' ? '+' : '-'}
                {formatCurrency(tx.amount)}
              </div>
            </div>
          ))}
          
          {wallet.recentTransactions.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Chưa có giao dịch nào phát sinh.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
