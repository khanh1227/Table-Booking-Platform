from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_user_last_city_user_last_district_user_last_latitude_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="credit_balance",
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=12),
        ),
    ]
