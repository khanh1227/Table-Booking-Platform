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

export function getAuthHeaders(extra?: HeadersInit): HeadersInit {
  const access = localStorage.getItem("access");
  return {
    "Content-Type": "application/json",
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
    ...(extra || {}),
  };
}

export function getAuthHeadersMultipart(): HeadersInit {
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
    if (!res.ok) return { error: "ÄÄƒng xuáº¥t khĂ´ng hoĂ n toĂ n, nhÆ°ng phiĂªn lĂ m viá»‡c Ä‘Ă£ xĂ³a." };
    return {};
  } catch (err) {
    clearAuth();
    return { error: "CĂ³ lá»—i xáº£y ra khi Ä‘Äƒng xuáº¥t." };
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

  // LÆ°u user + role Ä‘á»ƒ Partner page dĂ¹ng
  if (data.user) {
    const userToSave = { ...data.user };
    if (data.partner) {
      userToSave.partner_id = data.partner.id;
      userToSave.partner = data.partner;
    }
    if (data.customer) {
      userToSave.customer_id = data.customer.id;
      userToSave.customer = data.customer;
    }
    localStorage.setItem("user", JSON.stringify(userToSave));
  }
  return {};
}

/**
 * Láº¥y thĂ´ng tin profile Ä‘áº§y Ä‘á»§ cá»§a user hiá»‡n táº¡i
 */
export async function fetchProfile(): Promise<any> {
  const res = await apiFetch(`${BASE}/api/accounts/profile/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("KhĂ´ng thá»ƒ táº£i thĂ´ng tin cĂ¡ nhĂ¢n");
  const data = await res.json();
  // Cáº­p nháº­t láº¡i localStorage user
  if (data.user) {
    const userToSave = { ...data.user };
    if (data.partner) userToSave.partner = data.partner;
    if (data.customer) userToSave.customer = data.customer;
    localStorage.setItem("user", JSON.stringify(userToSave));
  }
  return data;
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
      "Cáº­p nháº­t há»“ sÆ¡ tháº¥t báº¡i";
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
 * Táº¡o Location má»›i
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
      "Táº¡o location tháº¥t báº¡i";
    throw new Error(String(msg));
  }

  return data as Location;
}

/**
 * Láº¥y danh sĂ¡ch Location
 * GET /api/restaurants/locations/
 */
export async function fetchLocations(): Promise<Location[]> {
  const res = await apiFetch(`${BASE}/api/restaurants/locations/`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Láº¥y danh sĂ¡ch location tháº¥t báº¡i");
  }

  return res.json();
}

/**
 * Cáº­p nháº­t Location
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
      "Cáº­p nháº­t location tháº¥t báº¡i";
    throw new Error(String(msg));
  }

  return data as Location;
}

/**
 * XoĂ¡ Location
 * DELETE /api/restaurants/locations/{id}/
 */
export async function deleteLocation(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/api/restaurants/locations/${id}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("XĂ³a location tháº¥t báº¡i");
  }
}

// ======================== RESTAURANTS (PARTNER) ========================

export type Restaurant = {
  id: number;
  name: string;
  address: string;
  phone_number?: string;
  cuisine_type?: string;
  price_range?: string;
  status: "PENDING" | "APPROVED" | "SUSPENDED" | "CLOSED";
  rating: number;
  location?: {
    id: number;
    city: string;
    district?: string;
    ward?: string;
  };
  description?: string;
  opening_hours?: string;
  slot_duration?: number;
  partner_name?: string;
  image_count?: number;
  is_favorite?: boolean;
  partner?: number;
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
  price_range?: string;
  slot_duration?: number;
  location_id?: number;
};


/**
 * Láº¥y danh sĂ¡ch restaurants (PUBLIC - táº¥t cáº£ APPROVED)
 * GET /api/restaurants/restaurants/
 * DĂ¹ng cho: Customer browse, public listing
 */
export async function fetchRestaurants(): Promise<Restaurant[]> {
  const res = await apiFetch(`${BASE}/api/restaurants/restaurants/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Láº¥y danh sĂ¡ch nhĂ  hĂ ng tháº¥t báº¡i");
  }

  const data = await res.json();
  // Handle both paginated {results:[]} and plain array responses
  return data.results ?? data.data ?? data;
}

/**
 * Láº¥y danh sĂ¡ch nhĂ  hĂ ng Cá»¦A MĂŒNH (Partner Dashboard)
 * GET /api/restaurants/restaurants/my-restaurants/
 * DĂ¹ng cho: Partner quáº£n lĂ½ nhĂ  hĂ ng cá»§a mĂ¬nh
 */
