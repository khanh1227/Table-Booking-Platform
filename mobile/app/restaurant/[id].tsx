import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView,
  Dimensions,
  Linking,
  Alert,
  Modal,
  TextInput,
  Share
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { 
  MapPin, 
  Star, 
  Clock, 
  ChevronLeft, 
  Heart, 
  Share2, 
  Phone, 
  Info,
  Utensils,
  MessageSquare,
  Ticket,
  Bot,
  Flag,
  X,
  ChevronRight,
  ImageIcon,
  Sparkles
} from 'lucide-react-native';
import { fetchRestaurantDetail, toggleFavorite, getAbsoluteUrl, fetchRestaurantVouchers, reportRestaurant } from '../../src/services/api';
import SafeImage from '../../src/components/SafeImage';

const { width } = Dimensions.get('window');

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('menu');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [isFavorite, setIsFavorite] = useState(false);
  const [togglingFav, setTogglingFav] = useState(false);
  
  // Modals state
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [galleryModalVisible, setGalleryModalVisible] = useState(false);
  const [currentGalleryIndex, setCurrentGalleryIndex] = useState(0);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, voucherData] = await Promise.all([
        fetchRestaurantDetail(id as string),
        fetchRestaurantVouchers(id as string)
      ]);
      setRestaurant(data);
      setVouchers(voucherData || []);
      setIsFavorite(data.is_favorite || false);
    } catch (error) {
      console.error("Lỗi tải chi tiết nhà hàng:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    try {
      setTogglingFav(true);
      await toggleFavorite(id as string);
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error(error);
      Alert.alert('Thông báo', 'Bạn cần đăng nhập để sử dụng tính năng này');
    } finally {
      setTogglingFav(false);
    }
  };

  const handleCall = () => {
    if (restaurant.phone_number) {
      Linking.openURL(`tel:${restaurant.phone_number}`);
    } else {
      Alert.alert('Thông báo', 'Nhà hàng chưa cập nhật số điện thoại');
    }
  };

  const handleOpenMaps = () => {
    const query = encodeURIComponent(restaurant.address);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    try {
      setSubmittingReport(true);
      await reportRestaurant(id as string, reportReason);
      Alert.alert('Thành công', 'Báo cáo của bạn đã được gửi. Cảm ơn bạn!');
      setReportModalVisible(false);
      setReportReason('');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể gửi báo cáo. Vui lòng thử lại sau.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `Khám phá nhà hàng ${restaurant.name} tại ${restaurant.address}. Tải app Đặt Bàn Ngay để nhận ưu đãi!`,
      });
    } catch (error: any) {
      Alert.alert('Lỗi', error.message);
    }
  };

  const menuCategories = ['Tất cả', ...new Set(restaurant?.menu_items?.map((item: any) => item.category).filter(Boolean))];
  const filteredMenu = selectedCategory === 'Tất cả' 
    ? restaurant?.menu_items 
    : restaurant?.menu_items?.filter((item: any) => item.category === selectedCategory);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'menu':
        return (
          <View className="p-4">
            {menuCategories.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                {menuCategories.map((cat: any) => (
                  <TouchableOpacity 
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    className={`px-6 py-2.5 rounded-full mr-2 border ${selectedCategory === cat ? 'bg-red-600 border-red-600 shadow-md shadow-red-200' : 'bg-gray-50 border-gray-100'}`}
                  >
                    <Text className={`text-[10px] font-black uppercase tracking-widest ${selectedCategory === cat ? 'text-white' : 'text-gray-500'}`}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {filteredMenu?.length > 0 ? (
              filteredMenu.map((item: any) => (
                <TouchableOpacity 
                  key={item.id} 
                  className="flex-row mb-4 bg-white p-3 rounded-3xl border border-gray-50 shadow-sm"
                  onPress={() => {
                    // Logic for dish detail if needed
                  }}
                >
                  <SafeImage 
                    uri={getAbsoluteUrl(item.image_url)} 
                    className="w-24 h-24 rounded-2xl bg-gray-100"
                  />
                  <View className="flex-1 ml-4 justify-center">
                    <Text className="font-black text-gray-900 text-sm mb-1">{item.name}</Text>
                    <Text className="text-gray-400 text-[10px] font-medium mb-2" numberOfLines={2}>{item.description}</Text>
                    <Text className="text-red-600 font-black">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View className="py-20 items-center">
                <Utensils size={40} color="#d1d5db" />
                <Text className="text-gray-400 mt-2 font-bold">Chưa có thực đơn</Text>
              </View>
            )}
          </View>
        );
      case 'vouchers':
        return (
          <View className="p-4">
            {vouchers.length > 0 ? (
              vouchers.map((v: any) => (
                <View key={v.id} className="mb-4 bg-orange-50 border border-orange-100 rounded-3xl p-5 flex-row items-center">
                  <View className="w-12 h-12 bg-orange-100 rounded-2xl items-center justify-center mr-4">
                    <Ticket size={24} color="#f97316" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-orange-900 font-black text-sm mb-1">{v.code}</Text>
                    <Text className="text-orange-600 font-bold text-[10px]">
                      {v.voucher_type === 'PERCENTAGE' ? `Giảm ${v.discount_value}%` : `Giảm ${new Intl.NumberFormat('vi-VN').format(Number(v.discount_value))}đ`}
                    </Text>
                    <Text className="text-orange-400 text-[8px] mt-1 italic">HSD: {new Date(v.valid_to).toLocaleDateString('vi-VN')}</Text>
                  </View>
                  <TouchableOpacity 
                    className="bg-orange-500 px-4 py-2 rounded-xl"
                    onPress={() => Alert.alert('Thông báo', 'Mã sẽ được áp dụng khi bạn thanh toán tại quán.')}
                  >
                    <Text className="text-white font-black text-[10px]">LƯU</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View className="py-20 items-center">
                <Ticket size={40} color="#d1d5db" />
                <Text className="text-gray-400 mt-2 font-bold">Chưa có mã giảm giá</Text>
              </View>
            )}
          </View>
        );
      case 'reviews':
        return (
          <View className="p-4">
            {restaurant.reviews?.length > 0 ? (
              restaurant.reviews.map((review: any) => (
                <View key={review.id} className="mb-6 border-b border-gray-50 pb-6">
                  <View className="flex-row justify-between items-center mb-3">
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 bg-red-100 rounded-full items-center justify-center mr-3">
                        <Text className="text-red-600 font-black text-xs">{review.customer_name?.[0] || 'U'}</Text>
                      </View>
                      <View>
                        <Text className="font-black text-gray-900 text-sm">{review.customer_name}</Text>
                        <Text className="text-gray-400 text-[10px] font-bold">{new Date(review.created_at).toLocaleDateString('vi-VN')}</Text>
                      </View>
                    </View>
                    <View className="flex-row bg-orange-50 px-2 py-1 rounded-lg">
                      <Star size={12} color="#f97316" fill="#f97316" />
                      <Text className="text-orange-600 font-black text-[10px] ml-1">{review.rating}</Text>
                    </View>
                  </View>
                  <Text className="text-gray-600 text-sm leading-6 font-medium">{review.comment}</Text>
                  {review.reply && (
                    <View className="mt-4 bg-gray-50 p-4 rounded-2xl border-l-4 border-red-500">
                      <Text className="text-gray-900 font-black text-[10px] mb-2 uppercase tracking-widest opacity-40">Phản hồi từ chủ quán</Text>
                      <Text className="text-gray-600 text-xs italic font-medium">"{review.reply.reply_content}"</Text>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <View className="py-20 items-center">
                <MessageSquare size={40} color="#d1d5db" />
                <Text className="text-gray-400 mt-2 font-bold">Chưa có đánh giá nào</Text>
              </View>
            )}
          </View>
        );
      case 'info':
        return (
          <View className="p-6">
            <View className="mb-10">
              <Text className="text-gray-400 text-[10px] font-black uppercase tracking-[3px] mb-4 opacity-50">Giới thiệu</Text>
              <View className="bg-gray-50 p-6 rounded-[32px] border border-gray-100">
                <Text className="text-gray-700 leading-7 italic font-medium text-sm">"{restaurant.description || 'Đang cập nhật...'}"</Text>
              </View>
            </View>
            
            <View className="mb-10">
              <Text className="text-gray-400 text-[10px] font-black uppercase tracking-[3px] mb-4 opacity-50">Liên hệ & Vị trí</Text>
              <TouchableOpacity onPress={handleCall} className="flex-row items-center mb-4 bg-gray-50 p-5 rounded-[24px] border border-gray-100">
                <View className="bg-red-100 p-2 rounded-xl mr-4">
                  <Phone size={20} color="#ef4444" />
                </View>
                <Text className="text-gray-900 font-black flex-1">{restaurant.phone_number || 'Chưa có số điện thoại'}</Text>
                <ChevronRight size={18} color="#d1d5db" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleOpenMaps} className="flex-row items-center mb-4 bg-gray-50 p-5 rounded-[24px] border border-gray-100">
                <View className="bg-blue-100 p-2 rounded-xl mr-4">
                  <MapPin size={20} color="#3b82f6" />
                </View>
                <Text className="text-gray-900 font-black flex-1" numberOfLines={2}>{restaurant.address}</Text>
                <ChevronRight size={18} color="#d1d5db" />
              </TouchableOpacity>

              <View className="flex-row items-center p-5 bg-gray-50 rounded-[24px] border border-gray-100">
                <View className="bg-amber-100 p-2 rounded-xl mr-4">
                  <Clock size={20} color="#f59e0b" />
                </View>
                <Text className="text-gray-900 font-black flex-1">{restaurant.opening_hours || '09:00 - 22:00'}</Text>
              </View>
            </View>

            <TouchableOpacity 
              onPress={() => router.push({
                pathname: '/chatbot',
                params: { initialMessage: `Tôi muốn tìm hiểu thông tin và các ưu đãi tại nhà hàng ${restaurant.name}` }
              })}
              className="flex-row items-center bg-gray-900 p-5 rounded-[24px] shadow-lg"
            >
              <View className="bg-white/20 p-2 rounded-xl mr-4">
                <Bot size={20} color="#fff" />
              </View>
              <Text className="text-white font-black">Hỏi AI về nhà hàng này</Text>
              <View className="flex-1" />
              <Sparkles size={16} color="#ef4444" fill="#ef4444" />
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#ef4444" />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View className="flex-1 justify-center items-center p-6 bg-white">
        <Text className="text-gray-500 text-lg mb-4">Không tìm thấy nhà hàng</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-red-600 px-6 py-3 rounded-xl">
          <Text className="text-white font-bold">Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const galleryImages = restaurant.images?.length > 0 ? restaurant.images : [{ image_url: restaurant.thumbnail }];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Gallery Slider */}
        <View className="relative">
          <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              setCurrentGalleryIndex(Math.round(e.nativeEvent.contentOffset.x / width));
            }}
            className="h-80 w-full"
          >
            {galleryImages.map((img: any, idx: number) => (
              <TouchableOpacity 
                activeOpacity={0.9} 
                key={idx} 
                onPress={() => setGalleryModalVisible(true)}
              >
                <SafeImage 
                  uri={getAbsoluteUrl(img.image_url)} 
                  style={{ width: width }} 
                  className="h-full bg-gray-200"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Indicator */}
          <View className="absolute bottom-6 right-6 bg-black/40 px-3 py-1.5 rounded-full">
            <Text className="text-white font-black text-[10px]">{currentGalleryIndex + 1} / {galleryImages.length}</Text>
          </View>

          {/* Floating Actions */}
          <View className="absolute top-6 left-4">
            <TouchableOpacity 
              onPress={() => router.back()}
              className="bg-white/90 p-2.5 rounded-2xl shadow-xl"
            >
              <ChevronLeft size={20} color="#000" />
            </TouchableOpacity>
          </View>

          <View className="absolute top-6 right-4 flex-row">
            <TouchableOpacity 
              onPress={handleToggleFavorite}
              disabled={togglingFav}
              className="bg-white/90 p-2.5 rounded-2xl shadow-xl mr-2"
            >
              {togglingFav ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Heart size={20} color={isFavorite ? "#ef4444" : "#000"} fill={isFavorite ? "#ef4444" : "transparent"} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleCall}
              className="bg-white/90 p-2.5 rounded-2xl shadow-xl mr-2"
            >
              <Phone size={20} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleShare}
              className="bg-white/90 p-2.5 rounded-2xl shadow-xl mr-2"
            >
              <Share2 size={20} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setReportModalVisible(true)}
              className="bg-white/90 p-2.5 rounded-2xl shadow-xl"
            >
              <Flag size={20} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Section */}
        <View className="px-5 pt-8 pb-32">
          <View className="flex-row justify-between items-start mb-6">
            <View className="flex-1 mr-4">
              <Text className="text-3xl font-black text-gray-900 mb-2 leading-tight">{restaurant.name}</Text>
              <TouchableOpacity onPress={handleOpenMaps} className="flex-row items-center">
                <MapPin size={14} color="#6b7280" />
                <Text className="text-gray-400 text-xs ml-1 font-bold" numberOfLines={1}>{restaurant.address}</Text>
              </TouchableOpacity>
            </View>
            <View className="bg-orange-50 border border-orange-100 px-4 py-2 rounded-2xl items-center justify-center">
              <View className="flex-row items-center mb-1">
                <Star size={16} color="#f97316" fill="#f97316" />
                <Text className="text-orange-700 font-black text-lg ml-1">{restaurant.rating || 'N/A'}</Text>
              </View>
              <Text className="text-orange-400 font-bold text-[8px] uppercase tracking-tighter">ĐÁNH GIÁ</Text>
            </View>
          </View>

          <View className="flex-row mb-10">
            <View className="bg-red-50 border border-red-100 px-4 py-2 rounded-full mr-3 shadow-sm">
              <Text className="text-red-600 font-black text-[10px] uppercase tracking-widest">{restaurant.cuisine_type || 'Ẩm thực'}</Text>
            </View>
            <View className="bg-gray-50 border border-gray-100 px-4 py-2 rounded-full shadow-sm">
              <Text className="text-gray-500 font-black text-[10px] uppercase tracking-widest">
                {String(restaurant.price_range || '$$').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Tabs Navigation */}
          <View className="flex-row border-b border-gray-50 mb-4 -mx-5 px-5">
            {[
              { id: 'menu', label: 'Thực đơn' },
              { id: 'vouchers', label: 'Ưu đãi' },
              { id: 'reviews', label: 'Đánh giá' },
              { id: 'info', label: 'Thông tin' },
            ].map((tab) => (
              <TouchableOpacity 
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 items-center ${activeTab === tab.id ? 'border-b-4 border-red-600' : ''}`}
              >
                <Text className={`font-black text-xs uppercase tracking-tighter ${activeTab === tab.id ? 'text-red-600' : 'text-gray-300'}`}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {renderTabContent()}
        </View>
      </ScrollView>

      {/* Sticky Bottom Booking Panel */}
      <View className="absolute bottom-0 left-0 right-0 p-6 bg-white/95 border-t border-gray-50 shadow-2xl flex-row space-x-4 items-center">
        <TouchableOpacity 
          onPress={handleCall}
          className="w-16 h-16 bg-gray-50 rounded-[24px] items-center justify-center border border-gray-100"
        >
          <Phone size={24} color="#ef4444" />
        </TouchableOpacity>
        <TouchableOpacity 
          className="flex-1 bg-red-600 h-16 rounded-[24px] items-center justify-center shadow-xl shadow-red-200"
          onPress={() => router.push(`/booking/${id}`)}
        >
          <Text className="text-white font-black text-lg uppercase tracking-[1px]">Đặt bàn ngay</Text>
        </TouchableOpacity>
      </View>

      {/* Gallery Modal (Fullscreen) */}
      <Modal visible={galleryModalVisible} transparent={true} animationType="fade">
        <View className="flex-1 bg-black">
          <SafeAreaView className="flex-1">
            <View className="flex-row justify-between items-center px-6 py-4">
              <Text className="text-white font-black">{currentGalleryIndex + 1} / {galleryImages.length}</Text>
              <TouchableOpacity onPress={() => setGalleryModalVisible(false)} className="p-2 bg-white/10 rounded-full">
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              horizontal 
              pagingEnabled 
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setCurrentGalleryIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
              className="flex-1"
            >
              {galleryImages.map((img: any, idx: number) => (
                <View key={idx} style={{ width, justifyContent: 'center' }}>
                  <Image 
                    source={getAbsoluteUrl(img.image_url) ? { uri: getAbsoluteUrl(img.image_url) as string } : require('../../assets/placeholder.png')} 
                    style={{ width, height: width * 1.3 }} 
                    resizeMode="contain"
                  />
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal visible={reportModalVisible} transparent={true} animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[40px] p-8 h-[60%]">
            <View className="flex-row justify-between items-center mb-8">
              <Text className="text-2xl font-black text-gray-900">Báo cáo vi phạm</Text>
              <TouchableOpacity onPress={() => setReportModalVisible(false)} className="p-2 bg-gray-100 rounded-full">
                <X size={20} color="#000" />
              </TouchableOpacity>
            </View>

            <Text className="text-gray-500 font-bold mb-4 ml-2">Lý do báo cáo</Text>
            <TextInput
              placeholder="Nhập lý do của bạn..."
              multiline
              numberOfLines={6}
              value={reportReason}
              onChangeText={setReportReason}
              className="bg-gray-50 border border-gray-100 rounded-[24px] p-5 text-gray-700 font-medium mb-8"
              style={{ textAlignVertical: 'top' }}
            />

            <TouchableOpacity 
              onPress={handleReport}
              disabled={submittingReport || !reportReason.trim()}
              className={`py-5 rounded-[24px] items-center shadow-lg ${submittingReport || !reportReason.trim() ? 'bg-gray-200' : 'bg-red-600 shadow-red-100'}`}
            >
              {submittingReport ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black">Gửi báo cáo</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
