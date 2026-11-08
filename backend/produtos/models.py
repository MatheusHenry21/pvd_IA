from django.db import models
from django.core.validators import MinValueValidator

class Categoria(models.Model):
    name = models.CharField(max_length=100, unique=True)
    class Meta:
        ordering = ['name']
    def __str__(self):
        return self.name

class Produto(models.Model):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=64, unique=True)
    category = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name='products')
    price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    stock = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)
    class Meta:
        ordering = ['-id']
        constraints = [models.CheckConstraint(condition=models.Q(price__gte=0), name='produto_price_nonnegative')]
    def __str__(self):
        return self.name
