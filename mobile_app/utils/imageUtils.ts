// src/utils/imageUtils.ts

// ⚠️ QUAN TRỌNG: Phải trùng khớp với BASE trong api.ts
// Thay đổi địa chỉ IP này thành IP LAN máy tính của bạn
const BASE = "http://127.0.0.1:8000"; 

/**
 * Build full URL từ relative image path
 * @param relativePath - Đường dẫn tương đối từ backend (vd: "menu_items/abc.jpg")
 * @returns Full URL để hiển thị ảnh
 */
export function buildImageUrl(relativePath: string | null | undefined): string {
  if (!relativePath) return '';
  
  // Nếu đã là full URL thì return luôn
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  
  // Xóa leading slash nếu có
  const cleanPath = relativePath.startsWith('/') 
    ? relativePath.slice(1) 
    : relativePath;
  
  return `${BASE}/media/${cleanPath}`;
}

/**
 * Placeholder image (Dùng URL online cho tiện trên mobile)
 */
export const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400x300.png?text=No+Image';