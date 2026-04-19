import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, Line, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, Users, CalendarCheck, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const INITIAL_REVENUE_DATA = [
  { date: '01/03', revenue: 0 },
  { date: '15/03', revenue: 0 },
  { date: '30/03', revenue: 0 },
];

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#f43f5e'];

const INSIGHT_COLORS: Record<string, { bg: string; text: string }> = {
  orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
  green: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  red: { bg: 'bg-rose-100', text: 'text-rose-600' },
};

interface AnalyticsDashboardProps {
  restaurantId?: string | null;
}

export default function AnalyticsDashboard({ restaurantId }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState('30days');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, restaurantId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
      const access = localStorage.getItem('access');
      let url = `${API_BASE}/api/analytics/partner_dashboard/?time_range=${timeRange}`;
      if (restaurantId) {
        url += `&restaurant_id=${restaurantId}`;
      }
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${access}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setCharts(data.charts);
        setInsights(data.insights || []);
      }
    } catch (err) {
      console.error('Lỗi tải thống kê:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)} Tr`;
    }
    return new Intl.NumberFormat('vi-VN').format(value);
  };

  const formatPercentage = (val: number | undefined) => {
    if (val === undefined || val === null) return '--';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val}%`;
  };

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Thống kê & Báo cáo</h2>
          <p className="text-gray-500 mt-1">Tổng quan hoạt động kinh doanh của nhà hàng</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-gray-700 outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="7days">7 ngày qua</option>
            <option value="30days">30 ngày qua</option>
            <option value="thisMonth">Tháng này</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Doanh Thu Dự Kiến" 
          value={loading ? "..." : new Intl.NumberFormat('vi-VN').format(summary?.estimated_revenue || 0) + 'đ'} 
          trend={summary?.revenue_change >= 0 ? 'up' : 'down'} 
          percentage={formatPercentage(summary?.revenue_change)} 
          icon={<TrendingUp className="w-6 h-6 text-amber-600" />} 
          colorClass="bg-amber-50" 
        />
        <KPICard 
          title="Tổng lượt Đặt Bàn" 
          value={loading ? "..." : (summary?.total_bookings || 0).toString()} 
          trend={summary?.bookings_change >= 0 ? 'up' : 'down'} 
          percentage={formatPercentage(summary?.bookings_change)} 
          icon={<CalendarCheck className="w-6 h-6 text-blue-600" />} 
          colorClass="bg-blue-50" 
        />
        <KPICard 
          title="Thực khách phục vụ" 
          value={loading ? "..." : (summary?.total_guests || 0).toString()} 
          trend={summary?.guests_change >= 0 ? 'up' : 'down'} 
          percentage={formatPercentage(summary?.guests_change)} 
          icon={<Users className="w-6 h-6 text-emerald-600" />} 
          colorClass="bg-emerald-50" 
        />
        <KPICard 
          title="Lượt đã hủy" 
          value={loading ? "..." : (summary?.cancelled_bookings || 0).toString()} 
          trend={summary?.cancelled_change > 0 ? 'down' : 'up'} 
          percentage={formatPercentage(summary?.cancelled_change)} 
          icon={<Clock className="w-6 h-6 text-rose-600" />} 
          colorClass="bg-rose-50" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart - Revenue (Takes up 2 cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800">Biểu đồ Doanh Thu</h3>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="99%" height={320}>
              <AreaChart data={charts?.revenue || INITIAL_REVENUE_DATA} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  formatter={(value: any) => [`${new Intl.NumberFormat('vi-VN').format(value)}đ`, '']}
                  labelStyle={{color: '#1e293b', fontWeight: 'bold', marginBottom: '8px'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                <Area type="monotone" name="Doanh thu kỳ này" dataKey="revenue" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                <Line type="monotone" name="Kỳ trước" dataKey="lastWeek" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Source Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Nguồn Đặt Bàn</h3>
          <div className="h-[256px] w-full">
            <ResponsiveContainer width="99%" height={256}>
              <PieChart>
                <Pie
                  data={charts?.source || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {(charts?.source || []).map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`${value}%`, 'Tỷ trọng']}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Custom Legend for Pie */}
          <div className="mt-2 space-y-2">
            {(charts?.source || []).map((item: any, index: number) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: COLORS[index % COLORS.length]}}></span>
                  <span className="text-gray-600 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-gray-800">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Occupancy Rate Bar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Tỉ lệ lấp đầy theo khung giờ</h3>
              <p className="text-sm text-gray-500 mt-1">Trung bình trong {timeRange === '7days' ? '7 ngày qua' : timeRange === 'thisMonth' ? 'tháng này' : '30 ngày qua'}</p>
            </div>
          </div>
          <div className="h-[288px] w-full">
            <ResponsiveContainer width="99%" height={288}>
              <BarChart data={charts?.occupancy || []} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis tickFormatter={(val) => `${val}%`} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  formatter={(value: any) => [`${value}%`, 'Lấp đầy']}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="rate" name="Tỉ lệ" radius={[4, 4, 0, 0]}>
                  {
                    (charts?.occupancy || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.rate > 80 ? '#ef4444' : entry.rate > 50 ? '#f59e0b' : '#3b82f6'} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dynamic Insights from API */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100">
             <h3 className="text-lg font-bold text-gray-800">Phân tích chuyên sâu</h3>
             <p className="text-sm text-gray-500 mt-1">Đề xuất dựa trên dữ liệu thực tế</p>
          </div>
          <div className="p-0 flex-1 bg-slate-50/50">
             <div className="divide-y divide-slate-100">
               {insights.map((insight: any, index: number) => {
                 const color = INSIGHT_COLORS[insight.color] || INSIGHT_COLORS.blue;
                 return (
                   <div key={index} className="p-5 flex gap-4 hover:bg-white transition-colors">
                     <div className={`w-10 h-10 rounded-full ${color.bg} flex items-center justify-center shrink-0`}>
                       <span className={`${color.text} font-bold`}>{index + 1}</span>
                     </div>
                     <div>
                       <h4 className="font-semibold text-gray-800">{insight.title}</h4>
                       <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                     </div>
                   </div>
                 );
               })}
               {insights.length === 0 && !loading && (
                 <div className="p-5 text-center text-gray-500">
                   Chưa có dữ liệu để phân tích. Hãy tiếp tục kinh doanh!
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Component
function KPICard({ title, value, trend, percentage, icon, colorClass }: any) {
  const isUp = trend === 'up';
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${colorClass}`}>
          {icon}
        </div>
        <div className={`flex items-center text-sm font-semibold px-2 py-1 rounded-full ${
          isUp ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
        }`}>
          {isUp ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
          {percentage}
        </div>
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
      </div>
    </div>
  );
}
