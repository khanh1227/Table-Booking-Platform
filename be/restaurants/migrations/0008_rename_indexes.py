from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0007_location_codes'),
    ]

    operations = [
        migrations.RenameIndex(
            model_name='cuisinealias',
            new_name='cuisine_ali_canonic_1a1216_idx',
            old_name='cuisine_ali_canonical_dbb546_idx',
        ),
        migrations.RenameIndex(
            model_name='cuisinealias',
            new_name='cuisine_ali_alias_08190a_idx',
            old_name='cuisine_ali_alias_54d8f5_idx',
        ),
        migrations.RenameIndex(
            model_name='cuisinealias',
            new_name='cuisine_ali_is_acti_a7d459_idx',
            old_name='cuisine_ali_is_acti_a29972_idx',
        ),
        migrations.RenameIndex(
            model_name='location',
            new_name='locations_provinc_4fd08f_idx',
            old_name='locations_province_9306f0_idx',
        ),
        migrations.RenameIndex(
            model_name='location',
            new_name='locations_distric_50aa45_idx',
            old_name='locations_district_ca44f8_idx',
        ),
        migrations.RenameIndex(
            model_name='location',
            new_name='locations_ward_co_f919aa_idx',
            old_name='locations_ward_cod_6b94e1_idx',
        ),
    ]
