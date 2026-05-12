import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView,
  TextInput,
  Alert,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, User, Calendar, Eye, Share2, Heart, MessageCircle, Send } from 'lucide-react-native';
import { fetchPostDetail, toggleLikePost, addComment, getAbsoluteUrl } from '../../../src/services/api'; // Force refresh
import RenderHtml from 'react-native-render-html';

export default function PostDetailScreen() {
  const { slug } = useLocalSearchParams();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (slug) loadData();
  }, [slug]);

  const loadData = async () => {
    try {
      const data = await fetchPostDetail(slug as string);
      setPost(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    try {
      const result = await toggleLikePost(slug as string);
      setPost({
        ...post,
        is_liked: result.liked,
        likes_count: result.likes_count
      });
    } catch (error) {
      Alert.alert('Thông báo', 'Vui lòng đăng nhập để thực hiện tính năng này');
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    
    try {
      setSubmittingComment(true);
      await addComment({
        post: post.id,
        content: commentText
      });
      setCommentText('');
      // Reload post to see new comment
      await loadData();
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể gửi bình luận. Vui lòng thử lại sau.');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#ef4444" className="flex-1" />;

  if (!post) return (
    <View className="flex-1 items-center justify-center">
      <Text>Không tìm thấy bài viết</Text>
      <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-red-600 px-6 py-2 rounded-xl">
        <Text className="text-white">Quay lại</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between py-4 px-4 border-b border-gray-50">
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={28} color="#000" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900 flex-1 ml-4" numberOfLines={1}>{post.title}</Text>
        <TouchableOpacity className="ml-4">
          <Share2 size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1">
          <Image 
            source={{ uri: getAbsoluteUrl(post.thumbnail) || 'https://via.placeholder.com/800x400' }} 
            className="w-full h-64 bg-gray-100"
          />
          
          <View className="p-6">
            <View className="bg-red-50 self-start px-3 py-1 rounded-full mb-4">
              <Text className="text-red-600 text-xs font-bold uppercase">{post.category_display}</Text>
            </View>

            <Text className="text-3xl font-black text-gray-900 mb-4 leading-tight">{post.title}</Text>

            <View className="flex-row items-center mb-8">
              <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                <User size={20} color="#9ca3af" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-gray-900 font-bold text-sm">{post.author_details?.full_name || 'Người dùng'}</Text>
                <View className="flex-row items-center">
                  <Text className="text-gray-400 text-xs">{new Date(post.created_at).toLocaleDateString('vi-VN')}</Text>
                  <Text className="text-gray-300 mx-2">•</Text>
                  <Eye size={12} color="#9ca3af" />
                  <Text className="text-gray-400 text-xs ml-1">{post.views_count} lượt xem</Text>
                </View>
              </View>
            </View>

            {/* Interaction Stats */}
            <View className="flex-row items-center mb-8 py-4 border-y border-gray-50">
              <TouchableOpacity 
                onPress={handleLike}
                className="flex-row items-center mr-8"
              >
                <Heart size={20} color={post.is_liked ? "#ef4444" : "#6b7280"} fill={post.is_liked ? "#ef4444" : "transparent"} />
                <Text className={`ml-2 font-bold ${post.is_liked ? 'text-red-600' : 'text-gray-600'}`}>
                  {post.likes_count || 0}
                </Text>
              </TouchableOpacity>
              <View className="flex-row items-center">
                <MessageCircle size={20} color="#6b7280" />
                <Text className="ml-2 font-bold text-gray-600">
                  {post.comments?.length || 0}
                </Text>
              </View>
            </View>

            {/* Post Content */}
            <View className="mb-10">
              <RenderHtml
                contentWidth={width - 48}
                source={{ html: post.content || '' }}
                tagsStyles={{
                  p: { color: '#374151', lineHeight: 24, marginBottom: 16, fontSize: 16 },
                  h2: { color: '#111827', marginTop: 24, marginBottom: 12, fontWeight: '800' },
                  img: { borderRadius: 16, marginVertical: 16 }
                }}
              />
            </View>

            {/* Comments Section */}
            <View className="border-t border-gray-100 pt-8">
              <Text className="text-xl font-bold text-gray-900 mb-6">Bình luận ({post.comments?.length || 0})</Text>
              
              {post.comments && post.comments.length > 0 ? (
                post.comments.map((comment: any) => (
                  <View key={comment.id} className="mb-6 bg-gray-50 p-4 rounded-3xl">
                    <View className="flex-row items-center mb-2">
                      <View className="w-8 h-8 bg-white rounded-full items-center justify-center mr-2 shadow-sm">
                        <User size={14} color="#9ca3af" />
                      </View>
                      <View>
                        <Text className="text-gray-900 font-bold text-xs">{comment.author_name}</Text>
                        <Text className="text-gray-400 text-[10px]">{new Date(comment.created_at).toLocaleDateString('vi-VN')}</Text>
                      </View>
                    </View>
                    <Text className="text-gray-700 text-sm leading-5 ml-10">{comment.content}</Text>
                  </View>
                ))
              ) : (
                <View className="items-center py-10">
                  <MessageCircle size={40} color="#d1d5db" />
                  <Text className="text-gray-400 mt-2 font-medium">Chưa có bình luận nào</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Comment Input */}
        <View className="p-4 bg-white border-t border-gray-100 flex-row items-center">
          <TextInput
            placeholder="Viết bình luận..."
            className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 text-gray-700 mr-3 max-h-24"
            value={commentText}
            onChangeText={setCommentText}
            multiline
          />
          <TouchableOpacity 
            onPress={handleSendComment}
            disabled={submittingComment || !commentText.trim()}
            className={`w-12 h-12 rounded-full items-center justify-center ${submittingComment || !commentText.trim() ? 'bg-gray-100' : 'bg-red-600'}`}
          >
            {submittingComment ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
