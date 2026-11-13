# Generated for reporting of abandoned sales carts.
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('vendas', '0003_parcela_payment_method')]

    operations = [
        migrations.CreateModel(
            name='CancelamentoVenda',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('request_id', models.UUIDField(unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('operator', models.CharField(max_length=150)),
                ('item_count', models.PositiveIntegerField()),
                ('amount', models.DecimalField(decimal_places=2, max_digits=14)),
                ('payment_method', models.CharField(blank=True, choices=[('dinheiro', 'Dinheiro'), ('pix', 'PIX'), ('credito', 'Cartão de crédito'), ('debito', 'Cartão de débito'), ('crediario', 'Crediário')], max_length=12)),
            ],
            options={'ordering': ['-created_at', '-id']},
        ),
        migrations.AddConstraint(
            model_name='cancelamentovenda',
            constraint=models.CheckConstraint(condition=models.Q(('item_count__gt', 0)), name='cancelamento_venda_items_positive'),
        ),
        migrations.AddConstraint(
            model_name='cancelamentovenda',
            constraint=models.CheckConstraint(condition=models.Q(('amount__gte', 0)), name='cancelamento_venda_amount_nonnegative'),
        ),
    ]
