from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0005_transaction_gateway_fields_and_booking_refund_state"),
    ]

    operations = [
        migrations.AddField(
            model_name="wallet",
            name="settlement_balance",
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=12),
        ),
    ]
