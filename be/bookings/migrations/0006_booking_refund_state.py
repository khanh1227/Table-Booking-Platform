from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0005_alter_booking_customer_alter_booking_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="deposit_refund_status",
            field=models.CharField(
                choices=[
                    ("NONE", "Không hoàn tiền"),
                    ("PENDING", "Đang hoàn tiền"),
                    ("SUCCESS", "Đã hoàn tiền"),
                    ("FAILED", "Hoàn tiền thất bại"),
                ],
                default="NONE",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="booking",
            name="refunded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
