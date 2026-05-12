import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { LocationProvider } from '../src/context/LocationContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <LocationProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: '#f8f9fa',
          }
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="restaurant/[id]" options={{ title: 'Chi tiết nhà hàng' }} />
        <Stack.Screen name="login" options={{ title: 'Đăng nhập', presentation: 'modal' }} />
      </Stack>
    </LocationProvider>
  );
}
