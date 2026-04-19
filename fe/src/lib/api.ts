// src/lib/api.ts
const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export type ApiResult = { error?: string };

// ======================== AUTH HELPERS ========================
export function clearAuth() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("user");
  // Optional: redirect to login or reload
  if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
     window.location.href = '/login';
  }
}

async function refreshToken(): Promise<string | null> {
  const refresh = localStorage.getItem("refresh");
  if (!refresh) return null;

  try {
    const res = await fetch(`${BASE}/api/accounts/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("access", data.access);
      return data.access;
    }
  } catch (error) {
    console.error("Token refresh failed:", error);
  }

  clearAuth();
  return null;
}

function getAuthHeaders(extra?: HeadersInit): HeadersInit {
  const access = localStorage.getItem("access");
  return {
    "Content-Type": "application/json",
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
    ...(extra || {}),
  };
}

function getAuthHeadersMultipart(): HeadersInit {
  const access = localStorage.getItem("access");
  return {
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
  };
}

/**
 * Centralized fetch with auto-refresh and 401 handling
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // 1. Initial attempt
  let res = await fetch(url, options);

  // 2. If 401, try to refresh
  if (res.status === 401) {
    const newAccess = await refreshToken();
    if (newAccess) {
      // Retry with new token
      const headers = { ...options.headers } as any;
      headers["Authorization"] = `Bearer ${newAccess}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  return res;
}

export async function onLogout(): Promise<ApiResult> {
  const refresh = localStorage.getItem("refresh");
  try {
    const res = await apiFetch(`${BASE}/api/accounts/logout/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ refresh }),
    });
    // Regardless of status, we clear local auth
    clearAuth();
    if (!res.ok) return { error: "Đăng xuất không hoàn toàn, nhưng phiên làm việc đã xóa." };
    return {};
  } catch (err) {
    clearAuth();
    return { error: "Có lỗi xảy ra khi đăng xuất." };
  }
}

// ======================== REGISTER CUSTOMER ========================
export type CustomerRegisterPayload = {
  full_name: string;
  phone_number: string;
  password: string;
  email?: string;
};

export async function onRegister(
  payload: CustomerRegisterPayload
): Promise<ApiResult> {
  const res = await fetch(`${BASE}/api/accounts/register/customer/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data.detail ||
      data.error ||
      (typeof data === "object" && data !== null
        ? (Object.values(data)?.flat?.()?.[0] as string | undefined)
        : null) ||
      "Register failed";
    return { error: String(msg) };
  }

  const access = data?.tokens?.access;
  const refresh = data?.tokens?.refresh;
  if (access) localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);

  return {};
}

// ======================== REGISTER PARTNER ========================
export type PartnerRegisterPayload = {
  phone_number: string;
  password: string;
  full_name: string;
  business_name: string;
  email?: string;
  business_license?: string;
  tax_code?: string;
};

export async function onRegisterPartner(
  payload: PartnerRegisterPayload
): Promise<ApiResult> {
  const res = await fetch(`${BASE}/api/accounts/register/partner/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data.detail ||
      data.error ||
      (typeof data === "object" && data !== null
        ? (Object.values(data)?.flat?.()?.[0] as string | undefined)
        : null) ||
      "Register failed";
    return { error: String(msg) };
  }

  const access = data?.tokens?.access;
  const refresh = data?.tokens?.refresh;
  if (access) localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);

  return {};
}

// ======================== LOGIN ========================
export async function onLogin(
  phone_number: string,
  password: string
): Promise<ApiResult> {
  const res = await fetch(`${BASE}/api/accounts/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number, password }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error || data?.detail || "Invalid login credentials";
    return { error: String(msg) };
  }

  const access = data?.tokens?.access;
  const refresh = data?.tokens?.refresh;
  if (access) localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);

  // Lưu user + role để Partner page dùng
  if (data.user) {
    localStorage.setItem("user", JSON.stringify(data.user));
  }
  return {};
}

// ======================== UPDATE PROFILE ========================
export type ProfilePayload = {
  date_of_birth?: string; // "YYYY-MM-DD"
  address?: string;
};

export async function updateProfile(
  payload: ProfilePayload
): Promise<ApiResult> {
  const res = await apiFetch(`${BASE}/api/accounts/profile/`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data?.detail ||
      data?.error ||
      (typeof data === "object" && data !== null
        ? (Object.values(data)?.flat?.()?.[0] as string | undefined)
        : null) ||
      "Cập nhật hồ sơ thất bại";
    return { error: String(msg) };
  }

  return {};
}

// ======================== LOCATIONS ========================

export type Location = {
  id: number;
  city: string;
  district?: string;
  ward?: string;
  full_address?: string;
};

export type CreateLocationPayload = {
  city: string;
  district?: string;
  ward?: string;
};

/**
 * Tạo Location mới
 * POST /api/restaurants/locations/
 */
