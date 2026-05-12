import React, { useState, useEffect } from 'react';
import { Image, ImageProps, ImageSourcePropType } from 'react-native';

interface SafeImageProps extends Omit<ImageProps, 'source'> {
  uri?: string | null;
  placeholder?: ImageSourcePropType;
}

export default function SafeImage({ uri, placeholder, ...props }: SafeImageProps) {
  const [error, setError] = useState(false);
  const defaultPlaceholder = require('../../assets/placeholder.png');

  // Reset error when uri changes
  useEffect(() => {
    setError(false);
  }, [uri]);

  const source = (uri && !error) ? { uri } : (placeholder || defaultPlaceholder);

  return (
    <Image
      {...props}
      source={source}
      onError={() => setError(true)}
    />
  );
}
