import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

// LƯU Ý: Đổi địa chỉ này thành IP máy tính của bạn khi test trên điện thoại thật
const API_IP = "10.57.0.23";
export const BASE_URL = `http://${API_IP}:8000`;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getAbsoluteUrl = (path: string | null | undefined) => {
  if (!path || path === "" || path === "null" || path === "None" || path === "undefined") return null;
  
  const pathStr = String(path);
  // Nếu path chỉ chứa phần mở rộng hoặc quá ngắn (ví dụ: "media/")
  if (pathStr.trim() === "media/" || pathStr.trim() === "/media/") return null;

  if (pathStr.startsWith('http')) {
    // Thay thế tất cả các biến thể localhost về IP máy tính
    return pathStr.replace('127.0.0.1', API_IP).replace('localhost', API_IP).replace('10.0.2.2', API_IP);
  }

  // Chuẩn hóa dấu gạch chéo cho Windows (\ -> /)
  let cleanPath = pathStr.replace(/\\/g, '/');
  
  // Xóa leading slash nếu có
  if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.slice(1);
  }

  // Nếu path chưa có media/, bổ sung vào (vì Django serve media tại /media/)
  if (!cleanPath.startsWith('media/')) {
    cleanPath = `media/${cleanPath}`;
  }
  
  // Kiểm tra nếu sau khi xử lý chỉ còn "media/"
  if (cleanPath === "media/") return null;
  
  return `${BASE_URL}/${cleanPath}`;
};

// Helper để lấy token
export const getTokens = async () => {
  const access = await AsyncStorage.getItem('access');
  const refresh = await AsyncStorage.getItem('refresh');
  return { access, refresh };
};