export async function createLocation(
  payload: CreateLocationPayload
): Promise<Location> {
  const res = await apiFetch(`${BASE}/api/restaurants/locations/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data.detail ||
      data.error ||
      (typeof data === "object" && data !== null
        ? (Object.values(data)?.flat?.()?.[0] as string | undefined)
        : null) ||
      "Tạo location thất bại";
    throw new Error(String(msg));
  }

  return data as Location;
}

/**
 * Lấy danh sách Location
 * GET /api/restaurants/locations/
 */
export async function fetchLocations(): Promise<Location[]> {
  const res = await apiFetch(`${BASE}/api/restaurants/locations/`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Lấy danh sách location thất bại");
  }

  return res.json();
}

/**
 * Cập nhật Location
 * PUT /api/restaurants/locations/{id}/
 */
export async function updateLocation(
  id: number,
  payload: CreateLocationPayload
): Promise<Location> {
  const res = await apiFetch(`${BASE}/api/restaurants/locations/${id}/`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data.detail ||
      data.error ||
      (typeof data === "object" && data !== null
        ? (Object.values(data)?.flat?.()?.[0] as string | undefined)
        : null) ||
      "Cập nhật location thất bại";
    throw new Error(String(msg));
  }

  return data as Location;
}

/**
 * Xoá Location
 * DELETE /api/restaurants/locations/{id}/
 */
export async function deleteLocation(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/api/restaurants/locations/${id}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Xóa location thất bại");
  }
}

// ======================== RESTAURANTS (PARTNER) ========================

export type Restaurant = {
  id: number;
  name: string;
  address: string;
  phone_number?: string;
  description?: string;
  opening_hours?: string;
  slot_duration: number;
  status: "PENDING" | "APPROVED" | "SUSPENDED" | "CLOSED";
  rating: number;
  location?: {
    id: number;
    city: string;
    district?: string;
    ward?: string;
  };
  cuisine_type?: string;
  price_range?: 'BUDGET' | 'MEDIUM' | 'PREMIUM';
  partner_name?: string;
  image_count?: number;
  is_favorite?: boolean;
  created_at: string;
};

export type RestaurantDetail = Restaurant & {
  images: RestaurantImage[];
  menu_items: MenuItem[];
  time_slots: TimeSlot[];
};

export type CreateRestaurantPayload = {
  name: string;
  address: string;
  phone_number?: string;
  description?: string;
  opening_hours?: string;
  cuisine_type?: string;
  price_range?: 'BUDGET' | 'MEDIUM' | 'PREMIUM';
  slot_duration?: number;
  location_id?: number;
};


/**
 * Lấy danh sách restaurants (PUBLIC - tất cả APPROVED)
 * GET /api/restaurants/restaurants/
 * Dùng cho: Customer browse, public listing
 */
export async function fetchRestaurants(): Promise<Restaurant[]> {
  const res = await apiFetch(`${BASE}/api/restaurants/restaurants/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Lấy danh sách nhà hàng thất bại");
  }

  const data = await res.json();
  // Handle both paginated {results:[]} and plain array responses
  return data.results ?? data.data ?? data;
}

/**
 * Lấy danh sách nhà hàng CỦA MÌNH (Partner Dashboard)
 * GET /api/restaurants/restaurants/my-restaurants/
 * Dùng cho: Partner quản lý nhà hàng của mình
 */
export async function fetchMyRestaurants(): Promise<Restaurant[]> {
  const res = await apiFetch(`${BASE}/api/restaurants/restaurants/my-restaurants/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Lấy danh sách nhà hàng của bạn thất bại");
  }

  const data = await res.json();
  return data.results ?? data.data ?? data;
}
/**
 * Lấy chi tiết restaurant (kèm images, menu, slots)
 * GET /api/restaurants/restaurants/{id}/
 */
export async function fetchRestaurant(id: string): Promise<RestaurantDetail> {
  const res = await apiFetch(`${BASE}/api/restaurants/restaurants/${id}/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Lấy thông tin nhà hàng thất bại");
  }

  return res.json();
}

/**
 * Tạo restaurant mới (status sẽ là PENDING)
 * POST /api/restaurants/restaurants/
 */
export async function createRestaurant(
  data: CreateRestaurantPayload
): Promise<{ message: string; data: RestaurantDetail }> {
  const res = await apiFetch(`${BASE}/api/restaurants/restaurants/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Tạo nhà hàng thất bại");
  }

  return res.json();
}

/**
 * Cập nhật restaurant
 * PUT /api/restaurants/restaurants/{id}/
 */
export async function updateRestaurant(
  id: string,
  data: Partial<CreateRestaurantPayload>
): Promise<RestaurantDetail> {
  const res = await apiFetch(`${BASE}/api/restaurants/restaurants/${id}/`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Cập nhật nhà hàng thất bại");
  }

  return res.json();
}

/**
 * Xóa restaurant
 * DELETE /api/restaurants/restaurants/{id}/
 */
export async function deleteRestaurant(id: string): Promise<void> {
  const res = await apiFetch(`${BASE}/api/restaurants/restaurants/${id}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Xóa nhà hàng thất bại");
  }
}

