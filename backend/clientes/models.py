from django.db import models
from django.core.validators import MinValueValidator

class Cliente(models.Model):
    name = models.CharField(max_length=200)
    cpf = models.CharField(max_length=11, unique=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    debt_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['name', 'id']
        constraints = [models.CheckConstraint(condition=models.Q(credit_limit__gte=0), name='cliente_credit_nonnegative'), models.CheckConstraint(condition=models.Q(debt_balance__gte=0), name='cliente_debt_nonnegative')]
    def __str__(self):
        return self.name
