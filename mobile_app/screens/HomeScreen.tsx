import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Search,
  MapPin,
  Utensils,
  Wine,
  ChefHat,
  Star,
  User,
  LogOut,
  UserCircle2,
  Bell, // Thay cho NotificationBell
  Briefcase,
  CalendarCheck,
  ShieldCheck,
  Menu,
} from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import * as vn from "vietnam-provinces"; 
import type { Province, District, Ward } from "vietnam-provinces";

// Import từ các file đã tạo trước đó
import { searchRestaurants, fetchRestaurantImages, logoutUser } from "../services/api";
import { buildImageUrl, PLACEHOLDER_IMAGE } from "../utils/imageUtils";
import { LoginModal } from "../components/auth/LoginModal";

// --- Types ---
type Restaurant = {
  id: number;
  name: string;
  address: string;
  description?: string;
  rating: number;
  status: string;
  location?: {
    id: number;
    city: string;
    district?: string;
    ward?: string;
  };
  image_count?: number;
  images?: { id: number; image_url: string; display_order: number }[];
};

export default function HomeScreen({ navigation }: any) {
  // --- State ---
  const [searchQuery, setSearchQuery] = useState("");
  
  // Địa chính (Đơn giản hóa cho Mobile: Ẩn bớt dropdown để đỡ rối UI)
  const [showFilter, setShowFilter] = useState(false);
  const [selectedProvinceName, setSelectedProvinceName] = useState("");
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modal Login
  const [showLogin, setShowLogin] = useState(false);

  // --- Effects ---
  useEffect(() => {
    checkLoginStatus();
    fetchData();
  }, []);

  const checkLoginStatus = async () => {
    const access = await SecureStore.getItemAsync("access");
    const userStr = await SecureStore.getItemAsync("user");
    
    setIsLoggedIn(!!access);
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Gọi API search từ service đã viết thêm
      const data = await searchRestaurants({
        query: searchQuery,
        city: selectedProvinceName,
        // district, ward... (Có thể mở rộng sau)
      });

      // Lấy thêm ảnh cho từng nhà hàng (Logic giống web)
      const restaurantsWithImages = await Promise.all(
        data.map(async (restaurant) => {
          try {
            const images = await fetchRestaurantImages(restaurant.id.toString());
            // Chỉ lấy ảnh đầu tiên để hiển thị thumbnail
            return { ...restaurant, images: images.length > 0 ? images : [] };
          } catch (err) {
            return restaurant;
          }
        })
      );

      setRestaurants(restaurantsWithImages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    await logoutUser(); // Gọi hàm logout từ api.ts
    setIsLoggedIn(false);
    setCurrentUser(null);
    Alert.alert("Đăng xuất", "Hẹn gặp lại bạn!");
  };

  // --- Handlers ---
  const handleBookTable = (restaurant: Restaurant) => {
    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }
    if (currentUser?.role !== "CUSTOMER") {
      Alert.alert("Thông báo", "Chỉ khách hàng mới có thể đặt bàn");
      return;
    }
    // Navigate sang màn hình Booking (Chưa có, tạm thời log)
    console.log("Navigate to Booking Screen for:", restaurant.name);
    // navigation.navigate('BookingScreen', { restaurant });
  };

  // --- Render Components ---

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Utensils color="#d97706" size={24} />
        <Text style={styles.logoText}>TableBooking</Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 15 }}>
        {isLoggedIn ? (
          <>
            <TouchableOpacity>
               <Bell color="#4b5563" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAccountMenuOpen(!accountMenuOpen)}>
              <UserCircle2 color="#d97706" size={28} />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => setShowLogin(true)}
          >
            <Text style={styles.loginBtnText}>Đăng nhập</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderAccountMenu = () => {
    if (!accountMenuOpen) return null;
    return (
      <View style={styles.accountMenu}>
        <Text style={styles.menuUserText}>{currentUser?.full_name || "User"}</Text>
        <View style={styles.divider} />
        
        <TouchableOpacity style={styles.menuItem}>
          <User size={16} color="#4b5563" />
          <Text style={styles.menuItemText}>Trang cá nhân</Text>
        </TouchableOpacity>

        {currentUser?.role === 'PARTNER' && (
           <TouchableOpacity style={styles.menuItem}>
             <Briefcase size={16} color="#d97706" />
             <Text style={[styles.menuItemText, {color: '#d97706'}]}>Quản lý nhà hàng</Text>
           </TouchableOpacity>
        )}

        {currentUser?.role === 'CUSTOMER' && (
           <TouchableOpacity style={styles.menuItem}>
             <CalendarCheck size={16} color="#d97706" />
             <Text style={[styles.menuItemText, {color: '#d97706'}]}>Đặt bàn của tôi</Text>
           </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <LogOut size={16} color="#dc2626" />
          <Text style={[styles.menuItemText, { color: "#dc2626" }]}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHero = () => (
    <ImageBackground
      source={{ uri: "https://images.pexels.com/photos/3201921/pexels-photo-3201921.jpeg" }}
      style={styles.heroContainer}
      imageStyle={{ opacity: 0.6, backgroundColor: 'black' }}
    >
      <View style={styles.heroContent}>
        <Text style={styles.heroTitle}>Đặt Bàn Dễ Dàng,</Text>
        <Text style={[styles.heroTitle, { color: "#fbbf24" }]}>Ăn Ngon Trọn Vẹn</Text>
        
        {/* Search Box */}
        <View style={styles.searchBox}>
          <View style={styles.searchInputRow}>
            <Search color="#9ca3af" size={20} />
            <TextInput
              style={styles.input}
              placeholder="Tìm nhà hàng..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={fetchData}
            />
          </View>
          
          <TouchableOpacity style={styles.searchButton} onPress={fetchData}>
             <Text style={styles.searchButtonText}>Tìm kiếm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );

  const renderRestaurantItem = (item: Restaurant) => {
    // Xử lý ảnh URL
    const imageUrl = item.images && item.images.length > 0
      ? buildImageUrl(item.images[0].image_url)
      : PLACEHOLDER_IMAGE;

    return (
      <View key={item.id} style={styles.card}>
        <TouchableOpacity onPress={() => console.log("Go to detail", item.id)}>
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.cardImage}
            // Fallback nếu ảnh lỗi
            onError={(e) => console.log("Image Load Error")}
          />
          {item.status === "APPROVED" && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Còn Chỗ</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <View style={styles.cardRow}>
            <MapPin size={14} color="#9ca3af" />
            <Text style={styles.cardAddress} numberOfLines={1}>{item.address}</Text>
          </View>
          
          <View style={[styles.cardRow, { justifyContent: 'space-between', marginTop: 8 }]}>
            <View style={styles.cardRow}>
              <Star size={16} color="#f59e0b" fill="#f59e0b" />
              <Text style={styles.ratingText}>{Number(item.rating ?? 0).toFixed(1)}</Text>
            </View>
            <TouchableOpacity 
              style={styles.bookBtn}
              onPress={() => handleBookTable(item)}
            >
              <Text style={styles.bookBtnText}>Đặt Bàn</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
      {renderHeader()}
      {renderAccountMenu()}

      <ScrollView showsVerticalScrollIndicator={false}>
        {renderHero()}

        {/* Cuisine Types (Icon Categories) */}
        <View style={styles.sectionContainer}>
           <Text style={styles.sectionTitle}>Khám Phá</Text>
           <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              {[
                { name: "Món Việt", icon: ChefHat },
                { name: "Nhật Bản", icon: Utensils },
                { name: "Hải Sản", icon: Utensils },
                { name: "Món Âu", icon: Wine },
              ].map((c, i) => (
                <View key={i} style={styles.categoryItem}>
                   <c.icon size={24} color="#d97706" />
                   <Text style={styles.categoryText}>{c.name}</Text>
                </View>
              ))}
           </ScrollView>
        </View>

        {/* Restaurant List */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Nhà Hàng Nổi Bật</Text>
          
          {loading ? (
             <ActivityIndicator size="large" color="#d97706" style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.grid}>
              {restaurants.map(r => renderRestaurantItem(r))}
              {restaurants.length === 0 && <Text style={{textAlign:'center', color:'#6b7280', marginTop: 20}}>Không tìm thấy nhà hàng nào.</Text>}
            </View>
          )}
        </View>
        
        <View style={{height: 50}} />
      </ScrollView>

      {/* Login Modal */}
      <LoginModal 
        visible={showLogin} 
        onClose={() => setShowLogin(false)} 
        onLoginSuccess={() => {
           checkLoginStatus(); // Reload lại user
           setShowLogin(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    elevation: 2,
    zIndex: 10,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 8,
    color: "#d97706",
  },
  loginBtn: {
    backgroundColor: "#d97706",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  loginBtnText: { color: "white", fontWeight: "600" },
  
  // Hero
  heroContainer: { height: 280, justifyContent: 'center' },
  heroContent: { padding: 20 },
  heroTitle: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  searchBox: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginTop: 20,
    elevation: 5,
  },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  input: { flex: 1, marginLeft: 10, fontSize: 16 },
  searchButton: {
    backgroundColor: '#d97706',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  searchButtonText: { color: 'white', fontWeight: 'bold' },

  // Sections
  sectionContainer: { padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  
  // Categories
  categoryItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 12,
    minWidth: 90,
    elevation: 1,
  },
  categoryText: { marginTop: 8, fontWeight: '600', color: '#374151' },

  // Card
  grid: { gap: 16, marginTop: 10 },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    marginBottom: 8,
  },
  cardImage: { width: '100%', height: 180 },
  badge: {
    position: 'absolute',
    top: 10, right: 10,
    backgroundColor: '#22c55e',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  cardContent: { padding: 16 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  cardAddress: { marginLeft: 4, flex: 1, color: '#4b5563', fontSize: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { marginLeft: 4, fontWeight: 'bold', color: '#1f2937' },
  bookBtn: { backgroundColor: '#d97706', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  bookBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },

  // Dropdown Menu (Account)
  accountMenu: {
    position: 'absolute',
    top: 60, right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 8,
    elevation: 10,
    width: 200,
    zIndex: 99,
    borderWidth: 1, borderColor: '#e5e7eb'
  },
  menuUserText: { padding: 8, fontWeight: 'bold', color: '#374151' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 10 },
  menuItemText: { fontSize: 14, color: '#4b5563' }
});