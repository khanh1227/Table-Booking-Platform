from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from bookings.models import Booking
from .models import Wallet, Transaction

@receiver(post_save, sender=Booking)
def handle_booking_completion(sender, instance, created, **kwargs):
    """
    Khi Booking chuyển sang COMPLETED, giải tỏa tiền cọc từ frozen_balance sang balance.
    """
    if not created and instance.status == 'COMPLETED':
        # Kiểm tra xem có tiền cọc đã thanh toán chưa
        if instance.is_deposit_paid and instance.deposit_amount > 0:
            restaurant = instance.restaurant
            partner = restaurant.partner
            
            # Đảm bảo có ví
            wallet, _ = Wallet.objects.get_or_create(partner=partner)
            
            # Thực hiện chuyển tiền trong transaction atomic
            with transaction.atomic():
                # Kiểm tra xem đã quyết toán chưa (tránh chạy 2 lần)
                # Dựa vào Transaction loại 'PAYMENT' cho booking này
                if not Transaction.objects.filter(booking=instance, transaction_type='PAYMENT', status='SUCCESS').exists():
                    
                    # Giảm tiền đóng băng, tăng tiền khả dụng
                    # Lưu ý: Cần trừ đi phí sàn nếu có. Ở đây tạm tính 0% phí sàn.
                    service_fee = 0
                    actual_amount = instance.deposit_amount - service_fee
                    
                    wallet.frozen_balance -= instance.deposit_amount
                    wallet.balance += actual_amount
                    wallet.save()
                    
                    # Tạo bản ghi giao dịch quyết toán
                    Transaction.objects.create(
                        wallet=wallet,
                        booking=instance,
                        amount=actual_amount,
                        transaction_type='PAYMENT',
                        status='SUCCESS',
                        payment_method='SYSTEM_SETTLEMENT'
                    )
                    
                    print(f"Settled deposit for booking {instance.id}: {actual_amount} moved to available balance.")
