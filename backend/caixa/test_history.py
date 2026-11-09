from datetime import datetime
from decimal import Decimal
from uuid import uuid4
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from .models import Caixa, Movimentacao

class HistoryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(username='history')
        self.client.force_authenticate(self.user)
        for day, name in [(2, 'Maria'), (8, 'José'), (1, 'Maria')]:
            month = 10 if day == 1 else 11
            opened = timezone.make_aware(datetime(2026, month, day, 23, 50))
            cash = Caixa.objects.create(user=self.user, responsible=name, closed_by='Fechador', initial_value='100', balance='125', counted_value='120', is_open=False, closed_at=opened, request_id=uuid4())
            Caixa.objects.filter(pk=cash.pk).update(opened_at=opened)
            for category, value in [('venda','20'), ('suprimento','10'), ('sangria','5')]:
                Movimentacao.objects.create(caixa=cash, category=category, value=value, description='Teste', notes='Detalhe', responsible=name, request_id=uuid4())
    def get(self, **query):
        with patch('django.utils.timezone.localdate', return_value=datetime(2026,11,8).date()):
            return self.client.get('/api/caixa/historico/', query)
    def test_periods_and_totals(self):
        for period, count in [('week',2), ('month',2), ('year',3)]:
            result = self.get(period=period)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.data['totals']['sessions'], count)
            self.assertEqual(Decimal(result.data['totals']['revenue']), Decimal(20*count))
            self.assertEqual(Decimal(result.data['totals']['withdrawals']), Decimal(5*count))
            self.assertEqual(Decimal(result.data['totals']['deposits']), Decimal(10*count))
        session = self.get(period='month').data['sessions'][0]
        self.assertEqual(session['expectedBalance'], '125.00')
        self.assertEqual(session['informedBalance'], '120.00')
        self.assertEqual(session['diff'], '-5.00')
        self.assertEqual(session['closedBy'], 'Fechador')
        self.assertEqual(len(session['movements']), 3)
        self.assertEqual(session['movements'][0]['notes'], 'Detalhe')
    def test_custom_includes_last_day_and_search(self):
        result = self.get(period='custom', **{'from':'2026-11-08','to':'2026-11-08'})
        self.assertEqual(result.data['totals']['sessions'], 1)
        for search, count in [('maria',1), ('08/11/2026',1), ('2026-11-08',1), ('fechador',2), ('nobody',0)]:
            self.assertEqual(self.get(period='month', search=search).data['totals']['sessions'], count)
    def test_invalid_and_anonymous(self):
        for query in [dict(period='other'), dict(period='custom'), {'period':'custom','from':'2026-11-10','to':'2026-11-01'}]:
            self.assertEqual(self.get(**query).status_code, 400)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.get().status_code, 401)
    def test_open_sessions_excluded(self):
        Caixa.objects.create(user=self.user, responsible='Aberto', initial_value=0, balance=0, request_id=uuid4())
        self.assertEqual(self.get(period='year').data['totals']['sessions'], 3)
