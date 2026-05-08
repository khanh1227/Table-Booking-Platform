import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, PieChart, Pie, Cell
} from 'recharts';
import {
  TrendingUp, Users, CalendarCheck, ArrowUpRight, ArrowDownRight,
  Star, AlertTriangle, CheckCircle2, XCircle, Clock, UserX, ExternalLink, UserCheck, Wallet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const INITIAL_REVENUE_DATA = [
  { date: '01/03', revenue: 0 },
  { date: '15/03', revenue: 0 },
  { date: '30/03', revenue: 0 },
];

const STATUS_COLORS: Record<string, string> = {
  'Hoàn thành': '#10b981',
  'Đã hủy': '#f43f5e',
  'No-show': '#f59e0b',
  'Đang xử lý': '#3b82f6',
};

const BOOKING_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: 'Chờ xác nhận', color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  CONFIRMED: { label: 'Đã xác nhận',  color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  COMPLETED: { label: 'Hoàn thành',   color: 'text-emerald-400',bg: 'bg-emerald-500/10' },
  CANCELLED: { label: 'Đã hủy',       color: 'text-rose-400',   bg: 'bg-rose-500/10' },
  NO_SHOW:   { label: 'No-show',      color: 'text-orange-400', bg: 'bg-orange-500/10' },
  REJECTED:  { label: 'Từ chối',      color: 'text-red-400',    bg: 'bg-red-500/10' },
};

const INSIGHT_COLORS: Record<string, { bg: string; text: string }> = {
  orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-600' },
  green:  { bg: 'bg-emerald-100',text: 'text-emerald-600' },
  red:    { bg: 'bg-rose-100',   text: 'text-rose-600' },
};

interface AnalyticsDashboardProps {
  restaurantId?: string | null;
}

export default function AnalyticsDashboard({ restaurantId }: AnalyticsDashboardProps) {
  const navigate = useNavigate();
  const [showCompletedOnly, setShowCompletedOnly] = useState(false);
  const [timeRange, setTimeRange] = useState('30days');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, restaurantId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
      const access = localStorage.getItem('access');
      let url = `${API_BASE}/api/analytics/partner_dashboard/?time_range=${timeRange}`;
      if (restaurantId) url += `&restaurant_id=${restaurantId}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${access}` } });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setCharts(data.charts);
        setInsights(data.insights || []);
        setRecentBookings(data.recent_bookings || []);
      }
    } catch (err) {
      console.error('Lỗi tải thống kê:', err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (val: number) =>
    val >= 1_000_000
      ? `${(val / 1_000_000).toFixed(1)}Tr`
      : new Intl.NumberFormat('vi-VN').format(val);

  const fmtPct = (val?: number) => {
    if (val === undefined || val === null) return '--';
    return `${val > 0 ? '+' : ''}${val}%`;
  };

  const timeRangeLabel = timeRange === '7days' ? '7 ngày qua' : timeRange === 'thisMonth' ? 'tháng này' : timeRange === 'lastMonth' ? 'tháng trước' : '30 ngày qua';

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Thống kê &amp; Báo cáo</h2>
          <p className="text-gray-500 mt-1">Tổng quan hoạt động kinh doanh — <span className="font-semibold text-amber-600">{timeRangeLabel}</span></p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-gray-700 outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="7days">7 ngày qua</option>
          <option value="30days">30 ngày qua</option>
          <option value="thisMonth">Tháng này</option>
          <option value="lastMonth">Tháng trước</option>
        </select>
      </div>

      {/* KPI Grid — Row 1: Primary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 
        <KPICard
          title="Doanh thu thực nhận"
          subtitle="Đã trừ phí nền tảng trong kỳ"
          value={loading ? '...' : `${fmt(summary?.partner_net_revenue || 0)}đ`}
          trend={summary?.revenue_change >= 0 ? 'up' : 'down'}
          pct={fmtPct(summary?.revenue_change)}
          icon={<Wallet className="w-5 h-5 text-green-600" />}
          bg="bg-green-50"
        />
        */}
        <KPICard
          title="Khách TB / Booking"
          subtitle="Quy mô nhóm khách"
          value={loading ? '...' : summary?.avg_guests_per_booking !== undefined ? `${summary.avg_guests_per_booking} khách` : '--'}
          trend={summary?.avg_guests_change >= 0 ? 'up' : 'down'}
          pct={fmtPct(summary?.avg_guests_change)}
          icon={<UserCheck className="w-5 h-5 text-indigo-600" />}
          bg="bg-indigo-50"
        />
        <KPICard
          title="Tổng đặt bàn"
          value={loading ? '...' : (summary?.total_bookings || 0).toString()}
          trend={summary?.bookings_change >= 0 ? 'up' : 'down'}
          pct={fmtPct(summary?.bookings_change)}
          icon={<CalendarCheck className="w-5 h-5 text-blue-600" />}
          bg="bg-blue-50"
        />
        <KPICard
          title="Thực khách phục vụ"
          subtitle="Chỉ tính booking hoàn thành"
          value={loading ? '...' : (summary?.total_guests || 0).toString()}
          trend={summary?.guests_change >= 0 ? 'up' : 'down'}
          pct={fmtPct(summary?.guests_change)}
          icon={<Users className="w-5 h-5 text-emerald-600" />}
          bg="bg-emerald-50"
        />
        <KPICard
          title="Đánh giá TB"
          subtitle={`${summary?.total_reviews || 0} nhận xét · ${summary?.five_star_ratio || 0}% 5 sao`}
          value={loading ? '...' : `${summary?.avg_rating || 0}/5`}
          icon={<Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
          bg="bg-yellow-50"
        />
      </div>

      {/* KPI Grid — Row 2: Secondary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MiniStat label="Chờ xác nhận" value={summary?.pending_bookings ?? '--'} icon={<Clock className="w-4 h-4 text-amber-500" />} color="text-amber-600" />
        <MiniStat label="Tỉ lệ hoàn thành" value={summary?.conversion_rate !== undefined ? `${summary.conversion_rate}%` : '--'} icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} color="text-emerald-600" />
        <MiniStat label="Đã hủy" value={summary?.cancelled_bookings ?? '--'} icon={<XCircle className="w-4 h-4 text-rose-500" />} color="text-rose-600" />
        <MiniStat label="No-show" value={summary?.no_show_bookings ?? '--'} icon={<UserX className="w-4 h-4 text-orange-500" />} color="text-orange-600" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart — 2/3 */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              Lượt đặt & Khách theo ngày
            </h3>
            <div className="flex items-center bg-slate-50 border border-slate-100 p-1 rounded-lg self-start sm:self-auto">
              <button
                onClick={() => setShowCompletedOnly(false)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${!showCompletedOnly ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setShowCompletedOnly(true)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${showCompletedOnly ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Chỉ Hoàn thành
              </button>
            </div>
          </div>
          <div className="h-[260px] flex-1">
            <ResponsiveContainer width="99%" height="100%">
              <ComposedChart data={charts?.activity || []} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  labelStyle={{ color: '#1e293b', fontWeight: 'bold', marginBottom: 4 }}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0/0.1)' }}
                />
                <Bar yAxisId="left" dataKey={showCompletedOnly ? "completed_bookings" : "bookings"} fill={showCompletedOnly ? "#10b981" : "#f59e0b"} radius={[4, 4, 0, 0]} name="Lượt đặt" opacity={0.85} />
                <Line yAxisId="right" type="monotone" dataKey={showCompletedOnly ? "completed_guests" : "guests"} stroke={showCompletedOnly ? "#059669" : "#3b82f6"} strokeWidth={2.5} dot={false} name="Lượng khách" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-6 mt-4 justify-center">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span className={`w-3 h-3 rounded-sm ${showCompletedOnly ? 'bg-emerald-500' : 'bg-amber-500'} inline-block`} />Lượt đặt</div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span className={`w-4 h-0.5 ${showCompletedOnly ? 'bg-emerald-700' : 'bg-blue-500'} inline-block`} />Lượng khách</div>
          </div>
        </div>

        {/* Booking Status PieChart — 1/3 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Phân bố trạng thái</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="99%" height={200}>
              <PieChart>
                <Pie
                  data={(charts?.booking_status || []).filter((d: any) => d.value > 0)}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={80}
                  paddingAngle={3} dataKey="value"
                >
                  {(charts?.booking_status || []).filter((d: any) => d.value > 0).map((entry: any, idx: number) => (
                    <Cell key={idx} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => [val, name]}
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {(charts?.booking_status || []).map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[item.name] || '#94a3b8' }} />
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-bold text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Occupancy + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Occupancy Bar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-800">Tỉ lệ lấp đầy theo khung giờ</h3>
            <p className="text-sm text-gray-500 mt-1">Trung bình — {timeRangeLabel}</p>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="99%" height={260}>
              <BarChart data={charts?.occupancy || []} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={8} />
                <YAxis tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  formatter={(val: any) => [`${val}%`, 'Lấp đầy']}
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }}
                />
                <Bar dataKey="rate" name="Tỉ lệ" radius={[4, 4, 0, 0]}>
                  {(charts?.occupancy || []).map((entry: any, idx: number) => (
                    <Cell key={idx} fill={entry.rate > 80 ? '#ef4444' : entry.rate > 50 ? '#f59e0b' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(charts?.occupancy || []).length === 0 && !loading && (
            <p className="text-center text-gray-400 text-sm py-4">Chưa có dữ liệu khung giờ</p>
          )}
        </div>

        {/* Insights */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-lg font-bold text-gray-800">Phân tích chuyên sâu</h3>
            <p className="text-sm text-gray-500 mt-1">Đề xuất dựa trên dữ liệu thực tế</p>
          </div>
          <div className="flex-1 bg-slate-50/50 divide-y divide-slate-100">
            {insights.map((insight: any, idx: number) => {
              const color = INSIGHT_COLORS[insight.color] || INSIGHT_COLORS.blue;
              return (
                <div key={idx} className="p-4 flex gap-4 hover:bg-white transition-colors">
                  <div className={`w-9 h-9 rounded-full ${color.bg} flex items-center justify-center shrink-0`}>
                    <span className={`${color.text} font-bold text-sm`}>{idx + 1}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm">{insight.title}</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{insight.description}</p>
                  </div>
                </div>
              );
            })}
            {insights.length === 0 && !loading && (
              <div className="p-5 text-center text-gray-400 text-sm">
                Chưa có dữ liệu để phân tích. Hãy tiếp tục kinh doanh!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Bookings Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Booking gần nhất</h3>
            <p className="text-sm text-gray-500 mt-1">8 đặt bàn mới nhất trong hệ thống của bạn</p>
          </div>
          <button
            onClick={() => navigate('/partner?section=bookings')}
            className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 hover:text-amber-700 transition"
          >
            Xem tất cả <ExternalLink className="w-4 h-4" />
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Đang tải...</div>
        ) : recentBookings.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Chưa có đặt bàn nào</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">#ID</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Khách</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Nhà hàng</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Ngày</th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Khách</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentBookings.map((b: any) => {
                  const st = BOOKING_STATUS_MAP[b.status] || { label: b.status, color: 'text-gray-400', bg: 'bg-gray-100' };
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3 font-mono text-gray-400 text-xs">#{b.id}</td>
                      <td className="px-5 py-3 font-semibold text-gray-800">{b.customer_name}</td>
                      <td className="px-5 py-3 text-gray-600 truncate max-w-[160px]">{b.restaurant_name}</td>
                      <td className="px-5 py-3 text-gray-600">{b.booking_date}</td>
                      <td className="px-5 py-3 text-center font-semibold text-gray-700">{b.number_of_guests}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${st.bg} ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function KPICard({ title, subtitle, value, trend, pct, icon, bg }: any) {
  const isUp = trend === 'up';
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      {/* 
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-xl ${bg}`}>{icon}</div>
        {pct && (
          <div className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${isUp ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
            {isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
            {pct}
          </div>
        )}
      </div>
      */}
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-xl ${bg}`}>{icon}</div>
      </div>
      <p className="text-slate-500 text-xs font-medium">{title}</p>
      {subtitle && <p className="text-slate-400 text-[10px] mt-0.5">{subtitle}</p>}
      <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
    </div>
  );
}

function MiniStat({ label, value, icon, color }: any) {
  return (
    <div className="bg-white px-4 py-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 font-medium truncate">{label}</p>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}
