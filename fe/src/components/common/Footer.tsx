import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from 'lucide-react'; // Nếu bạn dùng lucide-react

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">

          {/* Cột 1: Giới thiệu */}
          <div className="space-y-4">
            <h3 className="text-white text-xl font-bold">TableBooking</h3>
            <p className="text-sm leading-6">
              Giải pháp đặt bàn trực tuyến nhanh chóng, tiện lợi. Giúp bạn tìm thấy vị trí hoàn hảo cho mọi bữa tiệc.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="hover:text-white transition-colors"><Facebook size={20} /></a>
              <a href="#" className="hover:text-white transition-colors"><Instagram size={20} /></a>
              <a href="#" className="hover:text-white transition-colors"><Twitter size={20} /></a>
            </div>
          </div>

          {/* Cột 2: Liên kết nhanh */}
          <div>
            <h4 className="text-white font-semibold mb-4">Khám phá</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/restaurants" className="hover:text-white transition-colors">Tìm nhà hàng</a></li>
              <li><a href="/deals" className="hover:text-white transition-colors">Ưu đãi đặc biệt</a></li>
              <li><a href="/blog" className="hover:text-white transition-colors">Cẩm nang ẩm thực</a></li>
              <li><a href="/membership" className="hover:text-white transition-colors">Thành viên thân thiết</a></li>
            </ul>
          </div>

          {/* Cột 3: Hỗ trợ */}
          <div>
            <h4 className="text-white font-semibold mb-4">Hỗ trợ</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/help" className="hover:text-white transition-colors">Trung tâm trợ giúp</a></li>
              <li><a href="/policy" className="hover:text-white transition-colors">Chính sách bảo mật</a></li>
              <li><a href="/terms" className="hover:text-white transition-colors">Điều khoản sử dụng</a></li>
              <li><a href="/contact" className="hover:text-white transition-colors">Liên hệ hợp tác</a></li>
            </ul>
          </div>

          {/* Cột 4: Liên hệ */}
          <div>
            <h4 className="text-white font-semibold mb-4">Liên hệ</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Phone size={16} className="text-blue-400" /> 1900 1234
              </li>
              <li className="flex items-center gap-2">
                <Mail size={16} className="text-blue-400" /> support@tablebooking.com
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={16} className="text-blue-400 mt-1" />
                123 Đường ABC, Quận 1, TP. Hồ Chí Minh
              </li>
            </ul>
          </div>

        </div>

        {/* Thanh bản quyền dưới cùng */}
        <div className="pt-8 border-t border-gray-800 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} TableBooking. Tất cả quyền được bảo lưu.</p>
        </div>
      </div>
    </footer>
  );
}