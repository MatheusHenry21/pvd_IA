from uuid import uuid4
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from .models import Caixa, Movimentacao

@override_settings(DEBUG=True)
class CashTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.operator = get_user_model().objects.create_user(username='operator', first_name='Nome', last_name='Real')
        self.client.force_authenticate(self.operator)
    def open(self):
        payload = dict(responsible='Operador teste', initial_value='100.00', request_id=str(uuid4()))
        response = self.client.post('/api/caixa/abrir/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response, payload
    def movement(self, pk, category, value, request_id=None):
        return self.client.post(f'/api/caixa/{pk}/movimentacoes/', dict(category=category, value=value, description='Teste', notes='Observação persistida', request_id=request_id or str(uuid4())), format='json')
    def test_full_cash_flow_and_persistence(self):
        self.assertEqual(self.client.get('/api/caixa/atual/').data['status'], 'closed')
        opened, payload = self.open()
        pk = opened.data['id']
        self.assertEqual(opened.data['balance'], '100.00')
        self.assertEqual(opened.data['responsible'], 'Nome Real')
        self.assertEqual(self.client.post('/api/caixa/abrir/', payload, format='json').status_code, 200)
        self.assertEqual(Caixa.objects.count(), 1)
        self.assertEqual(self.movement(pk, 'suprimento', '50.10').status_code, 201)
        self.assertEqual(self.movement(pk, 'venda', '20.20').status_code, 201)
        self.assertEqual(self.movement(pk, 'sangria', '30.00').status_code, 201)
        current = self.client.get('/api/caixa/atual/').data
        self.assertEqual(current['balance'], '140.30')
        self.assertEqual(current['entries'], '70.30')
        self.assertEqual(current['exits'], '30.00')
        self.assertEqual(current['movements'][0]['notes'], 'Observação persistida')
        self.assertEqual(str(Caixa.objects.get().balance), '140.30')
        self.assertEqual(self.client.post(f'/api/caixa/{pk}/fechar/', dict(counted_value='140.30', notes='Conferido')).status_code, 200)
        self.assertEqual(self.movement(pk, 'suprimento', '1.00').status_code, 400)
        self.assertEqual(self.client.get('/api/caixa/atual/').data['status'], 'closed')
        self.open()
    def test_rejections_and_idempotency(self):
        opened, payload = self.open()
        pk = opened.data['id']
        payload['request_id'] = str(uuid4())
        self.assertEqual(self.client.post('/api/caixa/abrir/', payload).status_code, 409)
        for value in ['0', '-1', '1.001', 'NaN', 'Infinity', '10000000000']:
            self.assertEqual(self.movement(pk, 'sangria', value).status_code, 400)
        self.assertEqual(self.movement(pk, 'sangria', '100.01').status_code, 400)
        key = str(uuid4())
        self.assertEqual(self.movement(pk, 'sangria', '40.00', key).status_code, 201)
        self.assertEqual(self.movement(pk, 'sangria', '40.00', key).status_code, 200)
        self.assertEqual(self.movement(pk, 'sangria', '30.00', key).status_code, 409)
        self.assertEqual(Movimentacao.objects.count(), 1)
        self.assertEqual(str(Caixa.objects.get().balance), '60.00')
    def test_authenticated_operator_overrides_supplied_name(self):
        user = get_user_model().objects.create_user(username='realuser')
        self.client.force_authenticate(user)
        response, _ = self.open()
        self.assertEqual(response.data['responsible'], 'realuser')
        self.assertEqual(response.data['user'], user.id)
    @override_settings(DEBUG=False)
    def test_production_auth(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get('/api/caixa/atual/').status_code, 401)
