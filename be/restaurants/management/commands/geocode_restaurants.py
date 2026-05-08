
from django.core.management.base import BaseCommand
from restaurants.models import Restaurant
from restaurants.utils import geocode_address
import time

class Command(BaseCommand):
    help = 'Geocode all restaurants based on their address and location'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Force update coordinates even if they exist')
        parser.add_argument('--limit', type=int, default=None, help='Limit number of restaurants to process')

    def handle(self, *args, **options):
        force = options['force']
        limit = options['limit']
        
        # Get restaurants that need geocoding
        # Usually we want to fix those that are suspiciously in HCM (Lat 10.x) but City is Hanoi
        # But for now, let's just allow processing all if force is used.
        queryset = Restaurant.objects.all().select_related('location')
        
        if not force:
            # Only geocode if latitude is missing OR latitude is clearly a placeholder
            # (In this DB, many are 10.xxxx even for Hanoi)
            # So if not force, maybe just those that are NULL
            queryset = queryset.filter(latitude__isnull=True)
            
        if limit:
            queryset = queryset[:limit]
            
        total = queryset.count()
        self.stdout.write(f"Found {total} restaurants to geocode.")
        
        success_count = 0
        fail_count = 0
        
        for i, r in enumerate(queryset):
            # Construct full address
            loc = r.location
            parts = []
            if r.address: parts.append(r.address)
            if loc:
                if loc.ward: parts.append(loc.ward)
                if loc.district: parts.append(loc.district)
                if loc.city: parts.append(loc.city)
            
            full_address = ", ".join(parts)
            # Safe encoding for terminal output
            name_safe = r.name.encode('ascii', 'ignore').decode('ascii')
            addr_safe = full_address.encode('ascii', 'ignore').decode('ascii')
            self.stdout.write(f"[{i+1}/{total}] Geocoding: {name_safe} - {addr_safe}")
            
            lat, lng = geocode_address(full_address, fallback_parts=parts)
            
            if lat and lng:
                r.latitude = lat
                r.longitude = lng
                r.save(update_fields=['latitude', 'longitude'])
                success_count += 1
                self.stdout.write(self.style.SUCCESS(f"  --> Found: {lat}, {lng}"))
            else:
                fail_count += 1
                self.stdout.write(self.style.WARNING(f"  --> Failed to find coordinates"))
                
        self.stdout.write(self.style.SUCCESS(f"Finished! Success: {success_count}, Failed: {fail_count}"))
