import { useState, useEffect } from 'react';
import {
  Users, Building2, TrendingUp, Activity,
  CalendarCheck, XCircle, MapPin, UtensilsCrossed, Award, UserCheck
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

const STATUS_COLORS: Record<string, string> = {
  'Hoàn thành':   '#10b981',
  'Đã hủy':       '#f43f5e',
  'Chờ xác nhận': '#f59e0b',
  'Đã xác nhận':  '#3b82f6',
};

const SIZE_COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#10b981'];

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30days');

  useEffect(() => { fetchData(); }, [timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/analytics/admin_dashboard/?time_range=${timeRange}`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` } }
      );
      if (!res.ok) throw new Error('Failed to fetch admin stats');
      setData(await res.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { summary, charts, rankings, recent_partners } = data || {};

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-slate-200 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-600">Xem theo kỳ:</p>
        <div className="flex gap-2">
          {[
            { label: '7 ngày', value: '7days' },
            { label: '30 ngày', value: '30days' },
            { label: 'Tháng này', value: 'thisMonth' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                timeRange === opt.value
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1 — Platform KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Người dùng"
          value={summary?.total_users}
          subtitle={`+${summary?.new_users || 0} người mới`}
          icon={<Users className="w-6 h-6 text-indigo-500" />}
          bg="bg-indigo-50"
        />
        <StatCard
          title="Nhà hàng"
          value={summary?.total_restaurants}
          subtitle={`${summary?.pending_restaurants || 0} chờ duyệt`}
          icon={<Building2 className="w-6 h-6 text-amber-500" />}
          bg="bg-amber-50"
        />
        <StatCard
          title="Đối tác"
          value={summary?.total_partners}
          subtitle="đang hợp tác"
          icon={<Award className="w-6 h-6 text-violet-500" />}
          bg="bg-violet-50"
        />
        <StatCard
          title="Khách hàng"
          value={summary?.total_customers}
          subtitle="đã đăng ký"
          icon={<UserCheck className="w-6 h-6 text-sky-500" />}
          bg="bg-sky-50"
        />
      </div>

      {/* Row 2 — Booking KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Tổng lượt đặt (All)"
          value={summary?.total_bookings_alltime}
          subtitle={`${summary?.new_bookings_period || 0} đơn mới trong kỳ`}
          icon={<Activity className="w-6 h-6 text-emerald-500" />}
          bg="bg-emerald-50"
        />
        <StatCard
          title="Đơn thành công (kỳ)"
          value={summary?.completed_bookings_period}
          subtitle={`${summary?.cancelled_bookings_period || 0} đơn đã hủy`}
          icon={<CalendarCheck className="w-6 h-6 text-green-500" />}
          bg="bg-green-50"
          valueColor="text-green-700"
        />
        <StatCard
          title="Lượng khách (kỳ)"
          value={summary?.total_guests_period}
          subtitle="khách từ đơn hoàn thành"
          icon={<Users className="w-6 h-6 text-teal-500" />}
          bg="bg-teal-50"
          valueColor="text-teal-700"
        />
        <StatCard
          title="Tổng khách (All)"
          value={summary?.total_guests_alltime}
          subtitle="toàn lịch sử"
          icon={<XCircle className="w-6 h-6 text-rose-500" />}
          bg="bg-rose-50"
        />
      </div>

      {/* Activity Chart + Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-rose-500" />
            Lượt đặt & Khách theo ngày
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={charts?.activity}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} dy={10} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} dx={-10} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} dx={10} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar yAxisId="left" dataKey="bookings" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Lượt đặt" opacity={0.85} />
                <Line yAxisId="right" type="monotone" dataKey="guests" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Lượng khách" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-6 mt-3 justify-center">
            <div className="flex items-center gap-2 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" />Lượt đặt</div>
            <div className="flex items-center gap-2 text-xs text-slate-500"><span className="w-4 h-0.5 bg-blue-500 inline-block" />Lượng khách</div>
          </div>
        </div>

        {/* Booking Status Donut */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <h3 className="font-bold text-slate-800 text-lg mb-2">Trạng thái đặt bàn</h3>
          <p className="text-xs text-slate-400 mb-2">Trong kỳ đã chọn</p>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={charts?.booking_status?.filter((d: any) => d.value > 0)}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={78}
                  paddingAngle={3} dataKey="value"
                >
                  {(charts?.booking_status || []).map((entry: any, idx: number) => (
                    <Cell key={idx} fill={STATUS_COLORS[entry.name] || '#94A3B8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => [`${value} đơn`, '']} contentStyle={{ borderRadius: '10px', border: 'none' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Rankings: Locations + Restaurants + Cuisines */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RankingTable
          title="Địa điểm nhiều lượt đặt"
          icon={<MapPin className="w-4 h-4 text-sky-500" />}
          data={rankings?.top_locations} unit="đơn" barColor="bg-sky-500"
        />
        <RankingTable
          title="Nhà hàng nhiều lượt đặt"
          icon={<Building2 className="w-4 h-4 text-amber-500" />}
          data={rankings?.top_restaurants} unit="đơn" barColor="bg-amber-500"
        />
        <RankingTable
          title="Loại ẩm thực phổ biến"
          icon={<UtensilsCrossed className="w-4 h-4 text-emerald-500" />}
          data={rankings?.top_cuisines} unit="đơn" barColor="bg-emerald-500"
        />
      </div>

      {/* Guest Group Size Distribution */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 text-lg mb-1 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          Quy mô nhóm khách
        </h3>
        <p className="text-xs text-slate-400 mb-6">Người đặt thường đi theo nhóm bao nhiêu người</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankings?.guest_size_dist} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} dx={-8} />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={(value: any) => [`${value} đơn`, 'Số lượng']}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Số đơn">
                {(rankings?.guest_size_dist || []).map((_: any, idx: number) => (
                  <Cell key={idx} fill={SIZE_COLORS[idx % SIZE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Legend below */}
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {(rankings?.guest_size_dist || []).map((item: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: SIZE_COLORS[idx % SIZE_COLORS.length] }} />
              <span className="font-semibold">{item.name}</span>
              <span className="text-slate-400">({item.value} đơn)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Partners */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 text-lg mb-4">Đối tác mới đăng ký</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recent_partners?.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="font-bold text-slate-800 text-sm">{p.business_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{p.joined}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase ${
                p.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                p.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                'bg-rose-100 text-rose-700'
              }`}>
                {p.status}
              </span>
            </div>
          ))}
          {(!recent_partners || recent_partners.length === 0) && (
            <p className="text-sm text-slate-500 py-4 col-span-3 text-center">Chưa có đối tác mới</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Helper Components ---- */

function StatCard({ title, value, subtitle, icon, bg, valueColor = 'text-slate-800' }: any) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bg}`}>{icon}</div>
        <p className={`text-2xl font-black tracking-tight ${valueColor}`}>{value ?? '—'}</p>
      </div>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      <p className="text-xs font-medium text-slate-400 mt-0.5">{subtitle}</p>
    </div>
  );
}

function RankingTable({ title, icon, data = [], unit, barColor }: any) {
  const max = Math.max(...data.map((d: any) => d.value), 1);
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-4">{icon}{title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">Chưa có dữ liệu</p>
      ) : (
        <div className="space-y-3">
          {data.map((item: any, idx: number) => (
            <div key={idx}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700 truncate max-w-[70%]">
                  <span className="text-slate-400 mr-1.5">#{idx + 1}</span>{item.name}
                </span>
                <span className="font-bold text-slate-600 shrink-0">{item.value} {unit}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${(item.value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