/**
 * Lấy danh sách time slots còn trống cho ngày cụ thể
 * GET /api/restaurants/restaurants/{id}/available-slots/?date=YYYY-MM-DD
 */
export async function fetchAvailableSlots(
  restaurantId: string,
  date: string
): Promise<{ date: string; available_slots: TimeSlot[] }> {
  const res = await apiFetch(
    `${BASE}/api/restaurants/restaurants/${restaurantId}/available-slots/?date=${date}`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Lấy khung giờ trống thất bại");
  }

  return res.json();
}

// ======================== RESTAURANT IMAGES ========================

export type RestaurantImage = {
  id: number;
  image_url: string;
  display_order: number;
  created_at?: string;
};

/**
 * Lấy danh sách ảnh của restaurant
 * GET /api/restaurants/images/?restaurant_id={id}
 */
export async function fetchRestaurantImages(
  restaurantId: string
): Promise<RestaurantImage[]> {
  const res = await apiFetch(
    `${BASE}/api/restaurants/images/?restaurant_id=${restaurantId}`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Lấy danh sách ảnh thất bại");
  }

  const data = await res.json();
  return data.results ?? data.data ?? data;
}

/**
 * Upload ảnh lên Django Backend
 * POST /api/restaurants/images/upload/
 */
export async function uploadRestaurantImage(
  restaurantId: string,
  file: File,
  displayOrder: number = 0
): Promise<{ message: string; data: RestaurantImage }> {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("restaurant_id", restaurantId);
  formData.append("display_order", displayOrder.toString());

  const res = await apiFetch(`${BASE}/api/restaurants/images/upload/`, {
    method: "POST",
    headers: getAuthHeadersMultipart(),
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Upload ảnh thất bại");
  }

  return res.json();
}

/**
 * Xóa ảnh
 * DELETE /api/restaurants/images/{id}/
 */
export async function deleteRestaurantImage(imageId: string): Promise<void> {
  const res = await apiFetch(`${BASE}/api/restaurants/images/${imageId}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Xóa ảnh thất bại");
  }
}

/**
 * Cập nhật thứ tự hiển thị ảnh
 * PUT /api/restaurants/images/{id}/
 */
export async function updateImageOrder(
  imageId: string,
  displayOrder: number
): Promise<{ message: string; data: RestaurantImage }> {
  const res = await fetch(`${BASE}/api/restaurants/images/${imageId}/`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ display_order: displayOrder }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Cập nhật thứ tự ảnh thất bại");
  }

  return res.json();
}

// ======================== MENU ITEMS ========================

export type MenuItem = {
  id: number;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category?: string;
  is_available: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CreateMenuItemPayload = {
  restaurant_id: number;
  name: string;
  description?: string;
  price: number;
  category?: string;
  is_available?: boolean;
};

/**
 * Lấy menu của restaurant
 * GET /api/restaurants/menu-items/?restaurant_id={id}
 */
export async function fetchMenuItems(restaurantId: string): Promise<MenuItem[]> {
  const res = await apiFetch(
    `${BASE}/api/restaurants/menu-items/?restaurant_id=${restaurantId}&page_size=200`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Lấy danh sách menu thất bại");
  }

  const data = await res.json();
  return data.results ?? data.data ?? data;
}

/**
 * Tạo menu item mới
 * POST /api/restaurants/menu-items/
 */
export async function createMenuItem(
  data: CreateMenuItemPayload
): Promise<{ message: string; data: MenuItem }> {
  const res = await apiFetch(`${BASE}/api/restaurants/menu-items/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Tạo menu item thất bại");
  }

  return res.json();
}

/**
 * Cập nhật menu item
 * PUT /api/restaurants/menu-items/{id}/
 */
export async function updateMenuItem(
  menuId: string,
  data: Partial<Omit<CreateMenuItemPayload, "restaurant_id">>
): Promise<MenuItem> {
  const res = await apiFetch(`${BASE}/api/restaurants/menu-items/${menuId}/`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Cập nhật menu item thất bại");
  }

  return res.json();
}

/**
 * Xóa menu item
 * DELETE /api/restaurants/menu-items/{id}/
 */
export async function deleteMenuItem(menuId: string): Promise<void> {
  const res = await apiFetch(`${BASE}/api/restaurants/menu-items/${menuId}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Xóa menu item thất bại");
  }
}

/**
 * Upload ảnh cho menu item
 * POST /api/restaurants/menu-items/{id}/upload-image/
 */
export async function uploadMenuItemImage(
  menuId: string,
  file: File
): Promise<{ message: string; data: MenuItem }> {
  const formData = new FormData();
  formData.append("image", file);

  const res = await apiFetch(
    `${BASE}/api/restaurants/menu-items/${menuId}/upload-image/`,
    {
      method: "POST",
      headers: getAuthHeadersMultipart(),
      body: formData,
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Upload ảnh menu thất bại");
  }

  return res.json();
}

/**
 * Bật/tắt menu item
 * POST /api/restaurants/menu-items/{id}/toggle-availability/
 */
export async function toggleMenuItemAvailability(
  menuId: string
): Promise<{ message: string; data: MenuItem }> {
  const res = await apiFetch(
    `${BASE}/api/restaurants/menu-items/${menuId}/toggle-availability/`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Cập nhật trạng thái thất bại");
  }

  return res.json();
}

// ======================== TIME SLOTS ========================

export type TimeSlot = {
  id: number;
  start_time: string; // "HH:MM:SS"
  end_time: string; // "HH:MM:SS"
  max_bookings: number;
  is_active: boolean;
};

export type CreateTimeSlotPayload = {
  restaurant_id: number;
  start_time: string;
  end_time: string;
  max_bookings?: number;
  is_active?: boolean;
};

/**
 * Lấy danh sách time slots của restaurant
 * GET /api/restaurants/time-slots/?restaurant_id={id}
 */
export async function fetchTimeSlots(restaurantId: string): Promise<TimeSlot[]> {
  const res = await apiFetch(
    `${BASE}/api/restaurants/time-slots/?restaurant_id=${restaurantId}`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Lấy danh sách khung giờ thất bại");
  }

  const data = await res.json();
  return data.results ?? data.data ?? data;
}

/**
 * Tạo time slot mới
 * POST /api/restaurants/time-slots/
 */
export async function createTimeSlot(
  data: CreateTimeSlotPayload
): Promise<{ message: string; data: TimeSlot }> {
  const res = await apiFetch(`${BASE}/api/restaurants/time-slots/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Tạo khung giờ thất bại");
  }

  return res.json();
}

/**
 * Cập nhật time slot
 * PUT /api/restaurants/time-slots/{id}/
 */
export async function updateTimeSlot(
  slotId: string,
  data: Partial<Omit<CreateTimeSlotPayload, "restaurant_id">>
): Promise<TimeSlot> {
  const res = await apiFetch(`${BASE}/api/restaurants/time-slots/${slotId}/`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Cập nhật khung giờ thất bại");
  }

  return res.json();
}

/**
 * Xóa time slot
 * DELETE /api/restaurants/time-slots/{id}/
 */
export async function deleteTimeSlot(slotId: string): Promise<void> {
  const res = await apiFetch(`${BASE}/api/restaurants/time-slots/${slotId}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Xóa khung giờ thất bại");
  }
}

/**
 * Bật/tắt time slot
 * POST /api/restaurants/time-slots/{id}/toggle-active/
 */
export async function toggleTimeSlotActive(
  slotId: string
): Promise<{ message: string; data: TimeSlot }> {
  const res = await apiFetch(
    `${BASE}/api/restaurants/time-slots/${slotId}/toggle-active/`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Cập nhật trạng thái thất bại");
  }

  return res.json();
}

/**
 * Kiểm tra slot còn chỗ trống không
 * POST /api/restaurants/time-slots/check-availability/
 * 
 * Nếu có time_slot_id: trả về info của slot đó
 * Nếu không có: trả về list tất cả slots available
 */
export async function checkSlotAvailability(
  restaurantId: number,
  date: string,
  timeSlotId?: number
): Promise<
  | {
      available: boolean;
      time_slot: TimeSlot;
      current_bookings: number;
      max_bookings: number;
    }
  | {
      date: string;
      available_slots: TimeSlot[];
    }
> {
  const body: {
    restaurant_id: number;
    date: string;
    time_slot_id?: number;
  } = {
    restaurant_id: restaurantId,
    date,
  };

  if (timeSlotId !== undefined) {
    body.time_slot_id = timeSlotId;
  }

  const res = await apiFetch(
    `${BASE}/api/restaurants/time-slots/check-availability/`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Kiểm tra khung giờ thất bại");
  }

  return res.json();
}




// ======================== BOOKINGS ========================

export type Booking = {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_phone?: string;
  booking_date: string; // "YYYY-MM-DD"
  time_slot_info: {
    id: number;
    start_time: string; // "HH:MM"
    end_time: string; // "HH:MM"
    display: string; // "HH:MM - HH:MM"
  };
  number_of_guests: number;
  special_request?: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  status_display: string;
  created_at: string;
  confirmed_at?: string;
  can_cancel: boolean;
  can_confirm: boolean;
  can_reject: boolean;
};

export type BookingListItem = {
  id: number;
  restaurant: number; // ID nhà hàng
  customer_name: string;
  customer_phone: string;
  restaurant_name: string;
  restaurant_address: string;
  booking_date: string;
  time_slot_display: string;
  number_of_guests: number;
  status: string;
  status_display: string;
  has_review: boolean;
  review_details: {
    rating: number;
    comment: string;
    created_at: string;
  } | null;
  created_at: string;
};

export type CreateBookingPayload = {
  restaurant: number;
  time_slot: number;
  booking_date: string; // "YYYY-MM-DD"
  number_of_guests: number;
  special_request?: string;
  voucher_code?: string;
};

export type CheckAvailabilityPayload = {
  restaurant_id: number;
  booking_date: string; // "YYYY-MM-DD"
  time_slot_id?: number; // optional - nếu có thì check slot cụ thể
};

export type SlotAvailability = {
  id: number;
  start_time: string;
  end_time: string;
  max_bookings: number | null;
  current_bookings: number;
  available: boolean;
};

export type CheckAvailabilityResponse = 
  | {
      // Response khi check slot cụ thể
      available: boolean;
      message: string;
      time_slot: {
        id: number;
        start_time: string;
        end_time: string;
        max_bookings: number | null;
        current_bookings: number;
      };
    }
  | {
      // Response khi check tất cả slots
      date: string;
      restaurant_id: number;
      restaurant_name: string;
      available_slots: SlotAvailability[];
    };

/**
 * Lấy danh sách bookings
 * GET /api/bookings/
 * - Customer: bookings của mình
 * - Partner: bookings của nhà hàng mình
 * - Admin: tất cả bookings
 */
export async function fetchBookings(params?: {
  status?: string;
  start_date?: string;
  end_date?: string;
  restaurant_id?: number;
  order_by?: string;
}): Promise<BookingListItem[]> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);
  if (params?.restaurant_id) queryParams.append('restaurant_id', params.restaurant_id.toString());
  if (params?.order_by) queryParams.append('order_by', params.order_by);

  const url = `${BASE}/api/bookings/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  const res = await apiFetch(url, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Lấy danh sách booking thất bại');
  }

  const data = await res.json();
  // Handle DRF paginated {results:[]}, custom {data:[]}, and plain array
  return data.results ?? data.data ?? data;
}

/**
 * Lấy chi tiết booking
 * GET /api/bookings/{id}/
 */
export async function fetchBooking(id: string | number): Promise<Booking> {
  const res = await apiFetch(`${BASE}/api/bookings/${id}/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Lấy thông tin booking thất bại');
  }

  const data = await res.json();
  return data.data || data;
}

/**
 * Tạo booking mới (Customer only)
 * POST /api/bookings/
 */
export async function createBooking(
  payload: CreateBookingPayload
): Promise<{ message: string; data: Booking }> {
  const res = await apiFetch(`${BASE}/api/bookings/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    
    // Xử lý validation errors
    if (typeof error === 'object' && error !== null) {
      const firstError = Object.values(error).flat()[0];
      if (firstError) {
        throw new Error(String(firstError));
      }
    }
    
    throw new Error(error.error || error.detail || 'Đặt bàn thất bại');
  }

  return res.json();
}

/**
 * Hủy booking (Customer only)
 * PUT /api/bookings/{id}/cancel/
 */
export async function cancelBooking(id: string | number): Promise<{ message: string; data: Booking }> {
  const res = await apiFetch(`${BASE}/api/bookings/${id}/cancel/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Hủy booking thất bại');
  }

  return res.json();
}

/**
 * Xác nhận booking (Partner only)
 * PUT /api/bookings/{id}/confirm/
 */
export async function confirmBooking(id: string | number): Promise<{ message: string; data: Booking }> {
  const res = await apiFetch(`${BASE}/api/bookings/${id}/confirm/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Xác nhận booking thất bại');
  }

  return res.json();
}

/**
 * Từ chối booking (Partner only)
 * PUT /api/bookings/{id}/reject/
 */
export async function rejectBooking(id: string | number): Promise<{ message: string; data: Booking }> {
  const res = await apiFetch(`${BASE}/api/bookings/${id}/reject/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Từ chối booking thất bại');
  }

  return res.json();
}

/**
 * Hoàn thành booking (Partner only)
 * PUT /api/bookings/{id}/complete/
 */
export async function completeBooking(id: string | number): Promise<{ message: string; data: Booking }> {
  const res = await apiFetch(`${BASE}/api/bookings/${id}/complete/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Đánh dấu hoàn thành thất bại');
  }

  return res.json();
}

/**
 * Đánh dấu no-show (Partner only)
 * PUT /api/bookings/{id}/no-show/
 */
export async function markNoShow(id: string | number): Promise<{ message: string; data: Booking }> {
  const res = await apiFetch(`${BASE}/api/bookings/${id}/no-show/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Đánh dấu no-show thất bại');
  }

  return res.json();
}

/**
 * Kiểm tra khung giờ còn chỗ trống
 * POST /api/bookings/check-availability/
 * 
 * Nếu có time_slot_id: trả về info của slot đó
 * Nếu không có: trả về list tất cả slots available
 */
export async function checkAvailability(
  payload: CheckAvailabilityPayload
): Promise<CheckAvailabilityResponse> {
  const res = await apiFetch(`${BASE}/api/bookings/check-availability/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    
    // Xử lý validation errors
    if (typeof error === 'object' && error !== null) {
      const firstError = Object.values(error).flat()[0];
      if (firstError) {
        throw new Error(String(firstError));
      }
    }
    
    throw new Error(error.error || error.detail || 'Kiểm tra khung giờ thất bại');
  }

  return res.json();
}

/**
 * Helper: Get booking status display name
 */
export function getBookingStatusDisplay(status: string): string {
  const statusMap: Record<string, string> = {
    'PENDING': 'Chờ xác nhận',
    'CONFIRMED': 'Đã xác nhận',
    'REJECTED': 'Đã từ chối',
    'CANCELLED': 'Đã hủy',
    'COMPLETED': 'Hoàn thành',
    'NO_SHOW': 'Không đến'
  };
  return statusMap[status] || status;
}

/**
 * Helper: Get booking status color for UI
 */
export function getBookingStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    'PENDING': 'text-yellow-400 bg-yellow-500/20',
    'CONFIRMED': 'text-green-400 bg-green-500/20',
    'REJECTED': 'text-red-400 bg-red-500/20',
    'CANCELLED': 'text-gray-400 bg-gray-500/20',
    'COMPLETED': 'text-blue-400 bg-blue-500/20',
    'NO_SHOW': 'text-orange-400 bg-orange-500/20'
  };
  return colorMap[status] || 'text-gray-400 bg-gray-500/20';
}

