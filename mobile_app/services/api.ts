import * as SecureStore from 'expo-secure-store';

// ======================== CONFIG ========================
// ⚠️ QUAN TRỌNG: Thay đổi địa chỉ IP này thành IP LAN máy tính của bạn
// Ví dụ: "http://192.168.1.12:8000"
const BASE = "http://127.0.0.1:8000"; 

export type ApiResult = { error?: string };

// Kiểu dữ liệu file dành riêng cho React Native (dùng cho ImagePicker)
export type NativeFile = {
  uri: string;
  name: string;
  type: string;
};

// ======================== AUTH HELPERS ========================

// Mobile: Lấy token là tác vụ bất đồng bộ (Async)
async function getToken() {
  return await SecureStore.getItemAsync("access");
}

// Mobile: Header cũng phải là Async
async function getAuthHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const access = await getToken();
  return {
    "Content-Type": "application/json",
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
    ...(extra || {}),
  };
}

async function getAuthHeadersMultipart(): Promise<HeadersInit> {
  const access = await getToken();
  return {
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
    // Không set Content-Type để fetch tự động xử lý boundary cho FormData
  };
}

// Hàm logout tiện ích cho Mobile
export async function logout() {
  await SecureStore.deleteItemAsync("access");
  await SecureStore.deleteItemAsync("refresh");
  await SecureStore.deleteItemAsync("user");
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
  try {
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
    if (access) await SecureStore.setItemAsync("access", access);
    if (refresh) await SecureStore.setItemAsync("refresh", refresh);

    return {};
  } catch (error) {
    return { error: "Lỗi kết nối server" };
  }
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
  try {
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
    if (access) await SecureStore.setItemAsync("access", access);
    if (refresh) await SecureStore.setItemAsync("refresh", refresh);

    return {};
  } catch (error) {
    return { error: "Lỗi kết nối server" };
  }
}

// ======================== LOGIN ========================
export async function onLogin(
  phone_number: string,
  password: string
): Promise<ApiResult> {
  try {
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
    if (access) await SecureStore.setItemAsync("access", access);
    if (refresh) await SecureStore.setItemAsync("refresh", refresh);

    // Lưu user + role để Partner page dùng
    if (data.user) {
      await SecureStore.setItemAsync("user", JSON.stringify(data.user));
    }
    return {};
  } catch (error) {
    return { error: "Lỗi kết nối server" };
  }
}

// ======================== UPDATE PROFILE ========================
export type ProfilePayload = {
  date_of_birth?: string; // "YYYY-MM-DD"
  address?: string;
};

export async function updateProfile(
  payload: ProfilePayload
): Promise<ApiResult> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/accounts/profile/`, {
    method: "PUT",
    headers: headers,
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

export async function createLocation(
  payload: CreateLocationPayload
): Promise<Location> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/locations/`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.detail || data.error || "Tạo location thất bại";
    throw new Error(String(msg));
  }

  return data as Location;
}

export async function fetchLocations(): Promise<Location[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/locations/`, {
    method: "GET",
    headers: headers,
  });

  if (!res.ok) {
    throw new Error("Lấy danh sách location thất bại");
  }

  return res.json();
}

export async function updateLocation(
  id: number,
  payload: CreateLocationPayload
): Promise<Location> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/locations/${id}/`, {
    method: "PUT",
    headers: headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.detail || data.error || "Cập nhật location thất bại";
    throw new Error(String(msg));
  }

  return data as Location;
}

export async function deleteLocation(id: number): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/locations/${id}/`, {
    method: "DELETE",
    headers: headers,
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
  partner_name?: string;
  image_count?: number;
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
  slot_duration?: number;
  location_id?: number;
};

export async function fetchRestaurants(): Promise<Restaurant[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/restaurants/`, {
    headers: headers,
  });

  if (!res.ok) {
    throw new Error("Lấy danh sách nhà hàng thất bại");
  }

  return res.json();
}

export async function fetchMyRestaurants(): Promise<Restaurant[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/restaurants/my-restaurants/`, {
    headers: headers,
  });

  if (!res.ok) {
    throw new Error("Lấy danh sách nhà hàng của bạn thất bại");
  }

  return res.json();
}

export async function fetchRestaurant(id: string): Promise<RestaurantDetail> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/restaurants/${id}/`, {
    headers: headers,
  });

  if (!res.ok) {
    throw new Error("Lấy thông tin nhà hàng thất bại");
  }

  return res.json();
}

