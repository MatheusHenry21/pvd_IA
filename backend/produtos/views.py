from django.conf import settings
from django.db import IntegrityError, OperationalError
from rest_framework.response import Response
from django.db.models.deletion import ProtectedError
from rest_framework import viewsets
from rest_framework.permissions import BasePermission
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView
from django.db.models import Count, F, Q
from .models import Produto, Categoria
from .serializers import ProdutoSerializer, CategoriaSerializer

class LocalDevelopmentOrAuthenticated(BasePermission):
    def has_permission(self, request, view):
        return settings.DEBUG or bool(request.user and request.user.is_authenticated)

class ResilientModelViewSet(viewsets.ModelViewSet):
    def handle_exception(self, exc):
        if isinstance(exc, IntegrityError):
            return Response({'detail': 'Conflito ao salvar. Verifique o código único e a categoria e tente novamente.'}, status=400)
        if isinstance(exc, OperationalError) and 'locked' in str(exc).lower():
            return Response({'detail': 'Banco ocupado. Aguarde e tente novamente.'}, status=503, headers={'Retry-After': '1'})
        return super().handle_exception(exc)

class ProdutoViewSet(ResilientModelViewSet):
    queryset = Produto.objects.select_related('category').all()
    serializer_class = ProdutoSerializer
    permission_classes = [LocalDevelopmentOrAuthenticated]

class CategoriaViewSet(ResilientModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [LocalDevelopmentOrAuthenticated]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']
    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({'detail': 'Categoria em uso por produtos.'})

class StockReportView(APIView):
    permission_classes = [LocalDevelopmentOrAuthenticated]

    def get(self, request):
        active_products = Produto.objects.filter(active=True)
        totals = Produto.objects.aggregate(
            registered=Count('id'),
            active=Count('id', filter=Q(active=True)),
        )
        active_totals = active_products.aggregate(
            in_stock=Count('id', filter=Q(stock__gt=0)),
            out_of_stock=Count('id', filter=Q(stock=0)),
            low_stock=Count('id', filter=Q(stock__gt=0, stock__lte=F('minimum_stock'))),
        )
        alerts = active_products.filter(stock__lte=F('minimum_stock')).select_related('category').order_by('stock', 'name')
        return Response({
            'registered_products': totals['registered'],
            'active_products': totals['active'],
            'products_in_stock': active_totals['in_stock'],
            'out_of_stock': active_totals['out_of_stock'],
            'low_stock': active_totals['low_stock'],
            'alerts': [{
                'id': product.pk,
                'name': product.name,
                'category': product.category.name,
                'stock': product.stock,
                'minimum_stock': product.minimum_stock,
                'status': 'Sem estoque' if product.stock == 0 else 'Estoque baixo',
            } for product in alerts],
        })