export async function fetchMyRestaurants(): Promise<Restaurant[]> {
  const res = await apiFetch(`${BASE}/api/restaurants/restaurants/my-restaurants/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Láº¥y danh sĂ¡ch nhĂ  hĂ ng cá»§a báº¡n tháº¥t báº¡i");
  }

  const data = await res.json();
  return data.results ?? data.data ?? data;
}
/**
 * Láº¥y chi tiáº¿t restaurant (kĂ¨m images, menu, slots)
 * GET /api/restaurants/restaurants/{id}/
 */
export async function fetchRestaurant(id: string): Promise<RestaurantDetail> {
  const res = await apiFetch(`${BASE}/api/restaurants/restaurants/${id}/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Láº¥y thĂ´ng tin nhĂ  hĂ ng tháº¥t báº¡i");
  }

  return res.json();
}

/**
 * Táº¡o restaurant má»›i (status sáº½ lĂ  PENDING)
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
    throw new Error(error.error || "Táº¡o nhĂ  hĂ ng tháº¥t báº¡i");
  }

  return res.json();
}

/**
 * Cáº­p nháº­t restaurant
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
    throw new Error(error.error || "Cáº­p nháº­t nhĂ  hĂ ng tháº¥t báº¡i");
  }

  return res.json();
}

/**
 * XĂ³a restaurant
 * DELETE /api/restaurants/restaurants/{id}/
 */
export async function deleteRestaurant(id: string): Promise<void> {
  const res = await apiFetch(`${BASE}/api/restaurants/restaurants/${id}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("XĂ³a nhĂ  hĂ ng tháº¥t báº¡i");
  }
}

/**
 * Láº¥y danh sĂ¡ch time slots cĂ²n trá»‘ng cho ngĂ y cá»¥ thá»ƒ
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
    throw new Error(error.error || "Láº¥y khung giá» trá»‘ng tháº¥t báº¡i");
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
 * Láº¥y danh sĂ¡ch áº£nh cá»§a restaurant
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
    throw new Error("Láº¥y danh sĂ¡ch áº£nh tháº¥t báº¡i");
  }

  const data = await res.json();
  return data.results ?? data.data ?? data;
}

/**
 * Upload áº£nh lĂªn Django Backend
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
    throw new Error(error.error || "Upload áº£nh tháº¥t báº¡i");
  }

  return res.json();
}

/**
 * XĂ³a áº£nh
 * DELETE /api/restaurants/images/{id}/
 */
export async function deleteRestaurantImage(imageId: string): Promise<void> {
  const res = await apiFetch(`${BASE}/api/restaurants/images/${imageId}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("XĂ³a áº£nh tháº¥t báº¡i");
  }
}

/**
 * Cáº­p nháº­t thá»© tá»± hiá»ƒn thá»‹ áº£nh
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
    throw new Error(error.error || "Cáº­p nháº­t thá»© tá»± áº£nh tháº¥t báº¡i");
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
 * Láº¥y menu cá»§a restaurant
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
    throw new Error("Láº¥y danh sĂ¡ch menu tháº¥t báº¡i");
  }

  const data = await res.json();
  return data.results ?? data.data ?? data;
}

/**
 * Táº¡o menu item má»›i
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
    throw new Error(error.error || "Táº¡o menu item tháº¥t báº¡i");
  }

  return res.json();
}

/**
 * Cáº­p nháº­t menu item
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
    throw new Error(error.error || "Cáº­p nháº­t menu item tháº¥t báº¡i");
  }

  return res.json();
}

/**
 * XĂ³a menu item
 * DELETE /api/restaurants/menu-items/{id}/
 */
