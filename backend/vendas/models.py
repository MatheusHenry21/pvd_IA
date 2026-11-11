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
    installment_count = models.PositiveSmallIntegerField(default=1)
    first_due_date = models.DateField(null=True, blank=True)
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


class Parcela(models.Model):
    STATUS_CHOICES = [('pendente', 'Pendente'), ('pago', 'Pago')]
    PAYMENT_METHODS = [
        ('dinheiro', 'Dinheiro'),
        ('pix', 'PIX'),
        ('debito', 'Cartão de débito'),
        ('credito', 'Cartão de crédito'),
    ]

    sale = models.ForeignKey(Venda, on_delete=models.CASCADE, related_name='installments')
    number = models.PositiveSmallIntegerField()
    due_date = models.DateField()
    value = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pendente')
    paid_at = models.DateTimeField(null=True, blank=True)
    paid_by = models.CharField(max_length=150, blank=True)
    payment_method = models.CharField(max_length=12, choices=PAYMENT_METHODS, blank=True)
    payment_observation = models.TextField(blank=True)

    class Meta:
        ordering = ['due_date', 'sale_id', 'number']
        constraints = [
            models.UniqueConstraint(fields=['sale', 'number'], name='parcela_sale_number_unique'),
            models.CheckConstraint(condition=models.Q(number__gt=0), name='parcela_number_positive'),
            models.CheckConstraint(condition=models.Q(value__gt=0), name='parcela_value_positive'),
        ]
