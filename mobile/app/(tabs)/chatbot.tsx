import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform, 
  SafeAreaView,
  ActivityIndicator,
  Image,
  ScrollView
} from 'react-native';
import { Send, User, Bot, ArrowRight, Store, Calendar, MessageSquare } from 'lucide-react-native';
import { sendMessageToAI, BASE_URL, getAbsoluteUrl } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import MainHeader from '../../src/components/MainHeader';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  action?: string;
  actionData?: any;
  timestamp: Date;
}

export default function ChatbotScreen() {
  const { initialMessage } = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Xin chào! Tôi là trợ lý AI của DatBanAn. Tôi có thể giúp gì cho bạn hôm nay?',
      sender: 'bot',
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | undefined>(undefined);
  const [userId, setUserId] = useState<number | undefined>(undefined);
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (initialMessage && userId) {
      handleAutoSend(initialMessage as string);
    }
  }, [initialMessage, userId]);

  const loadUser = async () => {
    const userStr = await AsyncStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
    }
  };

  const handleAutoSend = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await sendMessageToAI(text, sessionKey, userId);
      if (response.session_key) setSessionKey(response.session_key);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.message,
        sender: 'bot',
        action: response.action,
        actionData: response.action_data,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await sendMessageToAI(inputText, sessionKey, userId);
      
      if (response.session_key) setSessionKey(response.session_key);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.message,
        sender: 'bot',
        action: response.action,
        actionData: response.action_data,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Rất tiếc, đã có lỗi xảy ra. Vui lòng thử lại sau.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isBot = item.sender === 'bot';
    
    return (
      <View className={`mb-4 flex-row ${isBot ? 'justify-start' : 'justify-end'} px-4`}>
        {isBot && (
          <View className="w-8 h-8 rounded-full bg-red-100 items-center justify-center mr-2 mt-1">
            <Bot size={16} color="#ef4444" />
          </View>
        )}
        
        <View className="max-w-[80%]">
          <View className={`p-4 rounded-3xl ${isBot ? 'bg-white border border-gray-100 rounded-tl-none' : 'bg-red-600 rounded-tr-none'}`}>
            <Text className={`${isBot ? 'text-gray-800' : 'text-white'} text-sm leading-5`}>
              {item.text}
            </Text>
          </View>

          {/* Action Blocks */}
          {item.action === 'show_restaurants' && item.actionData?.restaurants && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 -mx-2">
              {item.actionData.restaurants.map((res: any) => (
                <TouchableOpacity 
                  key={res.id}
                  onPress={() => router.push(`/restaurant/${res.id}`)}
                  className="bg-white rounded-2xl border border-gray-100 p-3 mx-2 w-48 shadow-sm"
                >
                  <Image 
                    source={res.thumbnail ? { uri: getAbsoluteUrl(res.thumbnail) } : require('../../assets/placeholder.png')} 
                    className="w-full h-24 rounded-xl mb-2 bg-gray-100"
                  />
                  <Text className="font-bold text-xs text-gray-900" numberOfLines={1}>{res.name}</Text>
                  <View className="flex-row items-center justify-between mt-1">
                    <View className="flex-row items-center flex-1 mr-2">
                      <Store size={10} color="#9ca3af" />
                      <Text className="text-gray-400 text-[10px] ml-1" numberOfLines={1}>{res.address}</Text>
                    </View>
                    <Text className="text-red-600 font-bold text-[10px]">
                      {(() => {
                        if (!res.price_range) return '$$';
                        const p = String(res.price_range).toUpperCase();
                        if (p === "BUDGET" || p.includes("BÌNH DÂN")) return "Bình dân";
                        if (p === "MEDIUM" || p.includes("TRUNG BÌNH")) return "Trung bình";
                        if (p === "PREMIUM" || p.includes("CAO CẤP")) return "Cao cấp";

                        const num = parseInt(String(res.price_range).replace(/\D/g, ""));
                        if (isNaN(num) || num <= 0) return res.price_range;
                        
                        if (num < 100000) return 'Bình dân';
                        if (num <= 300000) return 'Trung bình';
                        return 'Cao cấp';
                      })()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {item.action === 'go_to_booking' && item.actionData?.restaurant_id && (
            <TouchableOpacity 
              onPress={() => router.push(`/booking/${item.actionData.restaurant_id}`)}
              className="mt-2 bg-red-50 border border-red-100 p-3 rounded-2xl flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <Calendar size={16} color="#ef4444" />
                <Text className="text-red-600 font-bold text-xs ml-2">Đặt bàn ngay</Text>
              </View>
              <ArrowRight size={16} color="#ef4444" />
            </TouchableOpacity>
          )}

          <Text className="text-[10px] text-gray-400 mt-1 mx-1">
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {!isBot && (
          <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center ml-2 mt-1">
            <User size={16} color="#6b7280" />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <MainHeader title="Trợ lý AI" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        className="flex-1"
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingVertical: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {loading && (
          <View className="flex-row px-6 mb-4 items-center">
            <View className="bg-white p-3 rounded-2xl border border-gray-100">
              <ActivityIndicator size="small" color="#ef4444" />
            </View>
          </View>
        )}

        <View className="p-4 bg-white border-t border-gray-100 flex-row items-center">
          <TextInput
            placeholder="Nhập tin nhắn..."
            className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 text-gray-700 mr-3"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            onPress={handleSend}
            disabled={loading || !inputText.trim()}
            className={`w-12 h-12 rounded-full items-center justify-center shadow-lg ${loading || !inputText.trim() ? 'bg-gray-200' : 'bg-red-600 shadow-red-200'}`}
          >
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
