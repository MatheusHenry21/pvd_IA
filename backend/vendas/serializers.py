from rest_framework import serializers
from .models import ItemVenda, Venda


class ItemVendaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemVenda
        fields = ['product_name', 'product_code', 'quantity', 'unit_price', 'line_total']


class VendaSerializer(serializers.ModelSerializer):
    items = ItemVendaSerializer(many=True, read_only=True)
    client = serializers.CharField(source='customer_name', read_only=True)

    class Meta:
        model = Venda
        fields = [
            'id', 'created_at', 'client', 'customer_name', 'payment_method',
            'subtotal', 'discount', 'total', 'cash_received', 'change',
            'operator', 'observation', 'items',
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
