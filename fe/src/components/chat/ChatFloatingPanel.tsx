import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RestaurantCard, DishCard, PrefillBooking } from '../../types/chatbot';
import BookingForm from '../bookings/BookingForm';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

function imgSrc(url: string | null | undefined) {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PanelContent =
    | { type: 'restaurants'; items: RestaurantCard[]; title: string }
    | { type: 'dishes'; items: DishCard[]; title: string }
    | { type: 'booking'; booking: PrefillBooking; title: string };

type Props = {
    content: PanelContent;
    onClose: () => void;
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChatFloatingPanel({ content, onClose }: Props) {
    const navigate = useNavigate();
    // State for direct BookingForm
    const [bookingRestaurant, setBookingRestaurant] = useState<{ id: number; name: string; address: string } | null>(null);
    const [bookingInitials, setBookingInitials] = useState<{ date?: string; guests?: string }>({});

    const handleBookClick = (id: number, name: string, address: string, initialDate?: string, initialGuests?: string) => {
        // Check auth directly
        const access = localStorage.getItem("access");
        if (!access) {
            alert("Vui lòng đăng nhập để tiếp tục Đặt Bàn!");
            navigate("/login");
            return;
        }
        const userStr = localStorage.getItem("user");
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user.role !== "CUSTOMER") {
                    alert("Chỉ khách hàng mới có thể đặt bàn");
                    return;
                }
            } catch {
                // ...
            }
        }
        setBookingInitials({ date: initialDate, guests: initialGuests });
        setBookingRestaurant({ id, name, address });
    };

    return (
        <>
            {/* Backdrop chỉ trên mobile */}
            <div
                className="fixed inset-0 bg-black/40 z-[140] md:hidden"
                onClick={onClose}
            />

            {/* Panel nổi bên trái chat (trên desktop) hoặc bottom sheet (mobile) */}
            <div className="
        fixed z-[150]
        bottom-20 right-[420px]
        md:w-[400px] w-full
        max-h-[600px]
        bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl
        flex flex-col overflow-hidden
        animate-slideInLeft
      ">
                {/* Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-750 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
                    <h3 className="font-semibold text-white text-sm">{content.title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content scrollable */}
                <div className="flex-1 overflow-y-auto">

                    {/* ── Restaurants ─────────────────────────────────────────── */}
                    {content.type === 'restaurants' && (
                        <div className="p-3 space-y-3">
                            {content.items.map((rest) => {
                                const img = imgSrc(rest.image_url);
                                return (
                                    <div
                                        key={rest.id}
                                        className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-600 transition-colors"
                                    >
                                        {/* Ảnh */}
                                        <div className="relative h-36 bg-gray-700 overflow-hidden">
                                            {img ? (
                                                <img src={img} alt={rest.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                            )}
                                            <div className="absolute top-2 right-2 bg-black/60 text-yellow-400 text-xs font-bold px-2 py-0.5 rounded-full">
                                                ⭐ {parseFloat(String(rest.rating)).toFixed(1)}
                                            </div>
                                        </div>

                                        {/* Info */}
                                        <div className="p-3">
                                            <h4 className="font-semibold text-gray-100 text-sm">{rest.name}</h4>
                                            {rest.address && <p className="text-xs text-gray-400 mt-1 line-clamp-1">📍 {rest.address}</p>}
                                            {rest.opening_hours && <p className="text-xs text-gray-500 mt-0.5">🕐 {rest.opening_hours}</p>}
                                            {rest.description && <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{rest.description}</p>}

                                            <div className="flex gap-2 mt-3">
                                                <button
                                                    onClick={() => {
                                                        onClose();
                                                        navigate(`/restaurant/${rest.id}`);
                                                    }}
                                                    className="flex-1 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
                                                >
                                                    Xem chi tiết
                                                </button>
                                                <button
                                                    onClick={() => handleBookClick(rest.id, rest.name, rest.address || "")}
                                                    className="flex-1 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors font-medium"
                                                >
                                                    📅 Đặt bàn ngay
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Dishes ─────────────────────────────────────────────── */}
                    {content.type === 'dishes' && (
                        <div className="p-3 grid grid-cols-2 gap-3">
                            {content.items.map((dish) => {
                                const img = imgSrc(dish.image_url);
                                return (
                                    <div
                                        key={dish.id}
                                        className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 cursor-pointer hover:border-orange-500/50 transition-colors group"
                                        onClick={() => {
                                            onClose();
                                            navigate(`/restaurant/${dish.restaurant.id}`);
                                        }}
                                        title="Nhấn để tới nhà hàng"
                                    >
                                        <div className="h-28 bg-gray-700 relative overflow-hidden flex items-center justify-center">
                                            {img ? (
                                                <img src={img} alt={dish.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                            ) : (
                                                <span className="text-4xl group-hover:scale-110 transition-transform">🍴</span>
                                            )}
                                        </div>
                                        <div className="p-2.5">
                                            <h4 className="font-medium text-gray-100 text-xs leading-tight line-clamp-2">{dish.name}</h4>
                                            <p className="text-orange-400 text-sm font-bold mt-1">
                                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(dish.price)}
                                            </p>
                                            <p className="text-gray-500 text-[10px] mt-0.5 truncate flex items-center gap-1 group-hover:text-amber-400 transition-colors">
                                                🏠 {dish.restaurant?.name}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Booking summary ─────────────────────────────────────── */}
                    {content.type === 'booking' && (() => {
                        const b = content.booking;
                        return (
                            <div className="p-4">
                                <div className="bg-gray-800 rounded-xl p-4 border border-blue-500/40 space-y-3">
                                    <h4 className="text-blue-400 font-semibold text-sm flex items-center gap-2">📅 Thông tin đặt bàn</h4>
                                    {b.restaurant_name && (
                                        <div className="flex gap-3 text-sm">
                                            <span className="text-gray-400 w-24 flex-shrink-0">Nhà hàng</span>
                                            <span className="text-white font-medium">{b.restaurant_name}</span>
                                        </div>
                                    )}
                                    {(b.booking_date || b.booking_date_raw) && (
                                        <div className="flex gap-3 text-sm">
                                            <span className="text-gray-400 w-24 flex-shrink-0">Ngày</span>
                                            <span className="text-white">{b.booking_date || b.booking_date_raw}</span>
                                        </div>
                                    )}
                                    {(b.time_slot_label || b.time_raw) && (
                                        <div className="flex gap-3 text-sm">
                                            <span className="text-gray-400 w-24 flex-shrink-0">Giờ</span>
                                            <span className="text-white">{b.time_slot_label || b.time_raw}</span>
                                        </div>
                                    )}
                                    {b.number_of_guests && (
                                        <div className="flex gap-3 text-sm">
                                            <span className="text-gray-400 w-24 flex-shrink-0">Số người</span>
                                            <span className="text-white">{b.number_of_guests}</span>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => {
                                        const rid = b.restaurant_id;
                                        if (rid) {
                                            handleBookClick(
                                                rid,
                                                b.restaurant_name || "Nhà hàng",
                                                "", // no address
                                                b.booking_date || b.booking_date_raw || "",
                                                b.number_of_guests ? String(b.number_of_guests) : ""
                                            );
                                        }
                                    }}
                                    className="mt-4 w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    Mở khung Đặt Bàn
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </button>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Display Booking Form right here if triggered */}
            {bookingRestaurant && (
                <BookingForm
                    restaurant={bookingRestaurant as any}
                    initialDate={bookingInitials.date || ""}
                    initialGuests={bookingInitials.guests || "2"}
                    onClose={() => setBookingRestaurant(null)}
                    onSuccess={() => {
                        onClose();
                        navigate("/my-bookings");
                    }}
                />
            )}
        </>
    );
}
