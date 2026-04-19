import { Routes, Route, useNavigate } from 'react-router-dom';
import Home from '@/pages/Home';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import Partner from '@/pages/Partner';
import RegisterPartner from '@/pages/RegisterPartner';
import Profile from '@/pages/Profile';
import ForgotPassword from '@/pages/ForgotPassword';
import Explore from '@/pages/Explore';
import Favorites from '@/pages/Favorites';
import Admin from '@/pages/Admin';

import { onLogin, onRegister } from '@/lib/api';

import RestaurantPublicPage from '@/pages/RestaurantPublicPage';

import MyBookings from '@/pages/MyBookings';
import ChatWidget from '@/components/chat/ChatWidget';
function LoginRoute() {
  const navigate = useNavigate();
  return (
    <Login
      onClose={() => navigate('/')}
      onSwitchToRegister={() => navigate('/register')}
      onForgotPassword={() => navigate('/forgot-password')}
      onLogin={onLogin}
    />
  );
}

function RegisterRoute() {
  const navigate = useNavigate();
  return (
    <Register
      onClose={() => navigate('/')}
      onSwitchToLogin={() => navigate('/login')}
      onRegister={onRegister}
    />
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/register" element={<RegisterRoute />} />
        <Route path="/partner" element={<Partner />} />
        <Route path="/register_partner" element={<RegisterPartner />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/favorites" element={<Favorites />} />

        <Route path="/restaurant/:id" element={<RestaurantPublicPage />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        
        {/* Admin Route */}
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <ChatWidget />
    </>
  );
}