export async function deleteMenuItem(menuId: string): Promise<void> {
  const res = await apiFetch(`${BASE}/api/restaurants/menu-items/${menuId}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("XĂ³a menu item tháº¥t báº¡i");
  }
}

/**
 * Upload áº£nh cho menu item
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
    throw new Error(error.error || "Upload áº£nh menu tháº¥t báº¡i");
  }

  return res.json();
}

/**
 * Báº­t/táº¯t menu item
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
    throw new Error("Cáº­p nháº­t tráº¡ng thĂ¡i tháº¥t báº¡i");
  }

  return res.json();
}

// ======================== TIME SLOTS ========================

export type TimeSlot = {
  id: number;
  start_time: string; // "HH:MM:SS"
  max_bookings: number;
  max_guests_per_booking: number; // Sá»‘ khĂ¡ch tá»‘i Ä‘a/Ä‘Æ¡n
  is_active: boolean;
};

export type CreateTimeSlotPayload = {
  restaurant_id: number;
  start_time: string;
  max_bookings?: number;
  max_guests_per_booking?: number; // â† THĂM
  is_active?: boolean;
};

/**
 * Láº¥y danh sĂ¡ch time slots cá»§a restaurant
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
    throw new Error("Láº¥y danh sĂ¡ch khung giá» tháº¥t báº¡i");
  }

  const data = await res.json();
  return data.results ?? data.data ?? data;
}

/**
 * Táº¡o time slot má»›i
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
    throw new Error(error.error || "Táº¡o khung giá» tháº¥t báº¡i");
  }

  return res.json();
}

/**
 * Cáº­p nháº­t time slot
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
    throw new Error(error.error || "Cáº­p nháº­t khung giá» tháº¥t báº¡i");
  }

  return res.json();
}

/**
 * XĂ³a time slot
 * DELETE /api/restaurants/time-slots/{id}/
 */
export async function deleteTimeSlot(slotId: string): Promise<void> {
  const res = await apiFetch(`${BASE}/api/restaurants/time-slots/${slotId}/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("XĂ³a khung giá» tháº¥t báº¡i");
  }
}

/**
 * Báº­t/táº¯t time slot
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
    throw new Error("Cáº­p nháº­t tráº¡ng thĂ¡i tháº¥t báº¡i");
  }

  return res.json();
}

/**
 * Kiá»ƒm tra slot cĂ²n chá»— trá»‘ng khĂ´ng
 * POST /api/restaurants/time-slots/check-availability/
 * 
 * Náº¿u cĂ³ time_slot_id: tráº£ vá» info cá»§a slot Ä‘Ă³
 * Náº¿u khĂ´ng cĂ³: tráº£ vá» list táº¥t cáº£ slots available
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
    throw new Error(error.error || "Kiá»ƒm tra khung giá» tháº¥t báº¡i");
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
    display: string; // "HH:MM"
  };
  number_of_guests: number;
  special_request?: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  status_display: string;
  created_at: string;
  confirmed_at?: string;
  deposit_expires_at?: string;
  deposit_refund_status?: 'NONE' | 'PENDING' | 'SUCCESS' | 'FAILED';
  finalized_at?: string;
  settlement_available_at?: string | null;
  rejection_reason?: string;
  can_cancel: boolean;
  can_confirm: boolean;
  can_reject: boolean;
  is_deposit_paid: boolean;
  deposit_amount: string;
};

export type BookingListItem = {
  id: number;
  restaurant: number; // ID nhĂ  hĂ ng
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
  deposit_expires_at?: string;
  deposit_refund_status?: 'NONE' | 'PENDING' | 'SUCCESS' | 'FAILED';
  settlement_available_at?: string | null;
  is_deposit_paid: boolean;
  deposit_amount: string;
  can_cancel: boolean;
  is_expired: boolean;
  rejection_reason?: string;
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
  time_slot_id?: number; // optional - náº¿u cĂ³ thĂ¬ check slot cá»¥ thá»ƒ
};

export type SlotAvailability = {
  id: number;
  start_time: string;
  max_bookings: number | null;
  max_guests_per_booking: number; // â† THĂM
  current_bookings: number;
  available: boolean;
};

export type CheckAvailabilityResponse =
  | {
    // Response khi check slot cá»¥ thá»ƒ
    available: boolean;
    message: string;
    time_slot: {
      id: number;
      start_time: string;
      max_bookings: number | null;
      current_bookings: number;
    };
  }
  | {
    // Response khi check táº¥t cáº£ slots
    date: string;
    restaurant_id: number;
    restaurant_name: string;
    available_slots: SlotAvailability[];
  };

/**
 * Láº¥y danh sĂ¡ch bookings
 * GET /api/bookings/
 * - Customer: bookings cá»§a mĂ¬nh
 * - Partner: bookings cá»§a nhĂ  hĂ ng mĂ¬nh
 * - Admin: táº¥t cáº£ bookings
 */