/**
 * Helper: Format date to Vietnamese
 */
export function formatBookingDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

/**
 * Helper: Format datetime to Vietnamese
 */
export function formatBookingDateTime(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}






// ======================== NOTIFICATIONS ========================

export type Notification = {
  id: number;
  title: string;
  message: string;
  type: 'BOOKING' | 'RESTAURANT' | 'SYSTEM';
  type_display: string;
  sent_at: string; // ISO datetime string
  is_read: boolean;
  time_ago: string; // "5 phút trước", "2 giờ trước"
  related_object_type: string | null;
  related_object_id: number | null;
};

export type NotificationListResponse = {
  data: Notification[];
  unread_count: number;
};

/**
 * Lấy danh sách notifications của user hiện tại
 * GET /api/notifications/
 * 
 * Query params:
 * - is_read: true/false (optional)
 * - type: BOOKING/RESTAURANT/SYSTEM (optional)
 */
export async function fetchNotifications(params?: {
  is_read?: boolean;
  type?: 'BOOKING' | 'RESTAURANT' | 'SYSTEM';
}): Promise<NotificationListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.is_read !== undefined) {
    queryParams.append('is_read', String(params.is_read));
  }
  if (params?.type) {
    queryParams.append('type', params.type);
  }

  const url = `${BASE}/api/notifications/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  const res = await apiFetch(url, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Lấy danh sách thông báo thất bại');
  }

  return res.json();
}

/**
 * Lấy chi tiết notification (tự động mark as read)
 * GET /api/notifications/{id}/
 */
export async function fetchNotification(id: string | number): Promise<{ data: Notification }> {
  const res = await apiFetch(`${BASE}/api/notifications/${id}/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Lấy thông tin thông báo thất bại');
  }

  return res.json();
}

