from calendar import monthrange
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from uuid import uuid4

from django.db import IntegrityError, OperationalError, transaction
from django.db.models import Case, Count, F, IntegerField, Min, Q, Sum, Value, When
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from caixa.models import Caixa, Movimentacao
from clientes.models import Cliente
from produtos.models import Produto
from .models import CancelamentoVenda, ItemVenda, Parcela, Venda
from .serializers import InstallmentPaymentSerializer, ParcelaSerializer, VendaCancelamentoSerializer, VendaCreateSerializer, VendaSerializer


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


class SaleCancellationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = VendaCancelamentoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        existing = CancelamentoVenda.objects.filter(request_id=data['request_id']).first()
        if existing:
            return Response({'id': existing.pk, 'created': False})
        operator = request.user.get_full_name().strip() or request.user.get_username()
        cancellation = CancelamentoVenda.objects.create(operator=operator, **data)
        return Response({'id': cancellation.pk, 'created': True}, status=201)


class SalesReportView(APIView):
    permission_classes = [IsAuthenticated]

    @staticmethod
    def bounds(start, end):
        current_tz = timezone.get_current_timezone()
        start_dt = timezone.make_aware(datetime.combine(start, time.min), current_tz)
        end_dt = timezone.make_aware(datetime.combine(end + timedelta(days=1), time.min), current_tz)
        return start_dt, end_dt

    def summarize(self, start, end):
        start_dt, end_dt = self.bounds(start, end)
        sales = Venda.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt)
        totals = sales.aggregate(revenue=Sum('total'), sales_count=Count('id'))
        revenue = totals['revenue'] or Decimal('0.00')
        count = totals['sales_count'] or 0
        payment_rows = sales.order_by().values('payment_method').annotate(revenue=Sum('total'), count=Count('id'))
        payment_data = {row['payment_method']: row for row in payment_rows}
        payments = [{
            'method': method,
            'label': label,
            'revenue': str(payment_data.get(method, {}).get('revenue') or Decimal('0.00')),
            'count': payment_data.get(method, {}).get('count', 0),
        } for method, label in Venda.PAYMENT_METHODS]
        payments.sort(key=lambda row: (-Decimal(row['revenue']), row['label']))
        cancellations = CancelamentoVenda.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt).count()
        return {
            'revenue': str(revenue),
            'sales_count': count,
            'average_ticket': str(revenue / count if count else Decimal('0.00')),
            'cancellations': cancellations,
            'payments': payments,
        }

    def get(self, request):
        today = timezone.localdate()
        period = request.query_params.get('period', '7d')
        if period in ('7d', '30d', '90d'):
            days = int(period[:-1])
            end = today
            start = end - timedelta(days=days - 1)
        elif period == 'custom':
            try:
                start = date.fromisoformat(request.query_params.get('from', ''))
                end = date.fromisoformat(request.query_params.get('to', ''))
                if start > end or end == date.max:
                    raise ValueError()
                days = (end - start).days + 1
            except ValueError:
                raise ValidationError({'detail': 'Informe datas válidas, com início anterior ou igual ao fim.'})
        else:
            raise ValidationError({'detail': 'Selecione 7, 30, 90 dias ou um período personalizado.'})

        previous_end = start - timedelta(days=1)
        previous_start = previous_end - timedelta(days=days - 1)
        current = self.summarize(start, end)
        previous = self.summarize(previous_start, previous_end)

        chart_start = today - timedelta(days=6)
        chart_start_dt, chart_end_dt = self.bounds(chart_start, today)
        chart_rows = Venda.objects.filter(
            created_at__gte=chart_start_dt, created_at__lt=chart_end_dt,
        ).order_by().annotate(local_day=TruncDate('created_at', tzinfo=timezone.get_current_timezone())).values('local_day').annotate(
            revenue=Sum('total'), count=Count('id'),
        )
        chart_data = {row['local_day']: row for row in chart_rows}
        weekday_names = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
        daily = []
        for offset in range(7):
            day = chart_start + timedelta(days=offset)
            row = chart_data.get(day, {})
            daily.append({
                'date': day.isoformat(),
                'label': weekday_names[day.weekday()],
                'revenue': str(row.get('revenue') or Decimal('0.00')),
                'count': row.get('count', 0),
                'is_today': day == today,
            })

        return Response({
            'ranges': {
                'from': start.isoformat(), 'to': end.isoformat(),
                'previous_from': previous_start.isoformat(), 'previous_to': previous_end.isoformat(),
            },
            'current': current,
            'previous': previous,
            'daily': daily,
        })


class TopSellingProductsReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        period = request.query_params.get('period', '30d')
        if period in ('7d', '30d', '90d'):
            days = int(period[:-1])
            end = today
            start = end - timedelta(days=days - 1)
        elif period == 'custom':
            try:
                start = date.fromisoformat(request.query_params.get('from', ''))
                end = date.fromisoformat(request.query_params.get('to', ''))
                if start > end or end == date.max:
                    raise ValueError()
            except ValueError:
                raise ValidationError({'detail': 'Informe datas válidas, com início anterior ou igual ao fim.'})
        else:
            raise ValidationError({'detail': 'Selecione 7, 30, 90 dias ou um período personalizado.'})

        start_dt, end_dt = SalesReportView.bounds(start, end)
        items = ItemVenda.objects.filter(sale__created_at__gte=start_dt, sale__created_at__lt=end_dt)
        total_revenue = items.aggregate(total=Sum('line_total'))['total'] or Decimal('0.00')
        rows = items.order_by().values(
            'product_id', 'product__name', 'product__code',
        ).annotate(
            quantity=Sum('quantity'),
            revenue=Sum('line_total'),
            sales_count=Count('sale_id', distinct=True),
        ).order_by('-quantity', '-revenue', 'product__name', 'product_id')[:5]

        results = []
        for position, row in enumerate(rows, start=1):
            revenue = row['revenue'] or Decimal('0.00')
            results.append({
                'position': position,
                'product_id': row['product_id'],
                'name': row['product__name'],
                'code': row['product__code'],
                'quantity': row['quantity'],
                'revenue': str(revenue),
                'sales_count': row['sales_count'],
                'participation_pct': str((revenue / total_revenue * 100) if total_revenue else Decimal('0.00')),
            })

        return Response({
            'period': period,
            'from': start.isoformat(),
            'to': end.isoformat(),
            'total_revenue': str(total_revenue),
            'results': results,
        })


class CreditReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        period = request.query_params.get('period', '7d')
        if period in ('7d', '30d', '90d'):
            days = int(period[:-1])
            end = today
            start = end - timedelta(days=days - 1)
        elif period == 'custom':
            try:
                start = date.fromisoformat(request.query_params.get('from', ''))
                end = date.fromisoformat(request.query_params.get('to', ''))
                if start > end or end == date.max:
                    raise ValueError()
            except ValueError:
                raise ValidationError({'detail': 'Informe datas válidas, com início anterior ou igual ao fim.'})
        else:
            raise ValidationError({'detail': 'Selecione 7, 30, 90 dias ou um período personalizado.'})

        start_dt, end_dt = SalesReportView.bounds(start, end)
        period_installments = Parcela.objects.filter(
            sale__payment_method='crediario',
            sale__created_at__gte=start_dt,
            sale__created_at__lt=end_dt,
        )
        portfolio = period_installments.aggregate(total=Sum('value'), count=Count('id'))
        receivable = period_installments.filter(status='pendente').aggregate(total=Sum('value'), count=Count('id'))
        overdue = period_installments.filter(status='pendente', due_date__lt=today).aggregate(total=Sum('value'), count=Count('id'))
        received = period_installments.filter(status='pago').aggregate(total=Sum('value'), count=Count('id'))

        overdue_clients = Parcela.objects.filter(
            sale__payment_method='crediario',
            sale__customer__isnull=False,
            status='pendente',
            due_date__lt=today,
        ).values('sale__customer_id', 'sale__customer__name').annotate(
            oldest_due=Min('due_date'),
            overdue_total=Sum('value'),
            overdue_count=Count('id'),
        ).order_by('oldest_due', 'sale__customer__name')[:3]

        debtors = []
        for row in overdue_clients:
            open_totals = Parcela.objects.filter(
                sale__payment_method='crediario',
                sale__customer_id=row['sale__customer_id'],
                status='pendente',
            ).aggregate(total=Sum('value'), count=Count('id'))
            delay_days = (today - row['oldest_due']).days
            risk = 'Baixo' if delay_days <= 7 else 'Médio' if delay_days <= 30 else 'Alto'
            debtors.append({
                'client_id': row['sale__customer_id'],
                'name': row['sale__customer__name'],
                'open_amount': str(open_totals['total'] or Decimal('0.00')),
                'open_count': open_totals['count'] or 0,
                'overdue_amount': str(row['overdue_total'] or Decimal('0.00')),
                'overdue_count': row['overdue_count'],
                'oldest_due': row['oldest_due'].isoformat(),
                'delay_days': delay_days,
                'risk': risk,
            })

        return Response({
            'period': period,
            'from': start.isoformat(),
            'to': end.isoformat(),
            'summary': {
                'portfolio': {'amount': str(portfolio['total'] or Decimal('0.00')), 'installments': portfolio['count'] or 0},
                'receivable': {'amount': str(receivable['total'] or Decimal('0.00')), 'installments': receivable['count'] or 0},
                'overdue': {'amount': str(overdue['total'] or Decimal('0.00')), 'installments': overdue['count'] or 0},
                'received': {'amount': str(received['total'] or Decimal('0.00')), 'installments': received['count'] or 0},
            },
            'debtors': debtors,
        })


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
        payment_method = serializer.validated_data['payment_method']
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
                payment_method=payment_method, payment_observation=observation,
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
                notes=f'Pagamento: {dict(Parcela.PAYMENT_METHODS)[payment_method]}' + (f' · {observation}' if observation else ''),
                responsible=operator,
                request_id=uuid4(),
            )
            installment.refresh_from_db()
            return Response(ParcelaSerializer(installment).data)
