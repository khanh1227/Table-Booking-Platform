// components/partner/TimeSlotManagement.tsx
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertCircle, Clock } from 'lucide-react';
import { fetchTimeSlots, deleteTimeSlot, fetchTimeSlotOverrides, addTimeSlotOverride, deleteTimeSlotOverride, updateTimeSlotOverride } from '@/lib/api';
import TimeSlotForm from './TimeSlotForm';

interface TimeSlotManagementProps {
  restaurantId: string;
}

export default function TimeSlotManagement({ restaurantId }: TimeSlotManagementProps) {
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'SLOTS' | 'SPECIAL'>('SLOTS');

  // Bulk Create
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkData, setBulkData] = useState({
    start_time: '10:00',
    end_time: '22:00',
    interval: 60,
    max_bookings: 5,
    max_guests_per_booking: 20
  });

  // Overrides (Special Dates)
  const [overrides, setOverrides] = useState<any[]>([]);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [editingOverrideId, setEditingOverrideId] = useState<number | null>(null);
  const [newOverride, setNewOverride] = useState({ 
    date: '', 
    time_slot: '' as any, 
    max_bookings: '' as any, 
    is_closed: false,
    reason: '' 
  });

  useEffect(() => {
    loadSlots();
  }, [restaurantId]);

  const loadSlots = async () => {
    try {
      setLoading(true);
      const [slotsData, overridesData] = await Promise.all([
        fetchTimeSlots(restaurantId),
        fetchTimeSlotOverrides(Number(restaurantId))
      ]);
      
      const sorted = slotsData.sort((a: any, b: any) =>
        a.start_time.localeCompare(b.start_time)
      );
      setSlots(sorted);
      setOverrides(overridesData);
    } catch (err: any) {
      setError(err.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCreate = async () => {
    try {
      setLoading(true);
      await import('@/lib/api').then(m => m.bulkCreateTimeSlots({
        restaurant_id: Number(restaurantId),
        ...bulkData
      }));
      setShowBulkModal(false);
      loadSlots();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOverride = async () => {
    if (!newOverride.date) return;
    try {
      const payload = {
        restaurant: Number(restaurantId),
        date: newOverride.date,
        time_slot: newOverride.time_slot ? Number(newOverride.time_slot) : null,
        max_bookings: newOverride.max_bookings ? Number(newOverride.max_bookings) : null,
        is_closed: newOverride.is_closed,
        reason: newOverride.reason
      };

      if (editingOverrideId) {
        await updateTimeSlotOverride(editingOverrideId, payload);
      } else {
        await addTimeSlotOverride(payload);
      }

      setNewOverride({ date: '', time_slot: '', max_bookings: '', is_closed: false, reason: '' });
      setEditingOverrideId(null);
      setShowOverrideForm(false);
      loadSlots();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteOverride = async (id: number) => {
    if (!confirm("Xóa điều chỉnh này?")) return;
    try {
      await deleteTimeSlotOverride(id);
      loadSlots();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn chắc chắn muốn xóa khung giờ này?")) return;

    try {
      await deleteTimeSlot(id);
      setSlots(slots.filter((s) => s.id !== Number(id)));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingId(null);
    loadSlots();
  };

  if (showForm) {
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-300">
        <TimeSlotForm
          restaurantId={restaurantId}
          slotId={editingId || undefined}
          onSuccess={handleFormSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      {/* TABS */}
      <div className="flex border-b border-slate-700 mb-6">
        <button
          onClick={() => setActiveTab('SLOTS')}
          className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
            activeTab === 'SLOTS' 
              ? 'border-orange-500 text-orange-500' 
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          KHUNG GIỜ LẶP LẠI
        </button>
        <button
          onClick={() => setActiveTab('SPECIAL')}
          className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
            activeTab === 'SPECIAL' 
              ? 'border-orange-500 text-orange-500' 
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          NGÀY ĐẶC BIỆT / NGHỈ LỄ
        </button>
      </div>

      {activeTab === 'SLOTS' && (
        <>
          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Thiết lập khung giờ hằng ngày
            </h2>

            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-semibold rounded-lg transition"
              >
                Tạo nhanh hàng loạt
              </button>
              <button
                onClick={() => {
                  setEditingId(null);
                  setShowForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition"
              >
                <Plus className="w-5 h-5" />
                Thêm khung giờ
              </button>
            </div>
          </div>
        </>
      )}

      {activeTab === 'SPECIAL' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              Điều chỉnh sức chứa / Ngày đặc biệt
            </h2>

            <button
              onClick={() => {
                setEditingOverrideId(null);
                setNewOverride({ date: '', time_slot: '', max_bookings: '', is_closed: false, reason: '' });
                setShowOverrideForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-lg border border-red-500/30 transition"
            >
              <Plus className="w-5 h-5" />
              Thêm điều chỉnh
            </button>
          </div>
        </>
      )}

      {/* ERROR */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg mb-6 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'SLOTS' ? (
        loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
              Đang tải...
            </div>
          </div>
        ) : slots.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-12 text-center">
            <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-4">Chưa có khung giờ nào</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition"
            >
              <Plus className="w-5 h-5" />
              Thêm ngay
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map((slot) => (
              <div key={slot.id} className="flex items-center justify-between bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition group">
                 {/* Slot content same as before but inside the tab */}
                 <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${slot.is_active ? 'bg-green-500/20' : 'bg-slate-700/50'}`}>
                    <Clock className={`w-5 h-5 ${slot.is_active ? 'text-green-400' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-lg">{slot.start_time.slice(0, 5)}</p>
                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                      <p className="text-slate-400 text-sm">Tối đa <span className="text-orange-400 font-medium">{slot.max_bookings}</span> lượt đặt</p>
                      <p className="text-slate-400 text-sm">Tối đa <span className="text-blue-400 font-medium">{slot.max_guests_per_booking}</span> khách/đơn</p>
                      <span className={`text-xs px-2 py-1 rounded ${slot.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {slot.is_active ? 'Đang hoạt động' : 'Ngừng'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingId(String(slot.id)); setShowForm(true); }} className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(String(slot.id))} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* OVERRIDES LIST */
        <div className="space-y-4">
          {overrides.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-12 text-center text-slate-400">
              Chưa có điều chỉnh đặc biệt nào. Nhà hàng hoạt động theo cấu hình mặc định.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {overrides.map(ov => (
                <div key={ov.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex justify-between items-center group hover:border-red-500/30 transition">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${ov.is_closed ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                       {ov.is_closed ? <Trash2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-white font-bold">
                        Ngày {new Date(ov.date).toLocaleDateString('vi-VN')} 
                        <span className="text-slate-500 mx-2">|</span>
                        <span className="text-orange-400">{ov.time_slot_display || 'Cả ngày'}</span>
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                         <span className={`text-xs px-2 py-0.5 rounded ${ov.is_closed ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                           {ov.is_closed ? 'Đóng cửa' : 'Đang mở'}
                         </span>
                         {ov.max_bookings && (
                           <span className="text-xs text-slate-400">Sức chứa: <b className="text-white">{ov.max_bookings}</b> đơn</span>
                         )}
                         {ov.reason && <span className="text-xs text-slate-500 italic">"{ov.reason}"</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setEditingOverrideId(ov.id);
                        setNewOverride({
                          date: ov.date,
                          time_slot: ov.time_slot || '',
                          max_bookings: ov.max_bookings || '',
                          is_closed: ov.is_closed,
                          reason: ov.reason || ''
                        });
                        setShowOverrideForm(true);
                      }}
                      className="p-2 text-slate-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDeleteOverride(ov.id)} className="p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BULK CREATE MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-4">Tạo khung giờ hàng loạt</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Giờ bắt đầu</label>
                <input type="time" value={bulkData.start_time} onChange={e => setBulkData({...bulkData, start_time: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Giờ kết thúc</label>
                <input type="time" value={bulkData.end_time} onChange={e => setBulkData({...bulkData, end_time: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Khoảng cách (phút)</label>
                <select value={bulkData.interval} onChange={e => setBulkData({...bulkData, interval: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white">
                  <option value={15}>15 phút</option>
                  <option value={30}>30 phút</option>
                  <option value={60}>60 phút (1h)</option>
                  <option value={120}>120 phút (2h)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Lượt đặt tối đa/slot</label>
                <input type="number" value={bulkData.max_bookings} onChange={e => setBulkData({...bulkData, max_bookings: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowBulkModal(false)} className="flex-1 py-2 text-slate-300 hover:bg-slate-700 rounded-lg">Hủy</button>
              <button onClick={handleBulkCreate} className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg">Tạo ngay</button>
            </div>
          </div>
        </div>
      )}

      {/* OVERRIDE MODAL */}
      {showOverrideForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingOverrideId ? 'Chỉnh sửa điều chỉnh' : 'Thêm điều chỉnh đặc biệt'}
            </h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Chọn ngày</label>
                <input type="date" value={newOverride.date} onChange={e => setNewOverride({...newOverride, date: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Khung giờ (Để trống nếu áp dụng cả ngày)</label>
                <select 
                  value={newOverride.time_slot} 
                  onChange={e => setNewOverride({...newOverride, time_slot: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white"
                >
                  <option value="">Tất cả khung giờ</option>
                  {slots.map(s => (
                    <option key={s.id} value={s.id}>{s.start_time.slice(0, 5)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Sức chứa mới</label>
                  <input 
                    type="number" 
                    placeholder="VD: 20" 
                    disabled={newOverride.is_closed}
                    value={newOverride.max_bookings} 
                    onChange={e => setNewOverride({...newOverride, max_bookings: e.target.value})} 
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white disabled:opacity-50" 
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer py-2">
                    <input 
                      type="checkbox" 
                      checked={newOverride.is_closed} 
                      onChange={e => setNewOverride({...newOverride, is_closed: e.target.checked})} 
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-red-500"
                    />
                    <span className="text-sm text-red-400 font-bold">Đóng cửa</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Lý do (VD: Valentine, Nghỉ Tết...)</label>
                <input type="text" value={newOverride.reason} onChange={e => setNewOverride({...newOverride, reason: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowOverrideForm(false)} className="flex-1 py-2 text-slate-300 hover:bg-slate-700 rounded-lg">Hủy</button>
              <button onClick={handleAddOverride} className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg">Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {slots.length > 0 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <p className="text-slate-400">
            Tổng cộng <span className="text-orange-500 font-semibold">{slots.length}</span> khung giờ
          </p>
          <p className="text-slate-400">
            <span className="text-green-400 font-semibold">{slots.filter(s => s.is_active).length}</span> đang hoạt động
          </p>
        </div>
      )}
    </div>
  );
}