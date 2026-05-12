import React, { createContext, useState, useContext, useEffect } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LocationData {
  latitude: number | null;
  longitude: number | null;
  address: string;
  city?: string;
  district?: string;
}

interface LocationContextType {
  location: LocationData;
  setLocation: (data: LocationData) => void;
  detectLocation: () => Promise<void>;
  loading: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocationState] = useState<LocationData>({
    latitude: null,
    longitude: null,
    address: 'Hồ Chí Minh',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSavedLocation();
  }, []);

  const loadSavedLocation = async () => {
    try {
      const saved = await AsyncStorage.getItem('user_location');
      if (saved) {
        setLocationState(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const setLocation = async (data: LocationData) => {
    setLocationState(data);
    try {
      await AsyncStorage.setItem('user_location', JSON.stringify(data));
    } catch (e) {
      console.error(e);
    }
  };

  const detectLocation = async () => {
    try {
      setLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
        { headers: { 'Accept-Language': 'vi', 'User-Agent': 'RestaurantBookingApp/1.0' } }
      );
      const data = await res.json();
      
      const city = data.address.state || data.address.province || data.address.city || "";
      const district = data.address.city || data.address.town || data.address.district || "";
      const address = district || city || 'Hồ Chí Minh';

      await setLocation({ latitude, longitude, address });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocationContext.Provider value={{ location, setLocation, detectLocation, loading }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocation must be used within a LocationProvider');
  return context;
};
