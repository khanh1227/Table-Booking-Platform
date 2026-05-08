import { useEffect, useState, type ReactNode } from 'react';
import { Landmark, ReceiptText, Percent, CalendarClock } from 'lucide-react';
import { fetchPlatformRevenueStats, type PlatformRevenueStats } from '@/lib/api';

function formatMoney(value: number | string | null | undefined) {
  const num = Number(value || 0);
  return `${new Intl.NumberFormat('vi-VN').format(num)}đ`;
}

export default function AdminPlatformRevenue() {
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | 'thisMonth'>('30days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<PlatformRevenueStats | null>(null);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPlatformRevenueStats({ time_range: timeRange });
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl px-6 py-4 shadow-sm border border-slate-200 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Thu nhập nền tảng từ tiền cọc</h3>
          <p className="text-xs text-slate-500 mt-1">Phí nền tảng được thu khi mở khóa settlement cho partner</p>
        </div>
        <div className="flex gap-2">
          {[
            { label: '7 ngày', value: '7days' as const },
            { label: '30 ngày', value: '30days' as const },
            { label: 'Tháng này', value: 'thisMonth' as const },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                timeRange === opt.value ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard
              title="Tổng doanh thu nền tảng"
              value={formatMoney(stats?.summary?.total_platform_revenue)}
              icon={<Landmark className="w-5 h-5 text-emerald-600" />}
              bg="bg-emerald-50"
            />
            <StatCard
              title="Số giao dịch thu phí"
              value={String(stats?.summary?.total_fee_transactions || 0)}
              icon={<ReceiptText className="w-5 h-5 text-indigo-600" />}
              bg="bg-indigo-50"
            />
            <StatCard
              title="Phí trung bình / booking"
              value={formatMoney(stats?.summary?.average_fee_per_booking)}
              icon={<CalendarClock className="w-5 h-5 text-amber-600" />}
              bg="bg-amber-50"
            />
            <StatCard
              title="Tỷ lệ phí cấu hình"
              value={`${Math.round(Number(stats?.summary?.platform_fee_rate || 0) * 100)}%`}
              icon={<Percent className="w-5 h-5 text-rose-600" />}
              bg="bg-rose-50"
            />
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h4 className="font-bold text-slate-800 mb-4">Giao dịch thu phí gần đây</h4>
            {!stats?.recent_fees?.length ? (
              <p className="text-sm text-slate-500 text-center py-8">Chưa có giao dịch phí nền tảng</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-3 pr-4">Booking</th>
                      <th className="py-3 pr-4">Nhà hàng</th>
                      <th className="py-3 pr-4">Số tiền phí</th>
                      <th className="py-3 pr-4">Thời gian</th>
                      <th className="py-3">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_fees.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 text-slate-700">
                        <td className="py-3 pr-4 font-semibold">#{item.booking_id ?? 'N/A'}</td>
                        <td className="py-3 pr-4">{item.restaurant_name}</td>
                        <td className="py-3 pr-4 font-bold text-emerald-700">{formatMoney(item.amount)}</td>
                        <td className="py-3 pr-4">{new Date(item.created_at).toLocaleString('vi-VN')}</td>
                        <td className="py-3 text-slate-500">{item.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, bg }: { title: string; value: string; icon: ReactNode; bg: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>{icon}</div>
      </div>
      <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
      <p className="text-sm font-semibold text-slate-600 mt-1">{title}</p>
    </div>
  );
}
