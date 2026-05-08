from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0006_booking_refund_state"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="finalized_at",
            field=models.DateTimeField(blank=True, help_text="Thời điểm nhà hàng/hệ thống chốt kết quả phục vụ", null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="settlement_available_at",
            field=models.DateTimeField(blank=True, help_text="Thời điểm tiền cọc trở thành khả dụng cho nhà hàng", null=True),
        ),
    ]
