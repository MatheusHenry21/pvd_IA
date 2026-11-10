import re
from django.db.models import Case, IntegerField, Q, Value, When
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from .models import Cliente
from .serializers import ClienteSerializer

class ClientePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

class ClienteViewSet(viewsets.ModelViewSet):
    serializer_class = ClienteSerializer
    pagination_class = ClientePagination
    def filter_queryset(self, queryset):
        search = self.request.query_params.get('search', '').strip()
        if not search:
            return queryset
        digits = re.sub(r'\D', '', search)
        matching = Q(name__icontains=search) | Q(cpf__icontains=digits or search) | Q(phone__icontains=digits or search)
        return queryset.filter(matching).annotate(
            match_rank=Case(
                When(name__iexact=search, then=Value(0)),
                When(name__istartswith=search, then=Value(1)),
                When(name__icontains=search, then=Value(2)),
                default=Value(3),
                output_field=IntegerField(),
            )
        ).order_by('match_rank', 'name', 'id')
    def get_queryset(self):
        queryset = Cliente.objects.all()
        active = self.request.query_params.get('active')
        if active in ('true', 'false'):
            queryset = queryset.filter(active=(active == 'true'))
        return queryset
    def perform_destroy(self, instance):
        if instance.debt_balance > 0:
            raise ValidationError({'detail': 'Não é possível excluir um cliente com saldo devedor. Inative o cadastro ou quite a dívida.'})
        instance.delete()
