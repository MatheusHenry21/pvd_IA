from django.db import connection
from datetime import datetime, time, timedelta
from decimal import Decimal
from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from caixa.models import Caixa
from produtos.models import Produto
from vendas.models import Parcela, Venda


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
        cursor.fetchone()
    return Response({'status': 'ok', 'database': 'sqlite3'})


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        tomorrow = today + timedelta(days=1)
        today_start = timezone.make_aware(datetime.combine(today, time.min))
        tomorrow_start = timezone.make_aware(datetime.combine(tomorrow, time.min))

        today_sales = Venda.objects.filter(created_at__gte=today_start, created_at__lt=tomorrow_start)
        today_totals = today_sales.aggregate(count=Count('id'), revenue=Sum('total'))

        product_totals = Produto.objects.aggregate(
            count=Count('id'),
            low_stock_count=Count('id', filter=Q(active=True, stock__lte=F('minimum_stock'))),
        )

        cash = Caixa.objects.filter(is_open=True).first()

        pending_installments = Parcela.objects.filter(status='pendente')
        pending_sales_count = pending_installments.values('sale_id').distinct().count()
        pending_amount = pending_installments.aggregate(total=Sum('value'))['total'] or Decimal('0.00')

        chart_start = today - timedelta(days=6)
        chart_start_dt = timezone.make_aware(datetime.combine(chart_start, time.min))
        chart_rows = Venda.objects.filter(
            created_at__gte=chart_start_dt,
            created_at__lt=tomorrow_start,
        ).annotate(
            local_day=TruncDate('created_at', tzinfo=timezone.get_current_timezone()),
        ).values('local_day').annotate(
            revenue=Sum('total'),
            count=Count('id'),
        )
        by_day = {row['local_day']: row for row in chart_rows}
        weekday_names = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
        last_seven_days = []
        for offset in range(7):
            day = chart_start + timedelta(days=offset)
            row = by_day.get(day, {})
            last_seven_days.append({
                'date': day.isoformat(),
                'label': weekday_names[day.weekday()],
                'revenue': str(row.get('revenue') or Decimal('0.00')),
                'count': row.get('count', 0),
                'is_today': day == today,
            })

        recent_sales = Venda.objects.order_by('-created_at', '-id')[:5]
        method_labels = dict(Venda.PAYMENT_METHODS)
        recent_data = [{
            'id': sale.pk,
            'created_at': timezone.localtime(sale.created_at).isoformat(),
            'operator': sale.operator,
            'customer': sale.customer_name,
            'payment_method': sale.payment_method,
            'payment_label': method_labels[sale.payment_method],
            'total': str(sale.total),
            'status': 'Concluída',
        } for sale in recent_sales]

        alerts = []
        low_stock_count = product_totals['low_stock_count']
        if low_stock_count:
            alerts.append({
                'type': 'warning',
                'message': f'{low_stock_count} produto(s) ativos no limite mínimo de estoque ou abaixo dele.',
                'target': 'products',
            })

        if cash:
            opened_at = timezone.localtime(cash.opened_at)
            alerts.append({
                'type': 'info',
                'message': f'Caixa aberto por {cash.responsible} às {opened_at.strftime("%H:%M")}.',
                'target': 'caixa',
            })
        else:
            alerts.append({
                'type': 'warning',
                'message': 'Caixa fechado. Abra o caixa antes de registrar vendas.',
                'target': 'caixa',
            })

        upcoming_end = today + timedelta(days=7)
        overdue_installments = Parcela.objects.filter(status='pendente', due_date__lt=today)
        upcoming_installments = Parcela.objects.filter(
            status='pendente', due_date__gte=today, due_date__lte=upcoming_end,
        )
        overdue_count = overdue_installments.count()
        upcoming_count = upcoming_installments.count()
        if overdue_count or upcoming_count:
            parts = []
            if overdue_count:
                parts.append(f'{overdue_count} parcela(s) vencida(s)')
            if upcoming_count:
                parts.append(f'{upcoming_count} parcela(s) vencem nos próximos 7 dias')
            alerts.append({
                'type': 'warning',
                'message': ' · '.join(parts),
                'target': 'crediario',
            })

        notifications = []
        if low_stock_count:
            low_stock_products = list(
                Produto.objects.filter(active=True, stock__lte=F('minimum_stock'))
                .order_by('stock', 'name')
                .values('name', 'stock', 'minimum_stock')[:4]
            )
            low_stock_details = ', '.join(
                f"{product['name']} (estoque {product['stock']}, mínimo {product['minimum_stock']})"
                for product in low_stock_products
            )
            if low_stock_count > len(low_stock_products):
                low_stock_details += f' e mais {low_stock_count - len(low_stock_products)} produto(s)'
            notifications.append({
                'id': 'low-stock',
                'title': 'Estoque baixo',
                'message': low_stock_details,
                'target': 'products',
            })

        overdue_amount = overdue_installments.aggregate(total=Sum('value'))['total'] or Decimal('0.00')
        if overdue_count:
            notifications.append({
                'id': 'overdue-installments',
                'title': 'Parcelas vencidas',
                'message': f'{overdue_count} parcela(s) vencida(s), totalizando R$ {overdue_amount:.2f}.',
                'target': 'crediario',
            })

        last_closed_cash = Caixa.objects.filter(
            is_open=False,
            closed_at__isnull=False,
            counted_value__isnull=False,
        ).order_by('-closed_at', '-id').first()
        if last_closed_cash:
            closing_difference = last_closed_cash.counted_value - last_closed_cash.balance
            if closing_difference:
                direction = 'sobra' if closing_difference > 0 else 'falta'
                closed_at = timezone.localtime(last_closed_cash.closed_at).strftime('%d/%m/%Y %H:%M')
                notifications.append({
                    'id': 'cash-closing-difference',
                    'title': 'Divergência no fechamento do caixa',
                    'message': f'Último fechamento em {closed_at}: {direction} de R$ {abs(closing_difference):.2f}.',
                    'target': 'caixa',
                })

        return Response({
            'sales_today': today_totals['count'] or 0,
            'revenue_today': str(today_totals['revenue'] or Decimal('0.00')),
            'products': {
                'count': product_totals['count'],
                'low_stock_count': low_stock_count,
            },
            'cash': {
                'balance': str(cash.balance),
                'opened_at': timezone.localtime(cash.opened_at).isoformat(),
                'responsible': cash.responsible,
            } if cash else None,
            'pending_sales': {
                'count': pending_sales_count,
                'amount': str(pending_amount),
            },
            'last_seven_days': last_seven_days,
            'alerts': alerts,
            'notifications': notifications,
            'recent_sales': recent_data,
        })
