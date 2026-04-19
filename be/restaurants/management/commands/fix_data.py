from django.core.management.base import BaseCommand
from restaurants.models import Location, Restaurant, MenuItem
import random


class Command(BaseCommand):
    help = 'Fix database data: cities, districts, wards, prices, cuisines'

    def handle(self, *args, **options):
        self.fix_cities()
        self.fix_districts()
        self.fix_menu_prices()
        self.fix_cuisines()
        self.fix_restaurant_price_ranges()
        self.print_summary()

    def fix_cities(self):
        self.stdout.write('=' * 60)
        self.stdout.write('1. FIX CITY NAMES')
        self.stdout.write('=' * 60)

        updates = [
            ('Hồ Chí Minh', 'Thành phố Hồ Chí Minh'),
            ('TP. Hồ Chí Minh', 'Thành phố Hồ Chí Minh'),
            ('Hà Nội', 'Thành phố Hà Nội'),
            ('Đà Nẵng', 'Thành phố Đà Nẵng'),
            ('Hải Phòng', 'Thành phố Hải Phòng'),
            ('Cần Thơ', 'Thành phố Cần Thơ'),
            ('Lâm Đồng', 'Tỉnh Lâm Đồng'),
            ('Khánh Hòa', 'Tỉnh Khánh Hòa'),
            ('Thừa Thiên Huế', 'Tỉnh Thừa Thiên Huế'),
            ('Test City', 'Thành phố Hồ Chí Minh'),
        ]
        for old, new in updates:
            n = Location.objects.filter(city=old).update(city=new)
            if n:
                self.stdout.write(f'  {old} -> {new} ({n} records)')

        # Fix corrupted encoding entries
        for loc in Location.objects.all():
            if '???' in loc.city or '??' in loc.city:
                loc.city = 'Thành phố Hồ Chí Minh'
                loc.save()
                self.stdout.write(f'  Fixed corrupted city #{loc.id}')

    def fix_districts(self):
        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write('2. FIX DISTRICTS & WARDS')
        self.stdout.write('=' * 60)

        VALID = {
            'Thành phố Hồ Chí Minh': [
                ('Quận 1',           ['Phường Bến Nghé','Phường Bến Thành','Phường Đa Kao','Phường Nguyễn Thái Bình']),
                ('Quận 3',           ['Phường Võ Thị Sáu','Phường 1','Phường 5','Phường 9']),
                ('Quận 7',           ['Phường Tân Phong','Phường Tân Quy','Phường Phú Mỹ']),
                ('Quận 10',          ['Phường 1','Phường 4','Phường 12']),
                ('Quận Bình Thạnh',  ['Phường 25','Phường 1','Phường 7']),
                ('Quận Phú Nhuận',   ['Phường 1','Phường 3','Phường 7']),
                ('Quận Tân Bình',    ['Phường 1','Phường 2','Phường 4']),
                ('Quận Gò Vấp',     ['Phường 1','Phường 3','Phường 5']),
                ('Thành phố Thủ Đức',['Phường Thảo Điền','Phường An Phú','Phường Linh Trung']),
            ],
            'Thành phố Hà Nội': [
                ('Quận Ba Đình',     ['Phường Trúc Bạch','Phường Cống Vị','Phường Ngọc Hà']),
                ('Quận Hoàn Kiếm',   ['Phường Hàng Trống','Phường Hàng Bạc','Phường Cửa Đông']),
                ('Quận Đống Đa',     ['Phường Láng Hạ','Phường Ô Chợ Dừa','Phường Cát Linh']),
                ('Quận Cầu Giấy',    ['Phường Dịch Vọng','Phường Nghĩa Đô','Phường Mai Dịch']),
                ('Quận Thanh Xuân',  ['Phường Thanh Xuân Bắc','Phường Nhân Chính']),
                ('Quận Hai Bà Trưng',['Phường Bách Khoa','Phường Lê Đại Hành']),
                ('Quận Tây Hồ',      ['Phường Quảng An','Phường Nhật Tân']),
            ],
            'Thành phố Đà Nẵng': [
                ('Quận Hải Châu',    ['Phường Thạch Thang','Phường Thanh Bình','Phường Phước Ninh']),
                ('Quận Thanh Khê',   ['Phường Thanh Khê Đông','Phường An Khê']),
                ('Quận Sơn Trà',     ['Phường An Hải Bắc','Phường Mân Thái']),
                ('Quận Ngũ Hành Sơn',['Phường Mỹ An','Phường Khuê Mỹ']),
                ('Quận Cẩm Lệ',     ['Phường Khuê Trung','Phường Hoà Phát']),
            ],
            'Thành phố Hải Phòng': [
                ('Quận Ngô Quyền',   ['Phường Lạch Tray','Phường Đằng Giang','Phường Cầu Đất']),
                ('Quận Lê Chân',     ['Phường An Biên','Phường An Dương']),
                ('Quận Hồng Bàng',   ['Phường Quán Toan','Phường Hoàng Văn Thụ']),
                ('Quận Hải An',      ['Phường Đằng Hải','Phường Đông Hải 1']),
            ],
            'Thành phố Cần Thơ': [
                ('Quận Ninh Kiều',   ['Phường Tân An','Phường An Hội','Phường Cái Khế']),
                ('Quận Bình Thủy',   ['Phường Bình Thủy','Phường Trà An']),
                ('Quận Cái Răng',    ['Phường Lê Bình','Phường Hưng Phú']),
            ],
        }

        # Build lookup: district -> valid_for_cities
        dist_to_city = {}
        for city, dist_list in VALID.items():
            for dist, _ in dist_list:
                if dist not in dist_to_city:
                    dist_to_city[dist] = []
                dist_to_city[dist].append(city)

        for loc in Location.objects.all():
            city = loc.city
            if city not in VALID:
                continue

            valid_dists = VALID[city]
            valid_dist_names = [d for d, _ in valid_dists]

            needs_save = False

            # If district is invalid for this city, reassign
            if loc.district not in valid_dist_names:
                dist, wards = random.choice(valid_dists)
                loc.district = dist
                loc.ward = random.choice(wards)
                needs_save = True
                self.stdout.write(f'  #{loc.id} [{city}]: dist -> {dist}, ward -> {loc.ward}')

            # If ward is None, assign one
            elif not loc.ward:
                for d, wards in valid_dists:
                    if d == loc.district:
                        loc.ward = random.choice(wards)
                        needs_save = True
                        self.stdout.write(f'  #{loc.id} [{city}/{loc.district}]: ward -> {loc.ward}')
                        break

            if needs_save:
                loc.save()

    def fix_menu_prices(self):
        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write('3. FIX MENU PRICES & NAMES')
        self.stdout.write('=' * 60)

        TEMPLATES = {
            'Món Việt': [
                ('Phở bò tái chín',     'Món Chính',    55000),
                ('Bún bò Huế',          'Món Chính',    50000),
                ('Cơm tấm sườn bì',    'Món Chính',    45000),
                ('Gỏi cuốn tôm thịt',  'Khai vị',      35000),
                ('Chè ba màu',          'Tráng miệng',  25000),
                ('Bánh xèo',            'Món Chính',    40000),
            ],
            'BBQ': [
                ('Bò Mỹ nướng',        'Món Chính',    189000),
                ('Sườn heo BBQ',        'Món Chính',    149000),
                ('Combo nướng 2 người', 'Buffet',       299000),
                ('Salad trộn',          'Khai vị',       69000),
                ('Kem tự chọn',         'Tráng miệng',  49000),
                ('Nước ép cam',          'Đồ Uống',     39000),
            ],
            'Nhật Bản': [
                ('Sashimi tổng hợp',   'Món Chính',    250000),
                ('Sushi set 12 miếng', 'Món Chính',    180000),
                ('Ramen Tonkotsu',     'Món Chính',    120000),
                ('Edamame',             'Khai vị',       45000),
                ('Matcha latte',        'Đồ Uống',      55000),
                ('Tempura tôm',         'Khai vị',      89000),
            ],
            'Hàn Quốc': [
                ('Tokbokki cay',       'Món Chính',     79000),
                ('Gà rán Hàn Quốc',   'Món Chính',    149000),
                ('Thịt nướng Bulgogi', 'Món Chính',    169000),
                ('Kimchi jjigae',      'Món Chính',     99000),
                ('Bibimbap',            'Cơm',          89000),
                ('Soju chai',           'Đồ Uống',      95000),
            ],
            'Ý': [
                ('Pizza Margherita',   'Món Chính',    159000),
                ('Spaghetti Carbonara','Món Chính',    139000),
                ('Risotto nấm truffle','Món Chính',    199000),
                ('Bruschetta',          'Khai vị',      79000),
                ('Tiramisu',            'Tráng miệng',  69000),
                ('Vang đỏ Ý (ly)',     'Đồ Uống',     120000),
            ],
            'Trung Hoa': [
                ('Dimsum tổng hợp',    'Khai vị',       89000),
                ('Vịt quay Bắc Kinh', 'Món Chính',    250000),
                ('Mì xào bò',          'Món Chính',     79000),
                ('Hoành thánh',        'Khai vị',       59000),
                ('Cơm chiên Dương Châu','Cơm',          69000),
                ('Trà oolong',          'Đồ Uống',      35000),
            ],
            'Fine Dining': [
                ('Bò Wagyu A5 nướng',  'Món Chính',    650000),
                ('Gan ngỗng Foie Gras','Khai vị',      380000),
                ('Tôm hùm nướng bơ',  'Món Chính',    520000),
                ('Soup truffles',       'Khai vị',      180000),
                ('Set tráng miệng',    'Tráng miệng', 200000),
                ('Rượu vang Pháp (ly)','Đồ Uống',     350000),
            ],
            'Hải Sản': [
                ('Tôm hùm hấp',       'Món Chính',    450000),
                ('Cua rang me',         'Món Chính',    350000),
                ('Nghêu hấp sả',      'Món Chính',    120000),
                ('Mực nướng sa tế',    'Món Chính',    150000),
                ('Gỏi hải sản',        'Khai vị',       99000),
                ('Bia tươi',            'Đồ Uống',      35000),
            ],
            'Đồ Uống': [
                ('Cà phê sữa đá',     'Đồ Uống',      29000),
                ('Trà đào cam sả',    'Đồ Uống',      39000),
                ('Sinh tố bơ',         'Đồ Uống',      45000),
                ('Bánh mì sandwich',   'Bánh',          35000),
                ('Croissant bơ',       'Bánh',          29000),
                ('Matcha đá xay',      'Đồ Uống',      49000),
            ],
            'Ấn Độ': [
                ('Butter Chicken',     'Món Chính',    139000),
                ('Biryani gà',         'Cơm',          119000),
                ('Naan phô mai',       'Bánh',          49000),
                ('Samosa',              'Khai vị',       39000),
                ('Lassi xoài',         'Đồ Uống',       45000),
                ('Tandoori chicken',   'Món Chính',    159000),
            ],
            'Tráng miệng': [
                ('Kem vanilla',        'Tráng miệng',   49000),
                ('Bánh chocolate lava','Tráng miệng',   69000),
                ('Crepe trái cây',     'Tráng miệng',   55000),
                ('Waffles fresh cream','Tráng miệng',   65000),
                ('Smoothie dâu',       'Đồ Uống',       49000),
                ('Milkshake socola',   'Đồ Uống',       55000),
            ],
        }

        fixed_count = 0
        for r in Restaurant.objects.filter(status='APPROVED'):
            cuisine = r.cuisine_type
            if cuisine not in TEMPLATES:
                continue

            template = TEMPLATES[cuisine]
            items = list(r.menu_items.all().order_by('id'))

            for i, item in enumerate(items):
                if i < len(template):
                    name, category, base_price = template[i]
                    variation = random.uniform(0.85, 1.15)
                    new_price = round(base_price * variation / 1000) * 1000

                    # For script-generated restaurants (id >= 36), always fix
                    if r.id >= 36:
                        item.name = name
                        item.category = category
                        item.price = new_price
                        item.save()
                        fixed_count += 1
                    # For hand-created, only fix unrealistic prices
                    elif item.price < 5000 or item.price > 1000000:
                        item.price = new_price
                        item.save()
                        fixed_count += 1

            # Create items if restaurant has none
            if len(items) == 0:
                for name, cat, base_price in template[:5]:
                    variation = random.uniform(0.85, 1.15)
                    new_price = round(base_price * variation / 1000) * 1000
                    MenuItem.objects.create(
                        restaurant=r, name=name, category=cat,
                        price=new_price, is_available=True
                    )
                    fixed_count += 1
                self.stdout.write(f'  [{r.id}] {r.name}: created 5 items')

        self.stdout.write(f'  Fixed {fixed_count} menu items total')

    def fix_cuisines(self):
        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write('4. FIX CUISINE TYPES')
        self.stdout.write('=' * 60)

        fixes = {
            1:  'Món Việt',      # nhà hàng cơm
            3:  'Món Việt',      # Phở Thìn
            5:  'Nhật Bản',      # Sushi Hokkaido
            6:  'BBQ',           # GoGi House BBQ
            7:  'Ý',             # Pizza 4P's
            9:  'Đồ Uống',      # The Coffee House
            10: 'Món Việt',      # Runam Bistro
            11: 'Hải Sản',       # Hải Sản Biển Đông
            16: 'Món Việt',      # Chè Liên Đà Nẵng
            18: 'Ấn Độ',         # Namaste India
            22: 'Trung Hoa',     # Manwah Taiwanese Hotpot
            24: 'Nhật Bản',      # Sumo Yakiniku
            25: 'Món Việt',      # Bánh Cuốn Bà Hoành
            26: 'Món Việt',      # Cơm Tấm Cali
            27: 'Món Việt',      # Nem Nướng
            29: 'BBQ',           # Burger King
            30: 'BBQ',           # Popeyes
            31: 'Ý',             # Pizza Hut
            32: 'Tráng miệng',  # Baskin Robbins
        }

        for rid, new_cuisine in fixes.items():
            r = Restaurant.objects.filter(id=rid).first()
            if r and r.cuisine_type != new_cuisine:
                old = r.cuisine_type
                r.cuisine_type = new_cuisine
                r.save()
                self.stdout.write(f'  [{rid}] {r.name}: {old} -> {new_cuisine}')

    def fix_restaurant_price_ranges(self):
        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write('5. FIX RESTAURANT PRICE_RANGE (DB FIELD)')
        self.stdout.write('=' * 60)

        from django.db.models import Avg

        # Rule: based on avg menu price per restaurant
        # - BUDGET:  < 100k
        # - MEDIUM:  100k–300k
        # - PREMIUM: > 300k
        updated = 0
        skipped_no_menu = 0

        qs = Restaurant.objects.filter(status='APPROVED').annotate(avg_p=Avg('menu_items__price'))
        for r in qs:
            if r.avg_p is None:
                skipped_no_menu += 1
                continue

            avg_p = float(r.avg_p)
            if avg_p < 100_000:
                pr = 'BUDGET'
            elif avg_p <= 300_000:
                pr = 'MEDIUM'
            else:
                pr = 'PREMIUM'

            if r.price_range != pr:
                r.price_range = pr
                r.save(update_fields=['price_range'])
                updated += 1
                self.stdout.write(f'  [{r.id}] {r.name}: price_range -> {pr} (avg={int(avg_p)})')

        self.stdout.write(f'  Updated {updated} restaurants')
        if skipped_no_menu:
            self.stdout.write(f'  Skipped {skipped_no_menu} restaurants (no menu items)')

    def print_summary(self):
        from django.db.models import Avg

        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write('SUMMARY')
        self.stdout.write('=' * 60)

        self.stdout.write('\nDistinct cities:')
        for c in Location.objects.values_list('city', flat=True).distinct():
            cnt = Location.objects.filter(city=c).count()
            self.stdout.write(f'  [{c}] ({cnt})')

        self.stdout.write('\nSample restaurants (by avg price):')
        for r in Restaurant.objects.filter(status='APPROVED').annotate(
            avg_p=Avg('menu_items__price')
        ).order_by('avg_p')[:10]:
            self.stdout.write(f'  {r.name}: avg={r.avg_p}, cuisine={r.cuisine_type}, price_range={r.price_range}')

        self.stdout.write('\nDone!')
