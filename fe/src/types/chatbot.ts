// types/chatbot.ts

export type MessageRole = 'user' | 'bot';

export type ChatbotAction =
  | 'SHOW_INFO'
  | 'SHOW_RESTAURANTS'
  | 'SHOW_DISHES'
  | 'PREFILL_BOOKING'
  | 'ASK_CLARIFICATION'
  | 'NONE';

export type RestaurantCard = {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  rating: number;
  opening_hours: string | null;
  description: string;
  image_url?: string | null;
};

export type DishCard = {
  id: number;
  name: string;
  price: number;
  category: string;
  description: string;
  restaurant: { id: number; name: string };
  image_url?: string | null;
};

export type PrefillBooking = {
  restaurant_id?: number;
  restaurant_name?: string;
  booking_date?: string;
  booking_date_raw?: string;
  time_slot_id?: number;
  time_slot_label?: string;
  time_raw?: string;
  number_of_guests?: number;
  special_request?: string;
};

export type ChatActionData = {
  restaurants?: RestaurantCard[];
  dishes?: DishCard[];
  booking?: PrefillBooking;
  restaurant?: RestaurantCard; // chi tiết 1 nhà hàng
  restaurant_candidates?: RestaurantCard[];
  booking_result?: { booking_id: number };
  filters?: any;
};

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;

  // Dành cho Bot
  action?: ChatbotAction;
  action_data?: ChatActionData;
  confidence?: number;

  // Dành cho hiển thị loading
  isLoading?: boolean;
};

export type ChatSession = {
  id: string;
  session_key: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};
