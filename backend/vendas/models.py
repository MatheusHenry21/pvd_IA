from django.conf import settings
from django.db import models


class Venda(models.Model):
    PAYMENT_METHODS = [
        ('dinheiro', 'Dinheiro'),
        ('pix', 'PIX'),
        ('credito', 'Cartão de crédito'),
        ('debito', 'Cartão de débito'),
        ('crediario', 'Crediário'),
    ]

    customer = models.ForeignKey(
        'clientes.Cliente', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='sales',
    )
    customer_name = models.CharField(max_length=200, default='Consumidor final')
    operator = models.CharField(max_length=150)
    created_at = models.DateTimeField(auto_now_add=True)
    payment_method = models.CharField(max_length=12, choices=PAYMENT_METHODS)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    cash_received = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    change = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    observation = models.TextField(blank=True)
    request_id = models.UUIDField(unique=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.CheckConstraint(condition=models.Q(subtotal__gte=0), name='venda_subtotal_nonnegative'),
            models.CheckConstraint(condition=models.Q(discount__gte=0), name='venda_discount_nonnegative'),
            models.CheckConstraint(condition=models.Q(total__gte=0), name='venda_total_nonnegative'),
        ]


class ItemVenda(models.Model):
    sale = models.ForeignKey(Venda, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('produtos.Produto', on_delete=models.PROTECT, related_name='sale_items')
    product_name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=64)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name='item_venda_quantity_positive'),
        ]
