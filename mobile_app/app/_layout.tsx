
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';



export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* headerShown: false -> Ẩn thanh tiêu đề mặc định của Expo để dùng Header tự build */}
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}