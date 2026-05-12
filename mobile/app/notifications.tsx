import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView 
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Bell, BellOff, Circle } from 'lucide-react-native';
import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../src/services/api';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map((n: any) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkRead = async (item: any) => {
    if (!item.is_read) {
      try {
        await markNotificationAsRead(item.id);
        // Update local state
        setNotifications(prev => 
          prev.map((n: any) => n.id === item.id ? { ...n, is_read: true } : n)
        );
      } catch (error) {
        console.error(error);
      }
    }
    
    // Optional: Navigate based on notification type
    if (item.notification_type === 'BOOKING_CONFIRMED' || item.notification_type === 'BOOKING_CANCELLED') {
      router.push('/(tabs)/bookings');
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      onPress={() => handleMarkRead(item)}
      className={`p-5 border-b border-gray-50 flex-row ${item.is_read ? 'bg-white' : 'bg-red-50/30'}`}
    >
      <View className={`w-10 h-10 rounded-full items-center justify-center ${item.is_read ? 'bg-gray-100' : 'bg-red-100'}`}>
        <Bell size={20} color={item.is_read ? '#6b7280' : '#ef4444'} />
      </View>
      <View className="flex-1 ml-4">
        <View className="flex-row justify-between items-center mb-1">
          <Text className={`text-sm ${item.is_read ? 'text-gray-900 font-medium' : 'text-gray-900 font-bold'}`}>
            {item.title}
          </Text>
          {!item.is_read && <Circle size={8} color="#ef4444" fill="#ef4444" />}
        </View>
        <Text className="text-gray-500 text-xs leading-4 mb-2">{item.message}</Text>
        <Text className="text-gray-400 text-[10px]">
          {new Date(item.created_at).toLocaleString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit', 
            day: '2-digit', 
            month: '2-digit' 
          })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between py-4 px-4 border-b border-gray-100">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={28} color="#000" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Thông báo</Text>
        </View>
        <TouchableOpacity onPress={handleMarkAllRead}>
          <Text className="text-red-600 font-bold text-xs">Đọc tất cả</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ flexGrow: 1 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#ef4444" className="mt-20" />
          ) : (
            <View className="items-center mt-20 px-10">
              <BellOff size={64} color="#d1d5db" />
              <Text className="text-gray-400 mt-4 text-center">Bạn không có thông báo nào mới</Text>
            </View>
          )
        }
        onRefresh={loadData}
        refreshing={loading}
      />
    </SafeAreaView>
  );
}
