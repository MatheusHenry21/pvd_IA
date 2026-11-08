from rest_framework import serializers
from .models import Produto, Categoria

class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'name']
    def validate_name(self, value):
        if Categoria.objects.filter(name__iexact=value).exclude(pk=getattr(self.instance, 'pk', None)).exists():
            raise serializers.ValidationError('Essa categoria jÃ¡ existe.')
        return value

class ProdutoSerializer(serializers.ModelSerializer):
    stock = serializers.IntegerField(min_value=0, max_value=2147483647, required=False)
    category = serializers.SlugRelatedField(slug_field='name', queryset=Categoria.objects.all())
    class Meta:
        model = Produto
        fields = ['id', 'name', 'code', 'category', 'price', 'stock', 'active']