/**
 * Xóa notification
 * DELETE /api/notifications/{id}/
 */
export async function deleteNotification(id: string | number): Promise<{ message: string }> {
  const res = await apiFetch(`${BASE}/api/notifications/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Xóa thông báo thất bại');
  }

  return res.json();
}

/**
 * Đánh dấu notification đã đọc
 * PUT /api/notifications/{id}/mark-read/
 */
export async function markNotificationAsRead(
  id: string | number
): Promise<{ message: string; data: Notification }> {
  const res = await apiFetch(`${BASE}/api/notifications/${id}/mark_read/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Đánh dấu đã đọc thất bại');
  }

  return res.json();
}

/**
 * Đánh dấu tất cả notifications đã đọc
 * POST /api/notifications/mark-all-read/
 */
export async function markAllNotificationsAsRead(): Promise<{ message: string }> {
  const res = await apiFetch(`${BASE}/api/notifications/mark_all_read/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Đánh dấu tất cả đã đọc thất bại');
  }

  return res.json();
}

/**
 * Xóa tất cả notifications đã đọc
 * DELETE /api/notifications/delete-all-read/
 */
export async function deleteAllReadNotifications(): Promise<{ message: string }> {
  const res = await apiFetch(`${BASE}/api/notifications/delete_all_read/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Xóa thông báo đã đọc thất bại');
  }

  return res.json();
}

