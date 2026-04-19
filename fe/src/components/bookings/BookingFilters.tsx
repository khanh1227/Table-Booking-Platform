// src/components/bookings/BookingFilters.tsx
import React, { useState } from 'react';
import { Filter, Calendar, ListFilter, X } from 'lucide-react';

interface FilterParams {
  status?: string;
  start_date?: string;
  end_date?: string;
}

interface BookingFiltersProps {
  onFilterChange: (filters: FilterParams) => void;
}

export const BookingFilters: React.FC<BookingFiltersProps> = ({ onFilterChange }) => {
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleApply = () => {
    onFilterChange({
      status: status || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined
    });
  };

  const handleReset = () => {
    setStatus('');
    setStartDate('');
    setEndDate('');
    onFilterChange({});
  };

  const hasFilters = status || startDate || endDate;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-8">
      <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold uppercase tracking-wider text-xs">
        <Filter className="w-4 h-4 text-blue-600" />
        Bộ lọc tìm kiếm
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative group">
          <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1 uppercase tracking-tight">
            Trạng thái
          </label>
          <div className="relative">
            <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">Chờ xác nhận</option>
              <option value="CONFIRMED">Đã xác nhận</option>
              <option value="CANCELLED">Đã hủy</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="REJECTED">Đã từ chối</option>
              <option value="NO_SHOW">Không đến</option>
            </select>
          </div>
        </div>

        <div className="relative group">
          <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1 uppercase tracking-tight">
            Từ ngày
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer"
            />
          </div>
        </div>

        <div className="relative group">
          <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1 uppercase tracking-tight">
            Đến ngày
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all font-bold text-sm"
          >
            Lọc kết quả
          </button>
          
          {hasFilters && (
            <button
              onClick={handleReset}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all font-bold text-sm flex items-center justify-center gap-1"
              title="Xóa lọc"
            >
              <X className="w-4 h-4" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingFilters;