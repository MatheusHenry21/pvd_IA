from django.conf import settings
from django.db import models
from django.db.models import Q

class Caixa(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT)
    responsible = models.CharField(max_length=150)
    opened_at = models.DateTimeField(auto_now_add=True)
    initial_value = models.DecimalField(max_digits=12, decimal_places=2)
    balance = models.DecimalField(max_digits=14, decimal_places=2)
    is_open = models.BooleanField(default=True)
    request_id = models.UUIDField(unique=True)
    closed_by = models.CharField(max_length=150, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    counted_value = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    closing_notes = models.TextField(blank=True)
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['is_open'], condition=Q(is_open=True), name='one_open_caixa'),
            models.CheckConstraint(condition=Q(initial_value__gte=0), name='caixa_initial_nonnegative'),
            models.CheckConstraint(condition=Q(balance__gte=0), name='caixa_balance_nonnegative'),
        ]

class Movimentacao(models.Model):
    caixa = models.ForeignKey(Caixa, related_name='movements', on_delete=models.PROTECT)
    category = models.CharField(max_length=10, choices=[('venda','Venda'), ('suprimento','Suprimento'), ('sangria','Sangria')])
    value = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    responsible = models.CharField(max_length=150)
    request_id = models.UUIDField(unique=True)
    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [models.CheckConstraint(condition=Q(value__gt=0), name='movement_positive')]
