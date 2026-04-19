from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0006_cuisinealias'),
    ]

    operations = [
        migrations.AddField(
            model_name='location',
            name='district_code',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='location',
            name='province_code',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='location',
            name='ward_code',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddIndex(
            model_name='location',
            index=models.Index(fields=['province_code'], name='locations_province_9306f0_idx'),
        ),
        migrations.AddIndex(
            model_name='location',
            index=models.Index(fields=['district_code'], name='locations_district_ca44f8_idx'),
        ),
        migrations.AddIndex(
            model_name='location',
            index=models.Index(fields=['ward_code'], name='locations_ward_cod_6b94e1_idx'),
        ),
    ]
