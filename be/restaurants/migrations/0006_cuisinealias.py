from django.db import migrations, models


def seed_cuisine_aliases(apps, schema_editor):
    CuisineAlias = apps.get_model('restaurants', 'CuisineAlias')

    seed_data = {
        'buffet': {
            'CUISINE': ['buffet', 'bbq', 'lẩu nướng'],
            'DISH': ['buffet', 'combo', 'set', 'nướng', 'lẩu'],
        },
        'lẩu': {
            'CUISINE': ['lẩu', 'hotpot', 'bbq'],
            'DISH': ['lẩu', 'hotpot'],
        },
        'nướng': {
            'CUISINE': ['nướng', 'bbq', 'yakiniku'],
            'DISH': ['nướng', 'grill', 'yakiniku', 'bbq'],
        },
        'hải sản': {
            'CUISINE': ['hải sản', 'seafood'],
            'DISH': ['hải sản', 'tôm', 'cua', 'mực', 'nghêu', 'sò', 'lobster'],
        },
        'quán nhậu': {
            'CUISINE': ['quán nhậu', 'bbq', 'hải sản'],
            'DISH': ['nhậu', 'bia', 'lẩu', 'nướng', 'gỏi'],
        },
        'món nhật': {
            'CUISINE': ['nhật', 'nhật bản', 'japan', 'japanese'],
            'DISH': ['sushi', 'sashimi', 'ramen', 'tempura', 'udon', 'yakitori'],
        },
        'món việt': {
            'CUISINE': ['việt', 'món việt', 'việt nam'],
            'DISH': ['phở', 'bún', 'cơm tấm', 'gỏi cuốn', 'bánh xèo', 'nem'],
        },
        'món hàn': {
            'CUISINE': ['hàn', 'hàn quốc', 'korean'],
            'DISH': ['kimchi', 'tokbokki', 'bulgogi', 'bibimbap', 'kimbap'],
        },
    }

    records = []
    for canonical_name, targets in seed_data.items():
        for alias in targets.get('CUISINE', []):
            records.append(
                CuisineAlias(
                    canonical_name=canonical_name,
                    alias=alias,
                    match_target='CUISINE',
                    is_active=True,
                )
            )
        for alias in targets.get('DISH', []):
            records.append(
                CuisineAlias(
                    canonical_name=canonical_name,
                    alias=alias,
                    match_target='DISH',
                    is_active=True,
                )
            )
    CuisineAlias.objects.bulk_create(records, ignore_conflicts=True)


def unseed_cuisine_aliases(apps, schema_editor):
    CuisineAlias = apps.get_model('restaurants', 'CuisineAlias')
    CuisineAlias.objects.filter(
        canonical_name__in=[
            'buffet', 'lẩu', 'nướng', 'hải sản',
            'quán nhậu', 'món nhật', 'món việt', 'món hàn'
        ]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0005_restaurant_price_range'),
    ]

    operations = [
        migrations.CreateModel(
            name='CuisineAlias',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('canonical_name', models.CharField(help_text='Tên chuẩn hiển thị trên FE, ví dụ: Lẩu, Nướng, Món Nhật', max_length=100)),
                ('alias', models.CharField(help_text='Từ khoá đồng nghĩa để match, ví dụ: hotpot, yakiniku, seafood', max_length=100)),
                ('match_target', models.CharField(choices=[('CUISINE', 'Cuisine Type'), ('DISH', 'Dish / Menu')], default='CUISINE', help_text='Match vào cuisine_type hay menu item', max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Cuisine Alias',
                'verbose_name_plural': 'Cuisine Aliases',
                'db_table': 'cuisine_aliases',
                'ordering': ['canonical_name', 'alias'],
            },
        ),
        migrations.AddIndex(
            model_name='cuisinealias',
            index=models.Index(fields=['canonical_name'], name='cuisine_ali_canonical_dbb546_idx'),
        ),
        migrations.AddIndex(
            model_name='cuisinealias',
            index=models.Index(fields=['alias'], name='cuisine_ali_alias_54d8f5_idx'),
        ),
        migrations.AddIndex(
            model_name='cuisinealias',
            index=models.Index(fields=['is_active'], name='cuisine_ali_is_acti_a29972_idx'),
        ),
        migrations.AddConstraint(
            model_name='cuisinealias',
            constraint=models.UniqueConstraint(fields=('canonical_name', 'alias', 'match_target'), name='unique_canonical_alias_target'),
        ),
        migrations.RunPython(seed_cuisine_aliases, reverse_code=unseed_cuisine_aliases),
    ]
