import { buildImageUrl, PLACEHOLDER_IMAGE } from "@/lib/imageUtils";

export type PriceRange = "BUDGET" | "MEDIUM" | "PREMIUM";

type RestaurantImageLike = {
  image_url?: string | null;
};

type RestaurantImageSource = {
  thumbnail?: string | null;
  images?: RestaurantImageLike[] | null;
};

export const PRICE_RANGE_COLORS: Record<PriceRange, string> = {
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

export function getPriceRangeSymbol(priceRange?: PriceRange): string {
  if (priceRange === "BUDGET") return "₫";
  if (priceRange === "MEDIUM") return "₫₫";
  if (priceRange === "PREMIUM") return "₫₫₫";
  return "";
}

export function getPriceRangeLabel(priceRange?: PriceRange): string {
  if (priceRange === "BUDGET") return "Bình dân";
  if (priceRange === "MEDIUM") return "Trung bình";
  if (priceRange === "PREMIUM") return "Cao cấp";
  return "";
}
