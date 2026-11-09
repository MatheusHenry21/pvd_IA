from django.contrib import admin
from .models import Cliente

@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('name', 'cpf', 'phone', 'credit_limit', 'debt_balance', 'active')
    search_fields = ('name', 'cpf', 'phone')
    list_filter = ('active',)