export async function fetchBookings(params?: {
  status?: string;
  start_date?: string;
  end_date?: string;
  restaurant_id?: number;
  order_by?: string;
  page_size?: number;
  is_personal?: boolean;
}): Promise<BookingListItem[]> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);
  if (params?.restaurant_id) queryParams.append('restaurant_id', params.restaurant_id.toString());
  if (params?.order_by) queryParams.append('order_by', params.order_by);
  if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
  if (params?.is_personal) queryParams.append('is_personal', 'true');

  const url = `${BASE}/api/bookings/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  const res = await apiFetch(url, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Láº¥y danh sĂ¡ch booking tháº¥t báº¡i');
  }

  const data = await res.json();
  // Handle DRF paginated {results:[]}, custom {data:[]}, and plain array
  return data.results ?? data.data ?? data;
}

/**
 * Láº¥y chi tiáº¿t booking
 * GET /api/bookings/{id}/
 */
export async function fetchBooking(id: string | number): Promise<Booking> {
  const res = await apiFetch(`${BASE}/api/bookings/${id}/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Láº¥y thĂ´ng tin booking tháº¥t báº¡i');
  }

  const data = await res.json();
  return data.data || data;
}

/**
 * Táº¡o booking má»›i (Customer only)
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

    // Xá»­ lĂ½ validation errors
    if (typeof error === 'object' && error !== null) {
      const firstError = Object.values(error).flat()[0];
      if (firstError) {
        throw new Error(String(firstError));
      }
    }

    throw new Error(error.error || error.detail || 'Äáº·t bĂ n tháº¥t báº¡i');
  }

  return res.json();
}

/**
 * Há»§y booking (Customer only)
 * PUT /api/bookings/{id}/cancel/
 */
export async function cancelBooking(id: string | number): Promise<{ message: string; data: Booking }> {
  const res = await apiFetch(`${BASE}/api/bookings/${id}/cancel/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Há»§y booking tháº¥t báº¡i');
  }

  return res.json();
}

/**
 * XĂ¡c nháº­n booking (Partner only)
 * PUT /api/bookings/{id}/confirm/
 */
export async function bulkCreateTimeSlots(payload: {
  restaurant_id: number;
  start_time: string;
  end_time: string;
  interval: number;
  max_bookings?: number | null;
  max_guests_per_booking?: number;
}): Promise<{ message: string; data: TimeSlot[] }> {
  const res = await apiFetch(`${BASE}/api/restaurants/time-slots/bulk-create/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Bulk create tháº¥t báº¡i');
  }
  return res.json();
}

/**
 * Fetch Time Slot Overrides (Special Dates/Schedules)
 */
export async function fetchTimeSlotOverrides(restaurantId: number): Promise<any[]> {
  const res = await apiFetch(`${BASE}/api/restaurants/time-slot-overrides/?restaurant=${restaurantId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? data;
}

/**
 * Add Time Slot Override
 */
export async function addTimeSlotOverride(payload: {
  restaurant: number;
  date: string;
  time_slot?: number | null;
  max_bookings?: number | null;
  is_closed?: boolean;
  reason?: string
}): Promise<any> {
  const res = await apiFetch(`${BASE}/api/restaurants/time-slot-overrides/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'ThĂªm Ä‘iá»u chá»‰nh tháº¥t báº¡i');
  }
  return res.json();
}

/**
 * Update Time Slot Override
 */
export async function updateTimeSlotOverride(id: number, payload: any): Promise<any> {
  const res = await apiFetch(`${BASE}/api/restaurants/time-slot-overrides/${id}/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Cáº­p nháº­t Ä‘iá»u chá»‰nh tháº¥t báº¡i');
  }
  return res.json();
}

/**
 * Delete Time Slot Override
 */
export async function deleteTimeSlotOverride(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/api/restaurants/time-slot-overrides/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('XĂ³a Ä‘iá»u chá»‰nh tháº¥t báº¡i');
}

export async function confirmBooking(id: string | number): Promise<{ message: string; data: Booking }> {
  const res = await apiFetch(`${BASE}/api/bookings/${id}/confirm/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'XĂ¡c nháº­n booking tháº¥t báº¡i');
  }

  return res.json();
}

/**
 * Tá»« chá»‘i booking (Partner only)
 * PUT /api/bookings/{id}/reject/
 */
export async function rejectBooking(id: string | number, reason: string = ''): Promise<{ message: string; data: Booking }> {
  const res = await apiFetch(`${BASE}/api/bookings/${id}/reject/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ rejection_reason: reason })
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Tá»« chá»‘i booking tháº¥t báº¡i');
  }

  return res.json();
}

/**
 * HoĂ n thĂ nh booking (Partner only)
 * PUT /api/bookings/{id}/complete/
 */
export async function completeBooking(id: string | number): Promise<{ message: string; data: Booking }> {
  const res = await apiFetch(`${BASE}/api/bookings/${id}/complete/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'ÄĂ¡nh dáº¥u hoĂ n thĂ nh tháº¥t báº¡i');
  }

  return res.json();
}

