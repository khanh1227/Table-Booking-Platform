// src/components/bookings/StatusBadge.tsx
import React from 'react';
import { Clock, CheckCircle2, XCircle, Ban, CheckCircle, UserX } from 'lucide-react';

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

interface StatusBadgeProps {
  status: BookingStatus;
}

const STATUS_CONFIG: Record<BookingStatus, { label: string, color: string, icon: React.ReactNode }> = {
  PENDING: {
    label: 'Chờ xác nhận',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Clock className="w-3.5 h-3.5" />
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />
  },
  REJECTED: {
    label: 'Đã từ chối',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: <Ban className="w-3.5 h-3.5" />
  },
  CANCELLED: {
    label: 'Đã hủy',
    color: 'bg-slate-50 text-slate-600 border-slate-200',
    icon: <XCircle className="w-3.5 h-3.5" />
  },
  COMPLETED: {
    label: 'Hoàn thành',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <CheckCircle className="w-3.5 h-3.5" />
  },
  NO_SHOW: {
    label: 'Không đến',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: <UserX className="w-3.5 h-3.5" />
  }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  
  return (
    <div className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm whitespace-nowrap ${config.color}`}>
      {config.icon}
      {config.label}
    </div>
  );
};

export default StatusBadge;