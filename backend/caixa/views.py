from decimal import Decimal
from django.db import transaction, IntegrityError, OperationalError
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from .models import Caixa, Movimentacao
from .serializers import OpenSerializer, MovementSerializer, CloseSerializer

def snapshot(caixa):
    if caixa is None:
        return {'status': 'closed', 'id': None, 'movements': []}
    movements = list(caixa.movements.all())
    entries = sum((m.value for m in movements if m.category != 'sangria'), Decimal('0'))
    exits = sum((m.value for m in movements if m.category == 'sangria'), Decimal('0'))
    return {
        'id': caixa.id, 'status': 'open' if caixa.is_open else 'closed',
        'responsible': caixa.responsible, 'user': caixa.user_id,
        'opened_at': caixa.opened_at, 'closed_at': caixa.closed_at,
        'initial_value': str(caixa.initial_value), 'entries': str(entries), 'exits': str(exits),
        'balance': str(caixa.initial_value + entries - exits),
        'sales': str(sum((m.value for m in movements if m.category == 'venda'), Decimal('0'))),
        'movements': [{'id': m.id, 'created_at': m.created_at, 'category': m.category,
            'value': str(m.value), 'description': m.description, 'notes': m.notes,
            'responsible': m.responsible} for m in movements],
    }

class CashAPIView(APIView):
    permission_classes = [IsAuthenticated]
    def handle_exception(self, exc):
        if isinstance(exc, IntegrityError):
            return Response({'detail': 'JÃ¡ existe caixa aberto ou operaÃ§Ã£o registrada. Atualize a pÃ¡gina.'}, status=409)
        if isinstance(exc, OperationalError) and 'locked' in str(exc).lower():
            return Response({'detail': 'Caixa ocupado. Tente novamente.'}, status=503)
        return super().handle_exception(exc)

class CurrentView(CashAPIView):
    def get(self, request):
        with transaction.atomic():
            return Response(snapshot(Caixa.objects.filter(is_open=True).first()))

class OpenView(CashAPIView):
    def post(self, request):
        serializer = OpenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            existing = Caixa.objects.filter(request_id=data['request_id']).first()
            if existing:
                if existing.initial_value != data['initial_value'] or existing.user_id != request.user.id:
                    return Response({'detail': 'Identificador jÃ¡ usado em outra abertura.'}, status=409)
                return Response(snapshot(existing))
            if Caixa.objects.filter(is_open=True).exists():
                return Response({'detail': 'JÃ¡ existe um caixa aberto.'}, status=409)
            user = request.user if request.user.is_authenticated else None
            if user:
                data['responsible'] = user.get_full_name() or user.username
            caixa = Caixa.objects.create(**data, balance=data['initial_value'], user=user)
            return Response(snapshot(caixa), status=201)

class MovementView(CashAPIView):
    def post(self, request, pk):
        serializer = MovementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            caixa = get_object_or_404(Caixa, pk=pk)
            existing = Movimentacao.objects.filter(request_id=data['request_id']).first()
            if existing:
                if existing.caixa_id != pk or any(getattr(existing, k) != data[k] for k in ['category', 'value', 'description', 'notes']):
                    return Response({'detail': 'Identificador jÃ¡ usado em outra operaÃ§Ã£o.'}, status=409)
                return Response(snapshot(caixa))
            delta = -data['value'] if data['category'] == 'sangria' else data['value']
            query = Caixa.objects.filter(pk=pk, is_open=True)
            if delta < 0:
                query = query.filter(balance__gte=data['value'])
            else:
                query = query.filter(balance__lte=Decimal('999999999999.99') - delta)
            if not query.update(balance=F('balance') + delta):
                raise ValidationError({'detail': 'Caixa fechado, saldo insuficiente ou limite de saldo excedido.'})
            responsible = request.user.get_full_name() or request.user.username if request.user.is_authenticated else caixa.responsible
            Movimentacao.objects.create(caixa=caixa, responsible=responsible, **data)
            caixa.refresh_from_db()
            return Response(snapshot(caixa), status=201)