export async function createRestaurant(
  data: CreateRestaurantPayload
): Promise<{ message: string; data: RestaurantDetail }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/restaurants/`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Tạo nhà hàng thất bại");
  }

  return res.json();
}

export async function updateRestaurant(
  id: string,
  data: Partial<CreateRestaurantPayload>
): Promise<RestaurantDetail> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/restaurants/${id}/`, {
    method: "PUT",
    headers: headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Cập nhật nhà hàng thất bại");
  }

  return res.json();
}

export async function deleteRestaurant(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/restaurants/${id}/`, {
    method: "DELETE",
    headers: headers,
  });

  if (!res.ok) {
    throw new Error("Xóa nhà hàng thất bại");
  }
}

export async function fetchAvailableSlots(
  restaurantId: string,
  date: string
): Promise<{ date: string; available_slots: TimeSlot[] }> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${BASE}/api/restaurants/restaurants/${restaurantId}/available-slots/?date=${date}`,
    {
      headers: headers,
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

export async function fetchRestaurantImages(
  restaurantId: string
): Promise<RestaurantImage[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${BASE}/api/restaurants/images/?restaurant_id=${restaurantId}`,
    {
      headers: headers,
    }
  );

  if (!res.ok) {
    throw new Error("Lấy danh sách ảnh thất bại");
  }

  return res.json();
}

/**
 * Upload ảnh lên Django Backend (Mobile Version)
 */
export async function uploadRestaurantImage(
  restaurantId: string,
  file: NativeFile, // Dùng type NativeFile cho React Native
  displayOrder: number = 0
): Promise<{ message: string; data: RestaurantImage }> {
  const formData = new FormData();
  
  // React Native requires appending file as an object with uri, name, type
  // @ts-ignore
  formData.append("image", {
    uri: file.uri,
    name: file.name,
    type: file.type || 'image/jpeg',
  });
  
  formData.append("restaurant_id", restaurantId);
  formData.append("display_order", displayOrder.toString());

  const headers = await getAuthHeadersMultipart();

  const res = await fetch(`${BASE}/api/restaurants/images/upload/`, {
    method: "POST",
    headers: headers,
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Upload ảnh thất bại");
  }

  return res.json();
}

export async function deleteRestaurantImage(imageId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/images/${imageId}/`, {
    method: "DELETE",
    headers: headers,
  });

  if (!res.ok) {
    throw new Error("Xóa ảnh thất bại");
  }
}

export async function updateImageOrder(
  imageId: string,
  displayOrder: number
): Promise<{ message: string; data: RestaurantImage }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/images/${imageId}/`, {
    method: "PUT",
    headers: headers,
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

export async function fetchMenuItems(restaurantId: string): Promise<MenuItem[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${BASE}/api/restaurants/menu-items/?restaurant_id=${restaurantId}`,
    {
      headers: headers,
    }
  );

  if (!res.ok) {
    throw new Error("Lấy danh sách menu thất bại");
  }

  return res.json();
}

export async function createMenuItem(
  data: CreateMenuItemPayload
): Promise<{ message: string; data: MenuItem }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/menu-items/`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Tạo menu item thất bại");
  }

  return res.json();
}

export async function updateMenuItem(
  menuId: string,
  data: Partial<Omit<CreateMenuItemPayload, "restaurant_id">>
): Promise<MenuItem> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/menu-items/${menuId}/`, {
    method: "PUT",
    headers: headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Cập nhật menu item thất bại");
  }

  return res.json();
}