/**
 * ÄĂ¡nh dáº¥u no-show (Partner only)
 * PUT /api/bookings/{id}/no-show/
 */
export async function markNoShow(id: string | number): Promise<{ message: string; data: Booking }> {
  const res = await apiFetch(`${BASE}/api/bookings/${id}/no-show/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'ÄĂ¡nh dáº¥u no-show tháº¥t báº¡i');
  }

  return res.json();
}

/**
 * Tá»± Ä‘á»™ng há»§y cĂ¡c Ä‘Æ¡n háº¿t háº¡n cá»c
 * POST /api/bookings/expire_unpaid/
 */
export async function expireUnpaidBookings(): Promise<{ message: string; expired_count: number }> {
  const res = await apiFetch(`${BASE}/api/bookings/expire_unpaid/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) return { message: 'Failed to cleanup', expired_count: 0 };
  return res.json();
}

/**
 * Kiá»ƒm tra khung giá» cĂ²n chá»— trá»‘ng
 * POST /api/bookings/check-availability/
 * 
 * Náº¿u cĂ³ time_slot_id: tráº£ vá» info cá»§a slot Ä‘Ă³
 * Náº¿u khĂ´ng cĂ³: tráº£ vá» list táº¥t cáº£ slots available
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

    // Xá»­ lĂ½ validation errors
    if (typeof error === 'object' && error !== null) {
      const firstError = Object.values(error).flat()[0];
      if (firstError) {
        throw new Error(String(firstError));
      }
    }

    throw new Error(error.error || error.detail || 'Kiá»ƒm tra khung giá» tháº¥t báº¡i');
  }

  return res.json();
}

/**
 * Helper: Get booking status display name
 */
export function getBookingStatusDisplay(status: string): string {
  const statusMap: Record<string, string> = {
    'PENDING': 'Chá» xĂ¡c nháº­n',
    'CONFIRMED': 'ÄĂ£ xĂ¡c nháº­n',
    'REJECTED': 'ÄĂ£ tá»« chá»‘i',
    'CANCELLED': 'ÄĂ£ há»§y',
    'COMPLETED': 'HoĂ n thĂ nh',
    'NO_SHOW': 'KhĂ´ng Ä‘áº¿n'
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
  time_ago: string; // "5 phĂºt trÆ°á»›c", "2 giá» trÆ°á»›c"
  related_object_type: string | null;
  related_object_id: number | null;
};

export type NotificationListResponse = {
  data: Notification[];
  unread_count: number;
};

/**
 * Láº¥y danh sĂ¡ch notifications cá»§a user hiá»‡n táº¡i
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
    throw new Error(error.error || error.detail || 'Láº¥y danh sĂ¡ch thĂ´ng bĂ¡o tháº¥t báº¡i');
  }

  return res.json();
}

/**
 * Láº¥y chi tiáº¿t notification (tá»± Ä‘á»™ng mark as read)
 * GET /api/notifications/{id}/
 */
export async function fetchNotification(id: string | number): Promise<{ data: Notification }> {
  const res = await apiFetch(`${BASE}/api/notifications/${id}/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Láº¥y thĂ´ng tin thĂ´ng bĂ¡o tháº¥t báº¡i');
  }

  return res.json();
}

/**
 * XĂ³a notification
 * DELETE /api/notifications/{id}/
 */
export async function deleteNotification(id: string | number): Promise<{ message: string }> {
  const res = await apiFetch(`${BASE}/api/notifications/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'XĂ³a thĂ´ng bĂ¡o tháº¥t báº¡i');
  }

  return res.json();
}

/**
 * ÄĂ¡nh dáº¥u notification Ä‘Ă£ Ä‘á»c
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
    throw new Error(error.error || error.detail || 'ÄĂ¡nh dáº¥u Ä‘Ă£ Ä‘á»c tháº¥t báº¡i');
  }

  return res.json();
}

/**
 * ÄĂ¡nh dáº¥u táº¥t cáº£ notifications Ä‘Ă£ Ä‘á»c
 * POST /api/notifications/mark-all-read/
 */
