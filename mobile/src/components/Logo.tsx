import React from 'react';
import { View, Text } from 'react-native';
import { Utensils } from 'lucide-react-native';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export default function Logo({ size = 'md', color = '#ef4444' }: LogoProps) {
  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 32 : 24;
  const fontSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-xl';

  return (
    <View className="flex-row items-center">
      <Utensils size={iconSize} color={color} />
      <Text className={`font-black ml-2 ${fontSize} text-red-600`}>
        TableBooking
      </Text>
    </View>
  );
}
