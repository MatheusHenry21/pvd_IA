from calendar import monthrange
from datetime import date
from decimal import Decimal
from uuid import uuid4

from django.db import IntegrityError, OperationalError, transaction
from django.db.models import Case, F, IntegerField, Q, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from caixa.models import Caixa, Movimentacao
from clientes.models import Cliente
from produtos.models import Produto
from .models import ItemVenda, Parcela, Venda
from .serializers import InstallmentPaymentSerializer, ParcelaSerializer, VendaCreateSerializer, VendaSerializer


def add_months(anchor: date, months: int) -> date:
    month_index = anchor.month - 1 + months
    year = anchor.year + month_index // 12
    month = month_index % 12 + 1
    day = min(anchor.day, monthrange(year, month)[1])
    return date(year, month, day)


def create_installments(sale: Venda, count: int, first_due_date: date) -> None:
    total_cents = int(sale.total * 100)
    regular_cents = total_cents // count
    rows = []
    for index in range(count):
        cents = regular_cents if index < count - 1 else total_cents - regular_cents * (count - 1)
        rows.append(Parcela(
            sale=sale,
            number=index + 1,
            due_date=add_months(first_due_date, index),
            value=Decimal(cents) / 100,
        ))
    Parcela.objects.bulk_create(rows)


class SalesView(APIView):
    permission_classes = [IsAuthenticated]

    def handle_exception(self, exc):
        if isinstance(exc, IntegrityError):
            return Response({'detail': 'Conflito ao registrar a venda. Atualize os dados e tente novamente.'}, status=409)
        if isinstance(exc, OperationalError) and 'locked' in str(exc).lower():
            return Response({'detail': 'Banco ocupado. Aguarde e tente novamente.'}, status=503, headers={'Retry-After': '1'})
        return super().handle_exception(exc)

    def get(self, request):
        sales = Venda.objects.select_related('customer').prefetch_related('items', 'installments').order_by('-created_at', '-id')[:10]
        return Response({'results': VendaSerializer(sales, many=True).data})

    def post(self, request):
        serializer = VendaCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            existing = Venda.objects.filter(request_id=data['request_id']).prefetch_related('items', 'installments').first()
            if existing:
                return Response(VendaSerializer(existing).data)

            caixa = Caixa.objects.select_for_update().filter(is_open=True).first()
            if caixa is None:
                return Response({'detail': 'Abra o caixa antes de registrar uma venda.'}, status=409)

            products = {}
            required_stock = {}
            for line in data['items']:
                product = get_object_or_404(Produto.objects.select_related('category'), pk=line['product_id'])
                if not product.active:
                    return Response({'detail': f'{product.name} está inativo.'}, status=400)
                products[product.pk] = product
                required_stock[product.pk] = required_stock.get(product.pk, 0) + line['quantity']

            subtotal = sum(
                (products[line['product_id']].price * line['quantity'] for line in data['items']),
                Decimal('0.00'),
            )
            discount = data.get('discount', Decimal('0.00'))
            if discount > subtotal:
                return Response({'detail': 'O desconto não pode ser maior que o subtotal.'}, status=400)
            total = subtotal - discount
            if total <= 0:
                return Response({'detail': 'O total da venda deve ser maior que zero.'}, status=400)
            method = data['payment_method']
            if method == 'crediario' and int(total * 100) < data['installment_count']:
                return Response({'detail': 'O valor da venda é baixo demais para a quantidade de parcelas escolhida.'}, status=400)

            client = None
            if data.get('client_id'):
                client = get_object_or_404(Cliente, pk=data['client_id'])
                if not client.active:
                    return Response({'detail': 'O cliente selecionado está inativo.'}, status=400)
            if method == 'crediario':
                if client is None:
                    return Response({'detail': 'Selecione um cliente para vender no crediário.'}, status=400)
                if client.debt_balance + total > client.credit_limit:
                    return Response({'detail': 'A venda ultrapassa o limite de crédito disponível do cliente.'}, status=400)

            cash_received = data.get('cash_received')
            change = Decimal('0.00')
            if method == 'dinheiro':
                if cash_received is None or cash_received < total:
                    return Response({'detail': 'O valor recebido em dinheiro deve ser igual ou maior que o total.'}, status=400)
                change = cash_received - total
            else:
                cash_received = None

            for product_id, quantity in required_stock.items():
                if not Produto.objects.filter(pk=product_id, active=True, stock__gte=quantity).update(stock=F('stock') - quantity):
                    raise ValidationError({'detail': f'Estoque insuficiente para {products[product_id].name}.'})

            user = request.user
            operator = user.get_full_name().strip() or user.get_username()
            sale = Venda.objects.create(
                customer=client,
                customer_name=client.name if client else 'Consumidor final',
                operator=operator,
                payment_method=method,
                installment_count=data['installment_count'] if method == 'crediario' else 1,
                first_due_date=data.get('first_due_date') if method == 'crediario' else None,
                subtotal=subtotal,
                discount=discount,
                total=total,
                cash_received=cash_received,
                change=change,
                observation=data.get('observation', '').strip(),
                request_id=data['request_id'],
            )
            for line in data['items']:
                product = products[line['product_id']]
                quantity = line['quantity']
                ItemVenda.objects.create(
                    sale=sale, product=product, product_name=product.name,
                    product_code=product.code, quantity=quantity,
                    unit_price=product.price, line_total=product.price * quantity,
                )

            if method == 'crediario' and client:
                if not Cliente.objects.filter(
                    pk=client.pk, active=True,
                    debt_balance__lte=F('credit_limit') - total,
                ).update(debt_balance=F('debt_balance') + total):
                    raise ValidationError({'detail': 'O cliente não possui limite de crédito disponível para esta venda.'})
                create_installments(sale, data['installment_count'], data['first_due_date'])

            # Crediário vira entrada de caixa quando cada parcela for paga.
            if method != 'crediario':
                if not Caixa.objects.filter(
                    pk=caixa.pk, is_open=True,
                    balance__lte=Decimal('999999999999.99') - total,
                ).update(balance=F('balance') + total):
                    raise ValidationError({'detail': 'O caixa foi fechado ou atingiu o limite de saldo. A venda não foi registrada.'})
                Movimentacao.objects.create(
                    caixa=caixa,
                    category='venda',
                    value=total,
                    description=f'Venda #{sale.pk} · {sale.customer_name}'[:255],
                    notes=f'Pagamento: {dict(Venda.PAYMENT_METHODS)[method]}' + (f' · {sale.observation}' if sale.observation else ''),
                    responsible=operator,
                    request_id=data['request_id'],
                )

            sale = Venda.objects.prefetch_related('items', 'installments').get(pk=sale.pk)
            return Response(VendaSerializer(sale).data, status=201)


class ProductSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        search = request.query_params.get('search', '').strip()[:100]
        queryset = Produto.objects.filter(active=True)
        if search:
            queryset = queryset.filter(Q(code__icontains=search) | Q(name__icontains=search)).annotate(
                match_rank=Case(
                    When(code__iexact=search, then=Value(0)),
                    When(code__istartswith=search, then=Value(1)),
                    When(name__istartswith=search, then=Value(2)),
                    default=Value(3),
                    output_field=IntegerField(),
                )
            ).order_by('match_rank', 'name', 'id')
        else:
            queryset = queryset.order_by('name', 'id')
        results = [{
            'id': product.id,
            'code': product.code,
            'name': product.name,
            'price': str(product.price),
            'stock': product.stock,
        } for product in queryset[:8]]
        return Response({'results': results})


class InstallmentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Parcela.objects.select_related('sale', 'sale__customer')
        search = request.query_params.get('search', '').strip()[:100]
        status = request.query_params.get('status', 'all')
        today = timezone.localdate()
        if search:
            digits = ''.join(character for character in search if character.isdigit())
            query = Q(sale__customer_name__icontains=search) | Q(sale__customer__cpf__icontains=digits or search)
            if digits:
                query |= Q(sale_id=int(digits)) if int(digits) <= 2147483647 else Q(pk__in=[])
            queryset = queryset.filter(query)
        if status == 'pago':
            queryset = queryset.filter(status='pago')
        elif status == 'pendente':
            queryset = queryset.filter(status='pendente', due_date__gte=today)
        elif status == 'vencido':
            queryset = queryset.filter(status='pendente', due_date__lt=today)
        elif status != 'all':
            return Response({'detail': 'Filtro de status inválido.'}, status=400)
        rows = queryset.order_by('due_date', 'sale_id', 'number')
        return Response({'results': ParcelaSerializer(rows, many=True).data})


class PayInstallmentView(SalesView):
    def post(self, request, pk):
        serializer = InstallmentPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        observation = serializer.validated_data.get('observation', '').strip()
        with transaction.atomic():
            caixa = Caixa.objects.select_for_update().filter(is_open=True).first()
            if caixa is None:
                return Response({'detail': 'Abra o caixa antes de receber uma parcela.'}, status=409)
            installment = get_object_or_404(
                Parcela.objects.select_for_update().select_related('sale', 'sale__customer'),
                pk=pk,
            )
            if installment.status == 'pago':
                return Response({'detail': 'Esta parcela já foi paga.'}, status=409)

            now = timezone.now()
            operator = request.user.get_full_name().strip() or request.user.get_username()
            if not Parcela.objects.filter(pk=installment.pk, status='pendente').update(
                status='pago', paid_at=now, paid_by=operator,
                payment_observation=observation,
            ):
                return Response({'detail': 'Esta parcela já foi paga.'}, status=409)

            if installment.sale.customer_id and not Cliente.objects.filter(
                pk=installment.sale.customer_id,
                debt_balance__gte=installment.value,
            ).update(debt_balance=F('debt_balance') - installment.value):
                raise ValidationError({'detail': 'O saldo devedor do cliente não cobre esta parcela.'})

            if not Caixa.objects.filter(
                pk=caixa.pk, is_open=True,
                balance__lte=Decimal('999999999999.99') - installment.value,
            ).update(balance=F('balance') + installment.value):
                raise ValidationError({'detail': 'O caixa foi fechado ou atingiu o limite de saldo. O pagamento não foi registrado.'})

            Movimentacao.objects.create(
                caixa=caixa,
                category='venda',
                value=installment.value,
                description=f'Parcela {installment.number}/{installment.sale.installment_count} da venda #{installment.sale_id}',
                notes=observation or 'Recebimento de crediário',
                responsible=operator,
                request_id=uuid4(),
            )
            installment.refresh_from_db()
            return Response(ParcelaSerializer(installment).data)