// Interceptor cho Request: Thêm Authorization header
api.interceptors.request.use(
  async (config) => {
    const { access } = await getTokens();
    if (access) {
      config.headers.Authorization = `Bearer ${access}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor cho Response: Xử lý 401 và refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const { refresh } = await getTokens();

      if (refresh) {
        try {
          const res = await axios.post(`${BASE_URL}/api/accounts/token/refresh/`, { refresh });
          const { access } = res.data;
          await AsyncStorage.setItem('access', access);
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh token hết hạn hoặc lỗi -> Xóa session và thử lại request lần cuối không có token
          await AsyncStorage.multiRemove(['access', 'refresh', 'user']);
          delete originalRequest.headers.Authorization;
          return api(originalRequest);
        }
      } else {
        // Không có refresh token -> Thử lại không có token
        delete originalRequest.headers.Authorization;
        return api(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ======================== AUTH SERVICES ========================

export const onLogin = async (phone_number: string, password: string) => {
  const res = await api.post('/api/accounts/login/', { phone_number, password });
  const { tokens, user, customer, partner } = res.data;

  await AsyncStorage.setItem('access', tokens.access);
  await AsyncStorage.setItem('refresh', tokens.refresh);
  
  const userToSave = { ...user };
  if (customer) userToSave.customer_id = customer.id;
  if (partner) userToSave.partner_id = partner.id;
  
  await AsyncStorage.setItem('user', JSON.stringify(userToSave));
  return res.data;
};

export const onRegister = async (payload: any) => {
  const res = await api.post('/api/accounts/register/', payload);
  return res.data;
};

export const onLogout = async () => {
  const { refresh } = await getTokens();
  try {
    await api.post('/api/accounts/logout/', { refresh });
  } finally {
    await AsyncStorage.multiRemove(['access', 'refresh', 'user']);
    router.replace('/login');
  }
};

// ======================== RESTAURANT SERVICES ========================

export const fetchRestaurants = async (
  search?: string, 
  ordering?: string, 
  page?: number, 
  lat?: number | null, 
  lng?: number | null,
  min_rating?: string | null,
  price_range?: string[]
) => {
  const params: any = {};
  
  // Map parameters to match backend 'search' action
  if (search && search !== 'Tất cả') params.cuisine = search;
  if (page) params.page = page;
  if (lat) params.lat = lat;
  if (lng) params.lng = lng;
  if (min_rating) params.min_rating = min_rating;
  
  if (price_range && price_range.length > 0) {
    params.price_range = price_range.join(',');
  }

  // Map ordering to sort_by
  if (ordering) {
    const sortMap: any = {
      '-rating': 'rating_desc',
      'near_me': 'near_me',
      '-created_at': 'newest',
      'price_asc': 'price_asc',
      'price_desc': 'price_desc'
    };
    params.sort_by = sortMap[ordering] || ordering;
  }

  const res = await api.get('/api/restaurants/restaurants/search/', { params });
  return res.data;
};

export const fetchRestaurantDetail = async (id: number | string) => {
  const res = await api.get(`/api/restaurants/restaurants/${id}/`);
  return res.data;
};

export const toggleFavorite = async (restaurantId: number | string) => {
  const res = await api.post(`/api/restaurants/restaurants/${restaurantId}/toggle_favorite/`);
  return res.data;
};

export const fetchBookings = async () => {
  const res = await api.get('/api/bookings/?is_personal=true');
  return res.data.results ?? res.data;
};

export const cancelBooking = async (id: number) => {
  const res = await api.put(`/api/bookings/${id}/cancel/`);
  return res.data;
};

export const createReview = async (formData: FormData) => {
  const res = await api.post('/api/reviews/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const smartSearch = async (query: string, city?: string, district?: string, lat?: number | null, lng?: number | null) => {
  const params: any = { q: query };
  if (city) params.city = city;
  if (district) params.district = district;
  if (lat) params.lat = lat;
  if (lng) params.lng = lng;
  
  const res = await api.get('/api/restaurants/restaurants/smart-search/', { params });
  return res.data;
};

export const fetchCollections = async () => {
  const res = await api.get('/api/discovery/collections/');
  return res.data.results ?? res.data;
};

export const fetchCollectionDetail = async (id: number | string) => {
  const res = await api.get(`/api/discovery/collections/${id}/`);
  return res.data;
};

export const fetchPosts = async (category?: string, query?: string) => {
  const params: any = {};
  if (category && category !== 'all') params.category = category;
  if (query) params.search = query;
  const res = await api.get('/api/community/posts/', { params });
  return res.data.results ?? res.data;
};

export const createPost = async (formData: FormData) => {
  const res = await api.post('/api/community/posts/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const fetchPostDetail = async (slug: string) => {
  const res = await api.get(`/api/community/posts/${slug}/`);
  return res.data;
};

export const toggleLikePost = async (slug: string) => {
  const res = await api.post(`/api/community/posts/${slug}/toggle_like/`);
  return res.data;
};

export const addComment = async (payload: { post: number, content: string }) => {
  const res = await api.post('/api/community/comments/', payload);
  return res.data;
};

export const fetchFavorites = async () => {
  const res = await api.get('/api/restaurants/restaurants/favorites/');
  return res.data.results ?? res.data;
};

export const fetchUserVouchers = async () => {
  const res = await api.get('/api/promotions/my-vouchers/');
  return res.data.results ?? res.data;
};

export const submitReview = async (formData: FormData) => {
  const res = await api.post('/api/reviews/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const fetchDepositPolicy = async (restaurantId: number | string) => {
  const res = await api.get(`/api/payments/deposit-policies/?restaurant_id=${restaurantId}`);
  const data = res.data.results ?? res.data;
  return Array.isArray(data) ? (data[0] ?? null) : data;
};

export const createVNPAYUrl = async (bookingId: number | string) => {
  const res = await api.post('/api/payments/create-vnpay-url/', { booking_id: bookingId });
  return res.data;
};

export const uploadAvatar = async (formData: FormData) => {
  const res = await api.post('/api/accounts/avatar/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const changePassword = async (payload: any) => {
  const res = await api.put('/api/accounts/change-password/', payload);
  return res.data;
};

export const fetchProfile = async () => {
  const res = await api.get('/api/accounts/profile/');
  return res.data;
};

export const updateProfile = async (payload: any) => {
  const res = await api.put('/api/accounts/profile/', payload);
  return res.data;
};

export const CHATBOT_URL = `http://${API_IP}:8001`;

export const sendMessageToAI = async (message: string, session_key?: string, user_id?: number) => {
  const res = await axios.post(`${CHATBOT_URL}/chat`, {
    message,
    session_key,
    user_id
  });
  return res.data;
};

export const fetchNotifications = async () => {
  const res = await api.get('/api/notifications/');
  return res.data.data || [];
};

export const markNotificationAsRead = async (id: number) => {
  const res = await api.put(`/api/notifications/${id}/mark_read/`);
  return res.data;
};

export const markAllNotificationsAsRead = async () => {
  const res = await api.post('/api/notifications/mark_all_read/');
  return res.data;
};

export const fetchRewardVouchers = async () => {
  const res = await api.get('/api/promotions/vouchers/');
  return res.data.results ?? res.data;
};
export const fetchTransactions = async () => {
  const res = await api.get('/api/payments/transactions/');
  return res.data.results ?? res.data;
};

export const collectVoucher = async (voucherId: number | string) => {
  const res = await api.post(`/api/promotions/vouchers/${voucherId}/collect/`);
  return res.data;
};

export const fetchRestaurantVouchers = async (restaurantId: number | string) => {
  const res = await api.get(`/api/promotions/vouchers/?restaurant_id=${restaurantId}`);
  return res.data.results ?? res.data;
};

export const reportRestaurant = async (restaurantId: number | string, reason: string) => {
  const res = await api.post(`/api/restaurants/restaurants/${restaurantId}/report/`, { reason });
  return res.data;
};

export const reportReview = async (reviewId: number | string, reason: string) => {
  const res = await api.post(`/api/reviews/${reviewId}/report/`, { reason });
  return res.data;
};

export const fetchTopRatedRestaurants = async (limit: number = 4) => {
  const res = await api.get(`/api/restaurants/restaurants/top-rated/?limit=${limit}`);
  return res.data;
};