class CloseView(CashAPIView):
    def post(self, request, pk):
        serializer = CloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            if not Caixa.objects.filter(pk=pk, is_open=True).update(is_open=False, closed_by=request.user.get_full_name() or request.user.username, closed_at=timezone.now(), counted_value=serializer.validated_data['counted_value'], closing_notes=serializer.validated_data['notes']):
                return Response({'detail': 'Caixa jÃ¡ fechado ou inexistente.'}, status=409)
            return Response(snapshot(Caixa.objects.get(pk=pk)))


class HistoryView(CashAPIView):
    def get(self, request):
        from datetime import date, datetime, time, timedelta
        period = request.query_params.get('period', 'month')
        today = timezone.localdate()
        if period == 'week':
            start = today - timedelta(days=today.weekday())
            end = start + timedelta(days=6)
        elif period == 'month':
            start = today.replace(day=1)
            end = (start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        elif period == 'year':
            start, end = date(today.year, 1, 1), date(today.year, 12, 31)
        elif period == 'custom':
            try:
                start = date.fromisoformat(request.query_params.get('from', ''))
                end = date.fromisoformat(request.query_params.get('to', ''))
                if start > end or end == date.max:
                    raise ValueError()
            except ValueError:
                raise ValidationError({'detail': 'Informe datas válidas, com início anterior ou igual ao fim.'})
        else:
            raise ValidationError({'period': 'Período inválido.'})
        start_dt = timezone.make_aware(datetime.combine(start, time.min))
        end_dt = timezone.make_aware(datetime.combine(end + timedelta(days=1), time.min))
        search = request.query_params.get('search', '').strip().casefold()
        sessions = []
        revenue = withdrawals = deposits = Decimal('0')
        with transaction.atomic():
            rows = Caixa.objects.filter(is_open=False, opened_at__gte=start_dt, opened_at__lt=end_dt).prefetch_related('movements').order_by('-opened_at', '-id')
            for cash in rows:
                opened = timezone.localtime(cash.opened_at)
                closed = timezone.localtime(cash.closed_at) if cash.closed_at else None
                searchable = [cash.responsible, cash.closed_by, opened.strftime('%d/%m/%Y'), opened.date().isoformat()]
                if closed:
                    searchable.extend([closed.strftime('%d/%m/%Y'), closed.date().isoformat()])
                if search and not any(search in value.casefold() for value in searchable):
                    continue
                movements = list(cash.movements.all())
                sales = sum((m.value for m in movements if m.category == 'venda'), Decimal('0'))
                supplies = sum((m.value for m in movements if m.category == 'suprimento'), Decimal('0'))
                sangrias = sum((m.value for m in movements if m.category == 'sangria'), Decimal('0'))
                expected = cash.initial_value + sales + supplies - sangrias
                revenue += sales
                deposits += supplies
                withdrawals += sangrias
                sessions.append({
                    'id': str(cash.pk), 'date': opened.strftime('%d/%m/%Y'), 'dateISO': opened.date().isoformat(),
                    'openedBy': cash.responsible, 'openedAt': opened.strftime('%d/%m/%Y %H:%M:%S'),
                    'closedBy': cash.closed_by or 'Não registrado', 'closedAt': closed.strftime('%d/%m/%Y %H:%M:%S') if closed else 'Não registrado',
                    'initialValue': str(cash.initial_value), 'expectedBalance': str(expected),
                    'informedBalance': str(cash.counted_value) if cash.counted_value is not None else None,
                    'diff': str(cash.counted_value - expected) if cash.counted_value is not None else None,
                    'totalSales': sum(m.category == 'venda' for m in movements),
                    'totalRevenue': str(sales), 'totalEntries': str(sales + supplies), 'totalExits': str(sangrias),
                    'closingNotes': cash.closing_notes,
                    'movements': [{'time': timezone.localtime(m.created_at).strftime('%d/%m/%Y %H:%M:%S'), 'desc': m.description,
                        'type': 'exit' if m.category == 'sangria' else 'entry', 'category': m.category,
                        'value': str(m.value), 'notes': m.notes, 'responsible': m.responsible} for m in movements],
                })
        return Response({'sessions': sessions, 'totals': {'sessions': len(sessions), 'revenue': str(revenue), 'withdrawals': str(withdrawals), 'deposits': str(deposits)}})
