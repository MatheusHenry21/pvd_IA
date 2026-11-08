import random
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from .models import Categoria, Produto

@override_settings(DEBUG=True)
class StressTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        Categoria.objects.create(name='QA-STRESS')
        self.data = dict(name='QA produto', code='QA-001', category='QA-STRESS', price='12.50', stock=3, active=True)

    def test_fuzz_payloads_never_raise_server_errors(self):
        values = [None, '', ' ', [], {}, True, False, -1, 0, 1.5, 10**100, 'NaN', 'Infinity', '1e999', 'x'*10000, '<script>alert(1)</script>', "'; DROP TABLE produtos_produto; --", '\x00', 'ðŸ˜€Ã¡æ¼¢å­—']
        for field in self.data:
            for value in values:
                with self.subTest(field=field, value=str(value)[:30]):
                    payload = dict(self.data, code='QA-%s' % Produto.objects.count())
                    payload[field] = value
                    response = self.client.post('/api/produtos/', payload, format='json')
                    self.assertIn(response.status_code, [201, 400])
        self.assertTrue(Categoria.objects.exists())

    def test_150_create_update_delete_cycles(self):
        for i in range(150):
            data = dict(self.data, code='QA-%s' % i)
            created = self.client.post('/api/produtos/', data, format='json')
            self.assertEqual(created.status_code, 201)
            url = '/api/produtos/%s/' % created.data['id']
            updated = self.client.patch(url, {'price': '99.99', 'stock': i, 'active': False}, format='json')
            self.assertEqual(updated.status_code, 200)
            self.assertEqual(self.client.get(url).data['price'], '99.99')
            self.assertEqual(self.client.delete(url).status_code, 204)
            self.assertEqual(self.client.delete(url).status_code, 404)
        self.assertEqual(Produto.objects.count(), 0)

    def test_duplicate_burst_and_malformed_json(self):
        statuses = [self.client.post('/api/produtos/', self.data, format='json').status_code for _ in range(50)]
        self.assertEqual(statuses.count(201), 1)
        self.assertEqual(statuses.count(400), 49)
        for body in ['{', 'null', '[]', '123', '"text"']:
            self.assertEqual(self.client.post('/api/produtos/', body, content_type='application/json').status_code, 400)

    def test_boundaries(self):
        for field, value in [('stock', 2147483648), ('price', '10000000000'), ('price', '1.001'), ('code', 'x'*65), ('name', 'x'*201)]:
            self.assertEqual(self.client.post('/api/produtos/', dict(self.data, **{field:value}), format='json').status_code, 400)


from concurrent.futures import ThreadPoolExecutor
from django.db import close_old_connections
from django.test import TransactionTestCase

@override_settings(DEBUG=True)
class ConcurrentWriteTests(TransactionTestCase):
    def test_eight_simultaneous_duplicate_creates(self):
        Categoria.objects.create(name='QA-PARALLEL')
        def create(_):
            close_old_connections()
            try:
                response = APIClient(raise_request_exception=False).post('/api/produtos/', dict(name='QA parallel', code='QA-SAME', category='QA-PARALLEL', price='1.00', stock=1), format='json')
                return response.status_code
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=8) as pool:
            statuses = list(pool.map(create, range(8)))
        self.assertTrue(all(code in [201, 400, 503] for code in statuses), statuses)
        self.assertLessEqual(Produto.objects.filter(code='QA-SAME').count(), 1)
