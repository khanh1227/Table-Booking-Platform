from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0004_alter_depositpolicy_is_required"),
    ]

    operations = [
        migrations.AddField(
            model_name="transaction",
            name="note",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="transaction",
            name="provider_create_date",
            field=models.CharField(blank=True, max_length=14, null=True),
        ),
        migrations.AddField(
            model_name="transaction",
            name="provider_pay_date",
            field=models.CharField(blank=True, max_length=14, null=True),
        ),
        migrations.AddField(
            model_name="transaction",
            name="provider_response_code",
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name="transaction",
            name="provider_transaction_no",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
