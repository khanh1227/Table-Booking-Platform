// src/lib/imageUtils.ts

/**
 * Build full URL từ relative image path
 * @param relativePath - Đường dẫn tương đối từ backend (vd: "menu_items/abc.jpg")
 * @returns Full URL để hiển thị ảnh
 */
export function buildImageUrl(relativePath: string | null | undefined): string {
  if (!relativePath) return '';
  
  const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
  
  // Nếu đã là full URL thì return luôn
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  
  // Xóa leading slash nếu có và chuẩn hóa dấu gạch chéo cho Windows
  const cleanPath = (relativePath.startsWith('/') ? relativePath.slice(1) : relativePath)
    .replace(/\\/g, '/');
  
  return `${BASE}/media/${cleanPath}`;
}

export function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const img = e.currentTarget;
  // Prevent infinite loops if the placeholder itself fails
  if (img.dataset.triedFallback === 'true') {
    return;
  }
  img.dataset.triedFallback = 'true';
  img.src = PLACEHOLDER_IMAGE;
}

export const PLACEHOLDER_IMAGE = '/images/placeholder.png';