export async function deleteMenuItem(menuId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/menu-items/${menuId}/`, {
    method: "DELETE",
    headers: headers,
  });

  if (!res.ok) {
    throw new Error("Xóa menu item thất bại");
  }
}

export async function uploadMenuItemImage(
  menuId: string,
  file: NativeFile // Mobile version
): Promise<{ message: string; data: MenuItem }> {
  const formData = new FormData();
  // @ts-ignore
  formData.append("image", {
    uri: file.uri,
    name: file.name,
    type: file.type || 'image/jpeg',
  });

  const headers = await getAuthHeadersMultipart();

  const res = await fetch(
    `${BASE}/api/restaurants/menu-items/${menuId}/upload-image/`,
    {
      method: "POST",
      headers: headers,
      body: formData,
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Upload ảnh menu thất bại");
  }

  return res.json();
}

export async function toggleMenuItemAvailability(
  menuId: string
): Promise<{ message: string; data: MenuItem }> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${BASE}/api/restaurants/menu-items/${menuId}/toggle-availability/`,
    {
      method: "POST",
      headers: headers,
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

export async function fetchTimeSlots(restaurantId: string): Promise<TimeSlot[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${BASE}/api/restaurants/time-slots/?restaurant_id=${restaurantId}`,
    {
      headers: headers,
    }
  );

  if (!res.ok) {
    throw new Error("Lấy danh sách khung giờ thất bại");
  }

  return res.json();
}

export async function createTimeSlot(
  data: CreateTimeSlotPayload
): Promise<{ message: string; data: TimeSlot }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/time-slots/`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Tạo khung giờ thất bại");
  }

  return res.json();
}

export async function updateTimeSlot(
  slotId: string,
  data: Partial<Omit<CreateTimeSlotPayload, "restaurant_id">>
): Promise<TimeSlot> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/time-slots/${slotId}/`, {
    method: "PUT",
    headers: headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Cập nhật khung giờ thất bại");
  }

  return res.json();
}

export async function deleteTimeSlot(slotId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/restaurants/time-slots/${slotId}/`, {
    method: "DELETE",
    headers: headers,
  });

  if (!res.ok) {
    throw new Error("Xóa khung giờ thất bại");
  }
}

export async function toggleTimeSlotActive(
  slotId: string
): Promise<{ message: string; data: TimeSlot }> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${BASE}/api/restaurants/time-slots/${slotId}/toggle-active/`,
    {
      method: "POST",
      headers: headers,
    }
  );

  if (!res.ok) {
    throw new Error("Cập nhật trạng thái thất bại");
  }

  return res.json();
}

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

  const headers = await getAuthHeaders();
  const res = await fetch(
    `${BASE}/api/restaurants/time-slots/check-availability/`,
    {
      method: "POST",
      headers: headers,
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
  customer_name: string;
  customer_phone: string;
  restaurant_name: string;
  restaurant_address: string;
  booking_date: string;
  time_slot_display: string;
  number_of_guests: number;
  status: string;
  status_display: string;
  created_at: string;
};

export type CreateBookingPayload = {
  restaurant: number;
  time_slot: number;
  booking_date: string; // "YYYY-MM-DD"
  number_of_guests: number;
  special_request?: string;
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

  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    headers: headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Lấy danh sách booking thất bại');
  }

  const data = await res.json();
  return data.data || data;
}

export async function fetchBooking(id: string | number): Promise<Booking> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/bookings/${id}/`, {
    headers: headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Lấy thông tin booking thất bại');
  }

  const data = await res.json();
  return data.data || data;
}

export async function createBooking(
  payload: CreateBookingPayload
): Promise<{ message: string; data: Booking }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/bookings/`, {
    method: 'POST',
    headers: headers,
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

export async function cancelBooking(id: string | number): Promise<{ message: string; data: Booking }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/bookings/${id}/cancel/`, {
    method: 'PUT',
    headers: headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Hủy booking thất bại');
  }

  return res.json();
}

export async function confirmBooking(id: string | number): Promise<{ message: string; data: Booking }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/bookings/${id}/confirm/`, {
    method: 'PUT',
    headers: headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Xác nhận booking thất bại');
  }

  return res.json();
}

export async function rejectBooking(id: string | number): Promise<{ message: string; data: Booking }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/bookings/${id}/reject/`, {
    method: 'PUT',
    headers: headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Từ chối booking thất bại');
  }

  return res.json();
}

export async function completeBooking(id: string | number): Promise<{ message: string; data: Booking }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/bookings/${id}/complete/`, {
    method: 'PUT',
    headers: headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Đánh dấu hoàn thành thất bại');
  }

  return res.json();
}

export async function markNoShow(id: string | number): Promise<{ message: string; data: Booking }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/bookings/${id}/no-show/`, {
    method: 'PUT',
    headers: headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Đánh dấu no-show thất bại');
  }

  return res.json();
}

