from decimal import Decimal
from rest_framework import serializers

class OpenSerializer(serializers.Serializer):
    initial_value = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    request_id = serializers.UUIDField()

class MovementSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=['venda', 'suprimento', 'sangria'])
    value = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    description = serializers.CharField(max_length=255)
    notes = serializers.CharField(max_length=2000, allow_blank=True, default='')
    request_id = serializers.UUIDField()

class CloseSerializer(serializers.Serializer):
    counted_value = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0)
    notes = serializers.CharField(max_length=2000, allow_blank=True, default='')
