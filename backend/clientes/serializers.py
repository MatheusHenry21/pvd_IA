import re
from rest_framework import serializers
from .models import Cliente

class ClienteSerializer(serializers.ModelSerializer):
    cpf = serializers.CharField(max_length=14, write_only=False)
    class Meta:
        model = Cliente
        fields = ['id', 'name', 'cpf', 'phone', 'email', 'credit_limit', 'debt_balance', 'active', 'created_at', 'updated_at', 'purchase_count', 'purchases']
        read_only_fields = ['id', 'debt_balance', 'created_at', 'updated_at', 'purchase_count', 'purchases']
    purchase_count = serializers.SerializerMethodField()
    purchases = serializers.SerializerMethodField()
    def get_purchase_count(self, obj):
        return obj.sales.count()
    def get_purchases(self, obj):
        from django.utils import timezone
        from vendas.models import Venda

        methods = dict(Venda.PAYMENT_METHODS)
        sales = obj.sales.order_by('-created_at', '-id')[:10]
        return [{
            'id': f'#{sale.id}',
            'date': timezone.localtime(sale.created_at).strftime('%d/%m/%Y %H:%M'),
            'total': float(sale.total),
            'method': methods[sale.payment_method],
            'status': 'Concluída',
        } for sale in sales]
    def validate_cpf(self, value):
        digits = re.sub(r'\D', '', value)
        if len(digits) != 11 or len(set(digits)) == 1:
            raise serializers.ValidationError('Informe um CPF válido com 11 dígitos.')
        def digit(base, weight):
            result = sum(int(n) * w for n, w in zip(base, weight)) % 11
            return '0' if result < 2 else str(11 - result)
        if digit(digits[:9], range(10, 1, -1)) != digits[9] or digit(digits[:10], range(11, 1, -1)) != digits[10]:
            raise serializers.ValidationError('CPF inválido.')
        query = Cliente.objects.filter(cpf=digits)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError('Já existe cliente cadastrado com este CPF.')
        return digits
    def validate_phone(self, value):
        return re.sub(r'\D', '', value)
    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('O nome é obrigatório.')
        return value
