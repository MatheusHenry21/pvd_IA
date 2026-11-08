from django.conf import settings
from django.db import IntegrityError, OperationalError
from rest_framework.response import Response
from django.db.models.deletion import ProtectedError
from rest_framework import viewsets
from rest_framework.permissions import BasePermission
from rest_framework.exceptions import ValidationError
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