/**
 * Đếm số notification chưa đọc
 * GET /api/notifications/unread-count/
 */
export async function getUnreadNotificationCount(): Promise<{ unread_count: number }> {
  const res = await apiFetch(`${BASE}/api/notifications/unread-count/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Lấy số thông báo chưa đọc thất bại');
  }

  return res.json();
}

/**
 * Helper: Get notification type display name
 */
export function getNotificationTypeDisplay(type: string): string {
  const typeMap: Record<string, string> = {
    'BOOKING': 'Đặt bàn',
    'RESTAURANT': 'Nhà hàng',
    'SYSTEM': 'Hệ thống'
  };
  return typeMap[type] || type;
}

/**
 * Helper: Get notification type color for UI
 */
export function getNotificationTypeColor(type: string): string {
  const colorMap: Record<string, string> = {
    'BOOKING': 'text-blue-400 bg-blue-500/20',
    'RESTAURANT': 'text-green-400 bg-green-500/20',
    'SYSTEM': 'text-purple-400 bg-purple-500/20'
  };
  return colorMap[type] || 'text-gray-400 bg-gray-500/20';
}

/**
 * Helper: Get notification type icon
 */
export function getNotificationTypeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    'BOOKING': '📅',
    'RESTAURANT': '🍽️',
    'SYSTEM': '🔔'
  };
  return iconMap[type] || '📬';
}

/**
 * Helper: Format notification datetime to Vietnamese
 */
export function formatNotificationTime(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

// ======================== PARTNER DASHBOARD STATS ========================
export type PartnerDashboardStats = {
  total_restaurants: number;
  bookings_today: number;
  bookings_this_week: number;
  bookings_pending: number;
  upcoming_bookings_next_2h: number;
  upcoming_bookings_next_24h: number;
  peak_hours_today: Array<{ time: string; count: number }>;
  bookings_7days: Array<{ date: string; day: string; count: number }>;
};

export async function getPartnerDashboardStats(
  restaurantId?: string
): Promise<PartnerDashboardStats | null> {
  try {
    const url = `${BASE}/api/bookings/partner-dashboard-stats/${
      restaurantId ? `?restaurant_id=${restaurantId}` : ''
    }`;

    const res = await apiFetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      console.error('Failed to fetch dashboard stats:', await res.json());
      return null;
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return null;
  }
}

// ======================== PAYMENTS & WALLET ========================

export type Wallet = {
  id: number;
  partner: number;
  partner_name: string;
  balance: string; // Decimal from Django
  frozen_balance: string; // Decimal from Django
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: number;
  wallet: number | null;
  booking: number | null;
  amount: string;
  transaction_type: 'DEPOSIT' | 'PAYMENT' | 'WITHDRAWAL' | 'REFUND';
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  payment_method: string | null;
  transaction_id: string | null;
  created_at: string;
};

/**
 * Lấy danh sách ví (thường chỉ 1 cho Partner)
 */
export async function fetchWallets(): Promise<Wallet[]> {
  const res = await apiFetch(`${BASE}/api/payments/wallets/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Lấy thông tin ví thất bại");
  const data = await res.json();
  return data.results ?? data.data ?? data;
}

/**
 * Lấy danh sách giao dịch
 */
export async function fetchTransactions(): Promise<Transaction[]> {
  const res = await apiFetch(`${BASE}/api/payments/transactions/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Lấy danh sách giao dịch thất bại");
  const data = await res.json();
  return data.results ?? data.data ?? data;
}

// ======================== DISCOVERY ========================

export type Banner = {
  id: number;
  title: string;
  image_url: string;
  target_url?: string;
  display_order: number;
};

export type Collection = {
  id: number;
  title: string;
  description?: string;
  cover_image_url?: string;
  badge_label?: string;
  items: {
    id: number;
    restaurant: Restaurant;
    added_at: string;
  }[];
};

/**
 * Lấy danh sách banners hoạt động
 */
export async function fetchBanners(): Promise<Banner[]> {
  const res = await apiFetch(`${BASE}/api/discovery/banners/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Lấy danh sách banners thất bại");
  const data = await res.json();
  return data.results ?? data.data ?? data;
}

/**
 * Lấy danh sách collections hoạt động
 */
/**
 * Lấy danh sách collections hoạt động
 */
export async function fetchCollections(): Promise<Collection[]> {
  const res = await apiFetch(`${BASE}/api/discovery/collections/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Lấy danh sách collections thất bại");
  const data = await res.json();
  return data.results ?? data.data ?? data;
}

// ======================== PAYMENTS - DEPOSIT POLICY ========================

export type DepositPolicy = {
  id: number;
  restaurant: number;
  is_required: boolean;
  deposit_amount: string;
  deposit_percentage: string | null;
  minimum_guests_for_deposit: number;
};

/**
 * Lấy deposit policy của nhà hàng
 * GET /api/payments/deposit-policies/?restaurant_id=X
 */
export async function fetchDepositPolicy(restaurantId: string | number): Promise<DepositPolicy | null> {
  const res = await apiFetch(`${BASE}/api/payments/deposit-policies/?restaurant_id=${restaurantId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.results ?? data;
  return results.length > 0 ? results[0] : null;
}

/**
 * Giả lập thanh toán cọc
 * POST /api/payments/simulate-deposit/
 */
export async function simulateDeposit(bookingId: number): Promise<{
  message: string;
  data: { booking_id: number; deposit_amount: string; transaction_id: string; is_deposit_paid: boolean };
}> {
  const res = await apiFetch(`${BASE}/api/payments/simulate-deposit/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ booking_id: bookingId }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Thanh toán cọc thất bại');
  }
  return res.json();
}

// ======================== PROMOTIONS - VOUCHER FOR BOOKING ========================

export type VoucherForBooking = {
  id: number;
  code: string;
  description: string;
  voucher_type: 'PERCENTAGE' | 'FIXED';
  discount_value: string;
  max_discount_amount: string | null;
  min_order_value: string;
  restaurant: number | null;
  restaurant_name: string | null;
  valid_to: string;
  points_cost?: number; // Sẽ có điểm nếu voucher này cần dùng điểm để đổi
};

export type UserVoucher = {
  id: number;
  user: number;
  voucher: number;
  voucher_details: VoucherForBooking;
  is_used: boolean;
  collected_at: string;
  used_at: string | null;
};

/**
 * Lấy danh sách voucher khả dụng cho đặt bàn tại nhà hàng cụ thể
 * GET /api/promotions/vouchers/available-for-booking/?restaurant_id=X
 */
export async function fetchAvailableVouchers(restaurantId: string | number): Promise<VoucherForBooking[]> {
  const res = await apiFetch(`${BASE}/api/promotions/vouchers/available-for-booking/?restaurant_id=${restaurantId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.vouchers ?? [];
}

/**
 * Lấy danh sách voucher trong ví của Customer
 * GET /api/promotions/user-vouchers/
 */
export async function fetchUserVouchers(): Promise<UserVoucher[]> {
  const res = await apiFetch(`${BASE}/api/promotions/my-vouchers/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? data ?? [];
}

/**
 * Lấy danh sách tất cả voucher (hoạt động) để đổi điểm
 * GET /api/promotions/vouchers/
 */
export async function fetchRewardVouchers(): Promise<VoucherForBooking[]> {
  const res = await apiFetch(`${BASE}/api/promotions/vouchers/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? data ?? [];
}

/**
 * Thu thập (collect) voucher
 * POST /api/promotions/vouchers/{id}/collect/
 */
export async function collectVoucher(voucherId: number): Promise<{ message: string, loyalty_points?: number }> {
  const res = await apiFetch(`${BASE}/api/promotions/vouchers/${voucherId}/collect/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Thu thập voucher thất bại');
  }
  return res.json();
}

// ======================== DISCOVERY CRUD ========================

/**
 * Tạo collection mới
 * POST /api/discovery/collections/
 */
export async function createCollection(data: {
  title: string;
  description?: string;
  cover_image_url?: string;
  restaurant_ids?: number[];
}): Promise<{ message: string; data: Collection }> {
  const res = await apiFetch(`${BASE}/api/discovery/collections/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Tạo bộ sưu tập thất bại');
  }
  return res.json();
}

/**
 * Xóa collection
 */
export async function deleteCollection(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/api/discovery/collections/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Xóa bộ sưu tập thất bại');
}

/**
 * Thêm nhà hàng vào collection
 */
export async function addRestaurantToCollection(collectionId: number, restaurantId: number): Promise<{ message: string }> {
  const res = await apiFetch(`${BASE}/api/discovery/collections/${collectionId}/add-restaurant/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ restaurant_id: restaurantId }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Thêm nhà hàng thất bại');
  }
  return res.json();
}

/**
 * Xóa nhà hàng khỏi collection
 */
export async function removeRestaurantFromCollection(collectionId: number, restaurantId: number): Promise<{ message: string }> {
  const res = await apiFetch(`${BASE}/api/discovery/collections/${collectionId}/remove-restaurant/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ restaurant_id: restaurantId }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Xóa nhà hàng thất bại');
  }
  return res.json();
}

/**
 * Tạo banner mới
 */
export async function createBanner(data: {
  title: string;
  image_url: string;
  target_url?: string;
  display_order?: number;
}): Promise<{ message: string; data: Banner }> {
  const res = await apiFetch(`${BASE}/api/discovery/banners/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Tạo banner thất bại');
  }
  return res.json();
}

/**
 * Xóa banner
 */
export async function deleteBanner(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/api/discovery/banners/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Xóa banner thất bại');
}

// ======================== VOUCHER CRUD (PARTNER) ========================

export type CreateVoucherPayload = {
  code: string;
  description?: string;
  voucher_type: 'PERCENTAGE' | 'FIXED';
  discount_value: number;
  max_discount_amount?: number;
  min_order_value?: number;
  restaurant?: number;
  valid_from: string;
  valid_to: string;
  usage_limit?: number;
};

/**
 * Tạo voucher mới (Partner)
 */
export async function createVoucher(data: CreateVoucherPayload): Promise<any> {
  const res = await apiFetch(`${BASE}/api/promotions/vouchers/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Tạo voucher thất bại');
  }
  return res.json();
}

/**
 * Cập nhật voucher (Partner)
 */
export async function updateVoucher(id: number, data: Partial<CreateVoucherPayload>): Promise<any> {
  const res = await apiFetch(`${BASE}/api/promotions/vouchers/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Cập nhật voucher thất bại');
  }
  return res.json();
}

/**
 * Xóa voucher (Partner)
 */
export async function deleteVoucher(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/api/promotions/vouchers/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Xóa voucher thất bại');
}
