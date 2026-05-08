import { buildImageUrl, PLACEHOLDER_IMAGE } from "@/lib/imageUtils";

export type PriceRange = "BUDGET" | "MEDIUM" | "PREMIUM" | string;

type RestaurantImageLike = {
  image_url?: string | null;
};

type RestaurantImageSource = {
  thumbnail?: string | null;
  images?: RestaurantImageLike[] | null;
};

export const PRICE_RANGE_COLORS: Record<string, string> = {
  BUDGET: "bg-green-50 text-green-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  PREMIUM: "bg-purple-50 text-purple-700",
};

export function getRestaurantImage(restaurant: RestaurantImageSource): string {
  if (restaurant.thumbnail) return buildImageUrl(restaurant.thumbnail);
  const firstImage = restaurant.images?.[0]?.image_url;
  if (firstImage) return buildImageUrl(firstImage);
  return PLACEHOLDER_IMAGE;
}

export function formatPrice(price: any): string {
  if (!price) return "";
  const num = Number(price);
  if (isNaN(num) || num === 0) return price;
  return new Intl.NumberFormat('vi-VN').format(num) + 'đ';
}

export function getPriceRangeSymbol(priceRange?: string): string {
  return "";
}

export function getPriceRangeLabel(priceRange?: string): string {
  if (!priceRange) return "";
  
  const p = priceRange.toUpperCase();
  if (p === "BUDGET" || p.includes("BÌNH DÂN")) return "Bình dân";
  if (p === "MEDIUM" || p.includes("TRUNG BÌNH")) return "Trung bình";
  if (p === "PREMIUM" || p.includes("CAO CẤP")) return "Cao cấp";
  
  // Xử lý số thô
  const num = parseInt(priceRange.replace(/\D/g, ""));
  if (!isNaN(num) && num > 0) {
    if (num < 100000) return "Bình dân";
    if (num <= 300000) return "Trung bình";
    return "Cao cấp";
  }
  
  return priceRange || "";
}

export function getPriceRangeDescription(priceRange?: string): string {
  const label = getPriceRangeLabel(priceRange);
  if (label === "Bình dân") return "Bình dân (Dưới 100k đ/người)";
  if (label === "Trung bình") return "Trung bình (100k–300k đ/người)";
  if (label === "Cao cấp") return "Cao cấp (Trên 300k đ/người)";
  return label;
}

export function getPriceRangeColor(priceRange?: string): string {
  if (!priceRange) return "bg-gray-50 text-gray-700";
  
  const label = getPriceRangeLabel(priceRange);
  if (label === "Bình dân") return "bg-green-50 text-green-700";
  if (label === "Trung bình") return "bg-amber-50 text-amber-700";
  if (label === "Cao cấp") return "bg-purple-50 text-purple-700";
  
  return "bg-slate-50 text-slate-700 border border-slate-100";
}