export async function checkAvailability(
  payload: CheckAvailabilityPayload
): Promise<CheckAvailabilityResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/bookings/check-availability/`, {
    method: 'POST',
    headers: headers,
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

  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    headers: headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Lấy danh sách thông báo thất bại');
  }

  return res.json();
}

export async function fetchNotification(id: string | number): Promise<{ data: Notification }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/notifications/${id}/`, {
    headers: headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Lấy thông tin thông báo thất bại');
  }

  return res.json();
}

export async function deleteNotification(id: string | number): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/notifications/${id}/`, {
    method: 'DELETE',
    headers: headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Xóa thông báo thất bại');
  }

  return res.json();
}

export async function markNotificationAsRead(
  id: string | number
): Promise<{ message: string; data: Notification }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/notifications/${id}/mark-read/`, {
    method: 'PUT',
    headers: headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Đánh dấu đã đọc thất bại');
  }

  return res.json();
}

export async function markAllNotificationsAsRead(): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/notifications/mark-all-read/`, {
    method: 'POST',
    headers: headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Đánh dấu tất cả đã đọc thất bại');
  }

  return res.json();
}

export async function deleteAllReadNotifications(): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/notifications/delete-all-read/`, {
    method: 'DELETE',
    headers: headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Xóa thông báo đã đọc thất bại');
  }

  return res.json();
}

export async function getUnreadNotificationCount(): Promise<{ unread_count: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/notifications/unread-count/`, {
    headers: headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Lấy số thông báo chưa đọc thất bại');
  }

  return res.json();
}

export function getNotificationTypeDisplay(type: string): string {
  const typeMap: Record<string, string> = {
    'BOOKING': 'Đặt bàn',
    'RESTAURANT': 'Nhà hàng',
    'SYSTEM': 'Hệ thống'
  };
  return typeMap[type] || type;
}

export function getNotificationTypeColor(type: string): string {
  const colorMap: Record<string, string> = {
    'BOOKING': 'text-blue-400 bg-blue-500/20',
    'RESTAURANT': 'text-green-400 bg-green-500/20',
    'SYSTEM': 'text-purple-400 bg-purple-500/20'
  };
  return colorMap[type] || 'text-gray-400 bg-gray-500/20';
}

export function getNotificationTypeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    'BOOKING': '📅',
    'RESTAURANT': '🍽️',
    'SYSTEM': '🔔'
  };
  return iconMap[type] || '📬';
}

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

    const headers = await getAuthHeaders();
    const res = await fetch(url, {
      method: 'GET',
      headers: headers,
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






/**
 * Tìm kiếm nhà hàng (Dùng cho Home Screen)
 */
export async function searchRestaurants(params: {
  query?: string;
  city?: string;
  district?: string;
  ward?: string;
}): Promise<Restaurant[]> {
  const queryParams = new URLSearchParams();
  if (params.query) queryParams.append("query", params.query);
  if (params.city) queryParams.append("city", params.city);
  if (params.district) queryParams.append("district", params.district);
  if (params.ward) queryParams.append("ward", params.ward);

  const headers = await getAuthHeaders();
  // Gọi endpoint search riêng
  const res = await fetch(`${BASE}/api/restaurants/restaurants/search/?${queryParams.toString()}`, {
    headers: headers,
  });

  if (!res.ok) {
    // Fallback nếu không có endpoint search thì gọi list thường
    return fetchRestaurants(); 
  }

  const data = await res.json();
  // Backend có thể trả về { results: [...] } hoặc [...]
  return data.results || data; 
}

/**
 * Logout phía server (Gửi refresh token để blacklist)
 */
export async function logoutUser(): Promise<void> {
  try {
    const refresh = await SecureStore.getItemAsync("refresh");
    const headers = await getAuthHeaders();
    
    if (refresh) {
      await fetch(`${BASE}/api/accounts/logout/`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ refresh }),
      });
    }
  } catch (err) {
    console.log("Logout server error (ignore):", err);
  } finally {
    // Xóa sạch token trong máy
    await logout(); 
  }
}