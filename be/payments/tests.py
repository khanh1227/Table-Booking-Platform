import hashlib
import hmac
import urllib.parse
from datetime import date, timedelta

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Customer, Partner, User
from bookings.models import Booking
from payments.models import DepositPolicy, Transaction, Wallet
from restaurants.models import Location, Restaurant, TimeSlot


def build_vnpay_hash(data, secret_key):
    items = sorted((k, v) for k, v in data.items() if k.startswith("vnp_") and k not in {"vnp_SecureHash", "vnp_SecureHashType"})
    encoded = "&".join(f"{k}={urllib.parse.quote_plus(str(v))}" for k, v in items)
    return hmac.new(secret_key.encode("utf-8"), encoded.encode("utf-8"), hashlib.sha512).hexdigest()


class PaymentFlowTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            phone_number="0901234567",
            password="test123",
            full_name="Test Customer",
            role="CUSTOMER",
        )
        self.partner_user = User.objects.create_user(
            phone_number="0909876543",
            password="test123",
            full_name="Test Partner",
            role="PARTNER",
        )
        self.partner = Partner.objects.create(
            user=self.partner_user,
            business_name="Test Partner Co",
        )
        self.location = Location.objects.create(city="HCM")
        self.restaurant = Restaurant.objects.create(
            partner=self.partner,
            name="Test Restaurant",
            address="Test Address",
            location=self.location,
            status="APPROVED",
        )
        self.time_slot = TimeSlot.objects.create(
            restaurant=self.restaurant,
            start_time="18:00",
            end_time="20:00",
            max_bookings=5,
            max_guests_per_booking=10,
            is_active=True,
        )
        self.policy = DepositPolicy.objects.create(
            restaurant=self.restaurant,
            is_required=True,
            deposit_per_guest=50000,
            minimum_guests_for_deposit=2,
        )

    def create_booking_with_deposit(self):
        self.client.force_authenticate(user=self.customer)
        payload = {
            "restaurant": self.restaurant.id,
            "time_slot": self.time_slot.id,
            "booking_date": str(date.today() + timedelta(days=2)),
            "number_of_guests": 3,
        }
        response = self.client.post("/api/bookings/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        booking = Booking.objects.get(id=response.data["data"]["id"])
        self.assertEqual(booking.status, "PENDING")
        self.assertEqual(float(booking.deposit_amount), 150000)
        self.assertIsNotNone(booking.deposit_expires_at)
        return booking

    def test_create_vnpay_url_reuses_pending_transaction(self):
        booking = self.create_booking_with_deposit()

        response1 = self.client.post("/api/payments/create-vnpay-url/", {"booking_id": booking.id}, format="json")
        response2 = self.client.post("/api/payments/create-vnpay-url/", {"booking_id": booking.id}, format="json")

        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(
            Transaction.objects.filter(booking=booking, transaction_type="DEPOSIT", status="PENDING").count(),
            1,
        )

    def test_verify_vnpay_return_marks_booking_paid_and_freezes_wallet(self):
        booking = self.create_booking_with_deposit()
        self.client.post("/api/payments/create-vnpay-url/", {"booking_id": booking.id}, format="json")
        tx = Transaction.objects.get(booking=booking, transaction_type="DEPOSIT")

        payload = {
            "vnp_Amount": str(int(tx.amount * 100)),
            "vnp_BankCode": "NCB",
            "vnp_OrderInfo": f"Thanh toan tien coc booking #{booking.id}",
            "vnp_PayDate": "20260507220000",
            "vnp_ResponseCode": "00",
            "vnp_TmnCode": "8TXD98LZ",
            "vnp_TransactionNo": "15529999",
            "vnp_TransactionStatus": "00",
            "vnp_TxnRef": tx.transaction_id,
        }
        payload["vnp_SecureHash"] = build_vnpay_hash(payload, "J8PGKCCKUMUOAQRAJVQ9Y5N7B4CUT17V")

        response = self.client.get("/api/payments/verify-vnpay-return/", payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])

        booking.refresh_from_db()
        wallet = Wallet.objects.get(partner=self.partner)
        tx.refresh_from_db()

        self.assertTrue(booking.is_deposit_paid)
        self.assertEqual(booking.status, "CONFIRMED")
        self.assertEqual(tx.status, "SUCCESS")
        self.assertEqual(float(wallet.frozen_balance), 150000)

    def test_expire_unpaid_booking_endpoint(self):
        booking = self.create_booking_with_deposit()
        booking.deposit_expires_at = booking.deposit_expires_at - timedelta(minutes=10)
        booking.save(update_fields=["deposit_expires_at"])

        response = self.client.post("/api/bookings/expire_unpaid/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, "CANCELLED")

    def test_cancel_booking_credits_customer_balance(self):
        booking = self.create_booking_with_deposit()
        wallet = Wallet.objects.create(partner=self.partner, frozen_balance=booking.deposit_amount)
        deposit_tx = Transaction.objects.create(
            wallet=wallet,
            booking=booking,
            amount=booking.deposit_amount,
            transaction_type="DEPOSIT",
            status="SUCCESS",
            payment_method="VNPAY",
            transaction_id="123_abc",
            provider_transaction_no="15528888",
            provider_create_date="20260507203000",
        )
        booking.is_deposit_paid = True
        booking.status = "CONFIRMED"
        booking.save(update_fields=["is_deposit_paid", "status"])

        response = self.client.put(f"/api/bookings/{booking.id}/cancel/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        booking.refresh_from_db()
        wallet.refresh_from_db()
        customer = Customer.objects.get(user=self.customer)
        refund_tx = Transaction.objects.filter(booking=booking, transaction_type="REFUND").latest("created_at")

        self.assertEqual(booking.status, "CANCELLED")
        self.assertEqual(float(wallet.frozen_balance), 0)
        self.assertEqual(float(customer.credit_balance), 150000)
        self.assertEqual(refund_tx.status, "SUCCESS")
        self.assertEqual(deposit_tx.status, "SUCCESS")
