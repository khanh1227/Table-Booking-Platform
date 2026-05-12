import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, FlatList, SafeAreaView } from 'react-native';
import { Bell, MapPin, Search, X, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import Logo from './Logo';

import { useLocation } from '../context/LocationContext';

interface MainHeaderProps {
  showSearch?: boolean;
  title?: string;
}

const CITIES = [
  { id: 'hcm', name: 'Hồ Chí Minh' },
  { id: 'hanoi', name: 'Hà Nội' },
  { id: 'danang', name: 'Đà Nẵng' },
  { id: 'binhduong', name: 'Bình Dương' },
  { id: 'dongnai', name: 'Đồng Nai' },
  { id: 'vungtau', name: 'Vũng Tàu' },
];

export default function MainHeader({ showSearch = false, title }: MainHeaderProps) {
  const { location, detectLocation, loading, setLocation } = useLocation();
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelectCity = (city: string) => {
    setLocation({
      ...location,
      address: city,
      city: city,
      // Reset coords when manual city is selected to avoid distance conflicts 
      // unless we want to geocode it (keeping it simple for now)
      latitude: null,
      longitude: null
    });
    setModalVisible(false);
  };

  return (
    <View className="bg-white px-4 pt-2 pb-3 border-b border-gray-50">
      <View className="flex-row justify-between items-center mb-3">
        {title ? (
          <Text className="text-xl font-black text-gray-900">{title}</Text>
        ) : (
          <Logo size="md" />
        )}
        
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => router.push('/notifications')}
            className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center mr-3"
          >
            <Bell size={20} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setModalVisible(true)}
            disabled={loading}
            className="bg-gray-50 px-3 py-2 rounded-full flex-row items-center"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <>
                <MapPin size={14} color="#ef4444" />
                <Text className="text-gray-700 text-xs font-bold ml-1" numberOfLines={1}>
                  {location.address}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {showSearch && (
        <TouchableOpacity 
          onPress={() => router.push('/(tabs)/explore')}
          className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100"
        >
          <Search size={18} color="#9ca3af" />
          <Text className="text-gray-400 ml-2 font-medium">Tìm nhà hàng, món ăn...</Text>
        </TouchableOpacity>
      )}

      {/* Location Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[40px] h-[70%] p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-black text-gray-900">Chọn vị trí</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="p-2 bg-gray-100 rounded-full">
                <X size={20} color="#000" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              onPress={async () => {
                await detectLocation();
                setModalVisible(false);
              }}
              className="flex-row items-center bg-red-50 p-4 rounded-2xl border border-red-100 mb-6"
            >
              <View className="bg-red-100 p-2 rounded-full mr-3">
                <MapPin size={20} color="#ef4444" />
              </View>
              <View className="flex-1">
                <Text className="text-red-600 font-bold">Vị trí hiện tại</Text>
                <Text className="text-red-400 text-xs">Sử dụng GPS để định vị</Text>
              </View>
              <ActivityIndicator animating={loading} size="small" color="#ef4444" />
            </TouchableOpacity>

            <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4 ml-2">Thành phố phổ biến</Text>
            
            <FlatList
              data={CITIES}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => handleSelectCity(item.name)}
                  className="flex-row items-center justify-between py-4 border-b border-gray-50"
                >
                  <Text className="text-gray-700 font-bold">{item.name}</Text>
                  <ChevronRight size={18} color="#d1d5db" />
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