export async function markAllNotificationsAsRead(): Promise<{ message: string }> {
  const res = await apiFetch(`${BASE}/api/notifications/mark_all_read/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'ÄĂ¡nh dáº¥u táº¥t cáº£ Ä‘Ă£ Ä‘á»c tháº¥t báº¡i');
  }

  return res.json();
}

/**
 * XĂ³a táº¥t cáº£ notifications Ä‘Ă£ Ä‘á»c
 * DELETE /api/notifications/delete-all-read/
 */
export async function deleteAllReadNotifications(): Promise<{ message: string }> {
  const res = await apiFetch(`${BASE}/api/notifications/delete_all_read/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'XĂ³a thĂ´ng bĂ¡o Ä‘Ă£ Ä‘á»c tháº¥t báº¡i');
  }

  return res.json();
}

/**
 * Äáº¿m sá»‘ notification chÆ°a Ä‘á»c
 * GET /api/notifications/unread-count/
 */
export async function getUnreadNotificationCount(): Promise<{ unread_count: number }> {
  const res = await apiFetch(`${BASE}/api/notifications/unread-count/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Láº¥y sá»‘ thĂ´ng bĂ¡o chÆ°a Ä‘á»c tháº¥t báº¡i');
  }

  return res.json();
}

/**
 * Helper: Get notification type display name
 */
export function getNotificationTypeDisplay(type: string): string {
  const typeMap: Record<string, string> = {
    'BOOKING': 'Äáº·t bĂ n',
    'RESTAURANT': 'NhĂ  hĂ ng',
    'SYSTEM': 'Há»‡ thá»‘ng'
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
    'BOOKING': 'đŸ“…',
    'RESTAURANT': 'đŸ½ï¸',
    'SYSTEM': 'đŸ””'
  };
  return iconMap[type] || 'đŸ“¬';
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

  if (diffMins < 1) return 'Vá»«a xong';
  if (diffMins < 60) return `${diffMins} phĂºt trÆ°á»›c`;
  if (diffHours < 24) return `${diffHours} giá» trÆ°á»›c`;
  if (diffDays < 7) return `${diffDays} ngĂ y trÆ°á»›c`;

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
    const url = `${BASE}/api/bookings/partner-dashboard-stats/${restaurantId ? `?restaurant_id=${restaurantId}` : ''
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
  settlement_balance: string;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: number;
  wallet: number | null;
  booking: number | null;
  amount: string;
  transaction_type: 'DEPOSIT' | 'PAYMENT' | 'WITHDRAWAL' | 'REFUND' | 'PLATFORM_FEE';
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  payment_method: string | null;
  transaction_id: string | null;
  created_at: string;
};

/**
 * Láº¥y danh sĂ¡ch vĂ­ (thÆ°á»ng chá»‰ 1 cho Partner)
 */
export async function fetchWallets(): Promise<Wallet[]> {
  const res = await apiFetch(`${BASE}/api/payments/wallets/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Láº¥y thĂ´ng tin vĂ­ tháº¥t báº¡i");
  const data = await res.json();
  return data.results ?? data.data ?? data;
}

/**
 * Láº¥y danh sĂ¡ch giao dá»‹ch
 */
export async function fetchTransactions(): Promise<Transaction[]> {
  const res = await apiFetch(`${BASE}/api/payments/transactions/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Láº¥y danh sĂ¡ch giao dá»‹ch tháº¥t báº¡i");
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
 * Láº¥y danh sĂ¡ch banners hoáº¡t Ä‘á»™ng
 */
export async function fetchBanners(): Promise<Banner[]> {
  const res = await apiFetch(`${BASE}/api/discovery/banners/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Láº¥y danh sĂ¡ch banners tháº¥t báº¡i");
  const data = await res.json();
  return data.results ?? data.data ?? data;
}

/**
 * Láº¥y danh sĂ¡ch collections hoáº¡t Ä‘á»™ng
 */
/**
 * Láº¥y danh sĂ¡ch collections hoáº¡t Ä‘á»™ng
 */
export async function fetchCollections(): Promise<Collection[]> {
  const res = await apiFetch(`${BASE}/api/discovery/collections/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Láº¥y danh sĂ¡ch collections tháº¥t báº¡i");
  const data = await res.json();
  return data.results ?? data.data ?? data;
}

// ======================== PAYMENTS - DEPOSIT POLICY ========================

export type DepositPolicy = {
  id: number;
  restaurant: number;
  is_required: boolean;
  deposit_amount: string;
  deposit_per_guest: string; // â† THĂM
  deposit_percentage: string | null;
  minimum_guests_for_deposit: number;
};

/**
 * Láº¥y deposit policy cá»§a nhĂ  hĂ ng
 * GET /api/payments/deposit-policies/?restaurant_id=X
 */
export async function fetchDepositPolicy(restaurantId: string | number): Promise<DepositPolicy | null> {
  // Use public read endpoint to avoid role-based narrowing (PARTNER only sees own restaurants when authenticated).
  const res = await apiFetch(`${BASE}/api/payments/deposit-policies/?restaurant_id=${restaurantId}`);
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.results ?? data;
  return results.length > 0 ? results[0] : null;
}

/**
 * Táº¡o deposit policy má»›i
 */
export async function createDepositPolicy(data: {
  restaurant_id: number;
  is_required: boolean;
  deposit_per_guest: number;
  minimum_guests_for_deposit?: number;
}): Promise<DepositPolicy> {
  const res = await apiFetch(`${BASE}/api/payments/deposit-policies/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Táº¡o chĂ­nh sĂ¡ch cá»c tháº¥t báº¡i');
  }
  return (await res.json()).data;
}

/**
 * Cáº­p nháº­t deposit policy
 */
export async function updateDepositPolicy(id: number, data: Partial<DepositPolicy>): Promise<DepositPolicy> {
  const res = await apiFetch(`${BASE}/api/payments/deposit-policies/${id}/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Cáº­p nháº­t chĂ­nh sĂ¡ch cá»c tháº¥t báº¡i');
  }
  return (await res.json()).data;
}

/**
 * Láº¥y URL thanh toĂ¡n VNPAY tá»« Backend
 * POST /api/payments/create-vnpay-url/
 */
export async function createVNPAYUrl(bookingId: number): Promise<{ payment_url: string }> {
  const res = await apiFetch(`${BASE}/api/payments/create-vnpay-url/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ booking_id: bookingId }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Táº¡o URL thanh toĂ¡n tháº¥t báº¡i');
  }
  return res.json();
}

export async function verifyVNPAYReturn(search: string): Promise<{
  success: boolean;
  message: string;
  booking?: {
    id: number;
    status: string;
    is_deposit_paid: boolean;
    deposit_refund_status?: string;
  } | null;
}> {
  const res = await apiFetch(`${BASE}/api/payments/verify-vnpay-return/${search}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.message || 'XĂ¡c minh thanh toĂ¡n tháº¥t báº¡i');
  }
  return res.json();
}

export type PlatformRevenueStats = {
  summary: {
    platform_fee_rate: string;
    total_platform_revenue: number;
    total_fee_transactions: number;
    average_fee_per_booking: number;
  };
  recent_fees: Array<{
    id: number;
    booking_id: number | null;
    restaurant_name: string;
    amount: number;
    created_at: string;
    note?: string;
  }>;
};

export async function fetchPlatformRevenueStats(params?: {
  time_range?: '7days' | '30days' | 'thisMonth' | 'custom';
  start_date?: string;
  end_date?: string;
}): Promise<PlatformRevenueStats> {
  const query = new URLSearchParams();
  query.set('time_range', params?.time_range || '30days');
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);

  const res = await apiFetch(`${BASE}/api/payments/platform-revenue/?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Không tải được thống kê thu nhập nền tảng');
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
  points_cost?: number; // Sáº½ cĂ³ Ä‘iá»ƒm náº¿u voucher nĂ y cáº§n dĂ¹ng Ä‘iá»ƒm Ä‘á»ƒ Ä‘á»•i
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
 * Láº¥y danh sĂ¡ch voucher kháº£ dá»¥ng cho Ä‘áº·t bĂ n táº¡i nhĂ  hĂ ng cá»¥ thá»ƒ
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
 * Láº¥y danh sĂ¡ch voucher trong vĂ­ cá»§a Customer
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
 * Láº¥y danh sĂ¡ch táº¥t cáº£ voucher (hoáº¡t Ä‘á»™ng) Ä‘á»ƒ Ä‘á»•i Ä‘iá»ƒm
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
 * Thu tháº­p (collect) voucher
 * POST /api/promotions/vouchers/{id}/collect/
 */
export async function collectVoucher(voucherId: number): Promise<{ message: string, loyalty_points?: number }> {
  const res = await apiFetch(`${BASE}/api/promotions/vouchers/${voucherId}/collect/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Thu tháº­p voucher tháº¥t báº¡i');
  }
  return res.json();
}

// ======================== DISCOVERY CRUD ========================

/**
 * Táº¡o collection má»›i
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
    throw new Error(error.error || 'Táº¡o bá»™ sÆ°u táº­p tháº¥t báº¡i');
  }
  return res.json();
}

/**
 * XĂ³a collection
 */
export async function deleteCollection(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/api/discovery/collections/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('XĂ³a bá»™ sÆ°u táº­p tháº¥t báº¡i');
}

/**
 * ThĂªm nhĂ  hĂ ng vĂ o collection
 */
export async function addRestaurantToCollection(collectionId: number, restaurantId: number): Promise<{ message: string }> {
  const res = await apiFetch(`${BASE}/api/discovery/collections/${collectionId}/add-restaurant/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ restaurant_id: restaurantId }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'ThĂªm nhĂ  hĂ ng tháº¥t báº¡i');
  }
  return res.json();
}

/**
 * XĂ³a nhĂ  hĂ ng khá»i collection
 */
export async function removeRestaurantFromCollection(collectionId: number, restaurantId: number): Promise<{ message: string }> {
  const res = await apiFetch(`${BASE}/api/discovery/collections/${collectionId}/remove-restaurant/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ restaurant_id: restaurantId }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'XĂ³a nhĂ  hĂ ng tháº¥t báº¡i');
  }
  return res.json();
}

/**
 * Táº¡o banner má»›i
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
    throw new Error(error.error || 'Táº¡o banner tháº¥t báº¡i');
  }
  return res.json();
}

/**
 * XĂ³a banner
 */
export async function deleteBanner(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/api/discovery/banners/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('XĂ³a banner tháº¥t báº¡i');
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
 * Táº¡o voucher má»›i (Partner)
 */
export async function createVoucher(data: CreateVoucherPayload): Promise<any> {
  const res = await apiFetch(`${BASE}/api/promotions/vouchers/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Táº¡o voucher tháº¥t báº¡i');
  }
  return res.json();
}

/**
 * Cáº­p nháº­t voucher (Partner)
 */
export async function updateVoucher(id: number, data: Partial<CreateVoucherPayload>): Promise<any> {
  const res = await apiFetch(`${BASE}/api/promotions/vouchers/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Cáº­p nháº­t voucher tháº¥t báº¡i');
  }
  return res.json();
}

/**
 * XĂ³a voucher (Partner)
 */
export async function deleteVoucher(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/api/promotions/vouchers/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('XĂ³a voucher tháº¥t báº¡i');
}


// ======================== REVIEWS (PARTNER) ========================

export type Review = {
  id: number;
  customer_name: string;
  restaurant_name: string;
  restaurant: number;
  rating: number;
  comment: string;
  created_at: string;
  is_read_by_partner: boolean;
  reply?: ReviewReply;
  images: { id: number; image: string }[];
};

export type ReviewReply = {
  id: number;
  reply_content: string;
  created_at: string;
};

/**
 * Láº¥y danh sĂ¡ch review cá»§a partner
 */
export async function fetchPartnerReviews(params?: { unread_only?: boolean; restaurant_id?: string | number | null }): Promise<Review[]> {
  const query = new URLSearchParams();
  if (params?.unread_only) query.append('unread_only', 'true');
  if (params?.restaurant_id) query.append('restaurant_id', params.restaurant_id.toString());
  
  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`${BASE}/api/reviews/partner-reviews/${queryString}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Láº¥y danh sĂ¡ch Ä‘Ă¡nh giĂ¡ tháº¥t báº¡i");
  return res.json();
}

/**
 * ÄĂ¡nh dáº¥u review Ä‘Ă£ Ä‘á»c
 */
export async function markReviewAsRead(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/api/reviews/${id}/mark-read/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("ÄĂ¡nh dáº¥u Ä‘Ă£ Ä‘á»c tháº¥t báº¡i");
}

/**
 * Pháº£n há»“i Ä‘Ă¡nh giĂ¡
 */
export async function replyToReview(id: number, content: string): Promise<ReviewReply> {
  const res = await apiFetch(`${BASE}/api/reviews/${id}/reply/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reply_content: content }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Gá»­i pháº£n há»“i tháº¥t báº¡i");
  }
  return res.json();
}

export async function fetchMyProfile(): Promise<any> {
  const res = await apiFetch(`${BASE}/api/accounts/profile/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Lấy thông tin tài khoản thất bại");
  const data = await res.json();
  return data.data ?? data;
}
