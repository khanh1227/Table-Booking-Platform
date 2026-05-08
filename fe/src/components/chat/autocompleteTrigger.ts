const RESTAURANT_TRIGGER_PATTERNS: RegExp[] = [
  /(?:^|\s)(?:nhà\s*hàng|nha\s*hang)\s+([^.?!,\n]*)$/i,
  /(?:^|\s)(?:quán|quan)\s+([^.?!,\n]*)$/i,
  /(?:^|\s)(?:đặt|dat)\s*(?:bàn|ban)\s+(?:ở|o|tại|tai)\s+([^.?!,\n]*)$/i,
];

export function extractRestaurantSegment(query: string): string {
  const normalized = query.trim();
  for (const pattern of RESTAURANT_TRIGGER_PATTERNS) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return "";
}

export function shouldEnableRestaurantAutocomplete(query: string): boolean {
  return extractRestaurantSegment(query).length >= 2;
}
