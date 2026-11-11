from rest_framework import serializers
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .models import ItemVenda, Parcela, Venda


class ItemVendaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemVenda
        fields = ['product_name', 'product_code', 'quantity', 'unit_price', 'line_total']


class ParcelaSerializer(serializers.ModelSerializer):
    sale = serializers.SerializerMethodField()
    client = serializers.CharField(source='sale.customer_name', read_only=True)
    client_cpf = serializers.CharField(source='sale.customer.cpf', read_only=True, allow_null=True)
    num = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    payment_date = serializers.DateTimeField(source='paid_at', read_only=True)
    payment_operator = serializers.CharField(source='paid_by', read_only=True)
    payment_observation = serializers.CharField(read_only=True)

    class Meta:
        model = Parcela
        fields = [
            'id', 'sale', 'sale_id', 'client', 'client_cpf', 'num', 'number', 'due_date',
            'value', 'status', 'payment_date', 'payment_operator',
            'payment_method', 'payment_observation',
        ]

    def get_sale(self, obj):
        return f'#{obj.sale_id}'

    def get_num(self, obj):
        return f'{obj.number}/{obj.sale.installment_count}'

    def get_status(self, obj):
        if obj.status == 'pago':
            return 'pago'
        return 'vencido' if obj.due_date < timezone.localdate() else 'pendente'


class VendaSerializer(serializers.ModelSerializer):
    items = ItemVendaSerializer(many=True, read_only=True)
    installments = ParcelaSerializer(many=True, read_only=True)
    client = serializers.CharField(source='customer_name', read_only=True)

    class Meta:
        model = Venda
        fields = [
            'id', 'created_at', 'client', 'customer_name', 'payment_method',
            'subtotal', 'discount', 'total', 'cash_received', 'change',
            'operator', 'observation', 'items', 'installment_count',
            'first_due_date', 'installments',
        ]


class SaleItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=100000)


class VendaCreateSerializer(serializers.Serializer):
    request_id = serializers.UUIDField()
    items = SaleItemInputSerializer(many=True, allow_empty=False)
    payment_method = serializers.ChoiceField(choices=[method[0] for method in Venda.PAYMENT_METHODS])
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, required=False, default=0)
    cash_received = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0, required=False, allow_null=True)
    client_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    observation = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    installment_count = serializers.IntegerField(min_value=1, max_value=12, required=False, default=1)
    first_due_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, data):
        if data['payment_method'] == 'crediario':
            if not data.get('client_id'):
                raise ValidationError({'client_id': 'Selecione um cliente para vender no crediário.'})
            if not data.get('first_due_date'):
                raise ValidationError({'first_due_date': 'Informe a data do primeiro vencimento.'})
            if data['first_due_date'] < timezone.localdate():
                raise ValidationError({'first_due_date': 'O primeiro vencimento não pode estar no passado.'})
        return data


class InstallmentPaymentSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=[method[0] for method in Parcela.PAYMENT_METHODS])
    observation = serializers.CharField(required=False, allow_blank=True, max_length=5000)
