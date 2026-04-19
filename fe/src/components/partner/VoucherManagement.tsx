import { useState, useEffect } from 'react';
import { Ticket, Plus, Search, Edit2, Trash2, CalendarDays, CheckCircle2, XCircle, X } from 'lucide-react';
import { createVoucher, updateVoucher, deleteVoucher } from '@/lib/api';

type Voucher = {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  maxDiscount?: number;
  minSpend: number;
  validFrom: string;
  validTo: string;
  validUntil: string;
  isUsed: boolean;
  restaurantId?: number;
  restaurantName?: string;
  usageLimit: number;
  usedCount: number;
};

export default function VoucherManagement() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formCode, setFormCode] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [formValue, setFormValue] = useState('');
  const [formMaxDiscount, setFormMaxDiscount] = useState('');
  const [formMinOrder, setFormMinOrder] = useState('');
  const [formValidFrom, setFormValidFrom] = useState('');
  const [formValidTo, setFormValidTo] = useState('');
  const [formUsageLimit, setFormUsageLimit] = useState('100');

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
      const access = localStorage.getItem('access');
      const res = await fetch(`${API_BASE}/api/promotions/vouchers/`, {
        headers: { 'Authorization': `Bearer ${access}` }
      });
      if (res.ok) {
        const data = await res.json();
        const results = data.results || data;
        const mapped: Voucher[] = results.map((v: any) => ({
          id: v.id.toString(),
          code: v.code,
          title: v.description || v.code,
          description: v.voucher_type === 'PERCENTAGE' ? `Giảm ${v.discount_value}%` : `Giảm ${new Intl.NumberFormat('vi-VN').format(v.discount_value)}đ`,
          discountType: v.voucher_type === 'PERCENTAGE' ? 'PERCENT' : 'FIXED',
          discountValue: Number(v.discount_value),
          maxDiscount: v.max_discount_amount ? Number(v.max_discount_amount) : undefined,
          minSpend: Number(v.min_order_value),
          validFrom: v.valid_from,
          validTo: v.valid_to,
          validUntil: new Date(v.valid_to).toLocaleDateString('vi-VN'),
          isUsed: !v.is_active,
          restaurantId: v.restaurant,
          restaurantName: v.restaurant_name,
          usageLimit: v.usage_limit,
          usedCount: v.used_count || 0,
        }));
        setVouchers(mapped);
      }
    } catch (err) {
      console.error('Lỗi tải voucher:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const openCreateModal = () => {
    setEditingVoucher(null);
    setFormCode(''); setFormDesc(''); setFormType('PERCENTAGE'); setFormValue('');
    setFormMaxDiscount(''); setFormMinOrder(''); setFormValidFrom(''); setFormValidTo('');
    setFormUsageLimit('100');
    setShowModal(true);
  };

  const openEditModal = (v: Voucher) => {
    setEditingVoucher(v);
    setFormCode(v.code);
    setFormDesc(v.title);
    setFormType(v.discountType === 'PERCENT' ? 'PERCENTAGE' : 'FIXED');
    setFormValue(v.discountValue.toString());
    setFormMaxDiscount(v.maxDiscount?.toString() || '');
    setFormMinOrder(v.minSpend.toString());
    setFormValidFrom(v.validFrom ? v.validFrom.substring(0, 16) : '');
    setFormValidTo(v.validTo ? v.validTo.substring(0, 16) : '');
    setFormUsageLimit(v.usageLimit.toString());
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formCode || !formValue || !formValidFrom || !formValidTo) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        code: formCode,
        description: formDesc,
        voucher_type: formType,
        discount_value: Number(formValue),
        valid_from: new Date(formValidFrom).toISOString(),
        valid_to: new Date(formValidTo).toISOString(),
        usage_limit: Number(formUsageLimit) || 100,
      };
      if (formMaxDiscount) payload.max_discount_amount = Number(formMaxDiscount);
      if (formMinOrder) payload.min_order_value = Number(formMinOrder);

      if (editingVoucher) {
        await updateVoucher(Number(editingVoucher.id), payload);
      } else {
        await createVoucher(payload);
      }
      setShowModal(false);
      await fetchVouchers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa voucher này?')) return;
    try {
      await deleteVoucher(Number(id));
      await fetchVouchers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredVouchers = vouchers.filter(v => 
    v.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <Ticket className="w-7 h-7 mr-2 text-amber-600" />
            Quản lý Khuyến mãi
          </h2>
          <p className="text-gray-500 mt-1">Tạo và quản lý các mã giảm giá cho nhà hàng của bạn</p>
        </div>
        <button onClick={openCreateModal} className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center shadow-md shadow-amber-200">
          <Plus className="w-5 h-5 mr-1.5" />
          Tạo Voucher Mới
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên voucher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
          />
        </div>
      </div>

      {/* Vouchers List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium tracking-wide">
                <th className="px-6 py-4">Mã / Tên Khuyến Mãi</th>
                <th className="px-6 py-4">Giảm giá</th>
                <th className="px-6 py-4">Đơn tối thiểu</th>
                <th className="px-6 py-4">Hạn sử dụng</th>
                <th className="px-6 py-4">Sử dụng</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                   <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-2"></div>
                      <p className="text-gray-500">Đang tải danh sách voucher...</p>
                   </td>
                </tr>
              ) : filteredVouchers.map((voucher) => (
                <tr key={voucher.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800 bg-slate-100 px-2.5 py-1 rounded inline-flex w-max mb-1 text-sm border border-slate-200">
                        {voucher.code}
                      </span>
                      <span className="font-medium text-gray-900">{voucher.title}</span>
                      <span className="text-xs text-gray-500 mt-1 line-clamp-1">{voucher.description}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-orange-600">
                    {voucher.discountType === 'PERCENT' 
                      ? `${voucher.discountValue}%` 
                      : formatCurrency(voucher.discountValue)}
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {voucher.minSpend ? formatCurrency(voucher.minSpend) : "Không yêu cầu"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <CalendarDays className="w-4 h-4 mr-1.5 text-slate-400" />
                      {voucher.validUntil}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {voucher.usedCount}/{voucher.usageLimit}
                  </td>
                  <td className="px-6 py-4">
                    {!voucher.isUsed ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Kích hoạt
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                         <XCircle className="w-3.5 h-3.5 mr-1" /> Hết hạn/Đã ẩn
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end space-x-3">
                      <button onClick={() => openEditModal(voucher)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Chỉnh sửa">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(voucher.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filteredVouchers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Không tìm thấy mã khuyến mãi nào. Bấm "Tạo Voucher Mới" để bắt đầu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {editingVoucher ? 'Chỉnh sửa Voucher' : 'Tạo Voucher Mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã voucher *</label>
                <input value={formCode} onChange={e => setFormCode(e.target.value.toUpperCase())}
                  placeholder="VD: GIAM20K" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <input value={formDesc} onChange={e => setFormDesc(e.target.value)}
                  placeholder="VD: Giảm 20k cho đơn từ 200k" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại giảm *</label>
                  <select value={formType} onChange={e => setFormType(e.target.value as any)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none">
                    <option value="PERCENTAGE">Giảm %</option>
                    <option value="FIXED">Giảm cố định (VNĐ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giá trị giảm *</label>
                  <input type="number" value={formValue} onChange={e => setFormValue(e.target.value)}
                    placeholder={formType === 'PERCENTAGE' ? '10' : '20000'}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giảm tối đa (VNĐ)</label>
                  <input type="number" value={formMaxDiscount} onChange={e => setFormMaxDiscount(e.target.value)}
                    placeholder="50000" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đơn tối thiểu (VNĐ)</label>
                  <input type="number" value={formMinOrder} onChange={e => setFormMinOrder(e.target.value)}
                    placeholder="0" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bắt đầu *</label>
                  <input type="datetime-local" value={formValidFrom} onChange={e => setFormValidFrom(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kết thúc *</label>
                  <input type="datetime-local" value={formValidTo} onChange={e => setFormValidTo(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giới hạn sử dụng</label>
                <input type="number" value={formUsageLimit} onChange={e => setFormUsageLimit(e.target.value)}
                  placeholder="100" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-3 border border-slate-200 rounded-xl font-medium text-gray-600 hover:bg-slate-50 transition-colors">
                Hủy
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors">
                {submitting ? 'Đang xử lý...' : editingVoucher ? 'Cập nhật' : 'Tạo Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
