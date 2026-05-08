
import httpx
import time
import logging

logger = logging.getLogger(__name__)


def geocode_address(address_str, fallback_parts=None):
    """
    Chuyển đổi địa chỉ thành tọa độ (lat, lng) sử dụng OpenStreetMap Nominatim.
    Nếu thất bại, thử các phần địa chỉ chung hơn (fallback_parts).
    """
    if not address_str:
        return None, None
        
    url = "https://nominatim.openstreetmap.org/search"
    headers = {
        "User-Agent": "DatBanAn_App/1.0 (contact: admin@datbanan.com)"
    }
    
    # Danh sách các tổ hợp địa chỉ để thử
    candidates = [address_str]
    if fallback_parts and len(fallback_parts) > 1:
        # Thử bỏ số nhà/tên đường cụ thể
        candidates.append(", ".join(fallback_parts[1:]))
        # Thử chỉ Quận, Thành phố
        if len(fallback_parts) > 2:
            candidates.append(", ".join(fallback_parts[-2:]))
        # Thử chỉ Thành phố
        candidates.append(fallback_parts[-1])

    for q in candidates:
        try:
            # Tôn trọng rate limit của Nominatim
            time.sleep(1.1)
            
            params = {
                "q": q,
                "format": "json",
                "limit": 1
            }
            
            with httpx.Client(timeout=10.0) as client:
                response = client.get(url, params=params, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                if data and len(data) > 0:
                    lat = float(data[0]["lat"])
                    lng = float(data[0]["lon"])
                    return lat, lng
        except Exception as e:
            logger.error(f"Error geocoding {q}: {str(e)}")
            
    return None, None
