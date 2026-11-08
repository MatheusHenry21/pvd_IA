from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from .models import Produto, Categoria

@override_settings(DEBUG=True)
class ProdutoTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        Categoria.objects.create(name='Teste')
        self.payload = dict(name='Produto teste', code='001', category='Teste', price='12.50', stock=3, active=True)

    def test_crud_and_category_protection(self):
        response = self.client.post('/api/produtos/', self.payload)
        self.assertEqual(response.status_code, 201)
        url = '/api/produtos/%s/' % response.data['id']
        self.assertEqual(self.client.get('/api/produtos/').data[0]['code'], '001')
        self.assertEqual(self.client.patch(url, {'active': False}).status_code, 200)
        self.assertFalse(Produto.objects.get().active)
        category_url = '/api/categorias/%s/' % Categoria.objects.get().pk
        self.assertEqual(self.client.delete(category_url).status_code, 400)
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertEqual(self.client.delete(category_url).status_code, 204)

    def test_invalid_values_and_duplicate_code(self):
        self.assertEqual(self.client.post('/api/produtos/', self.payload).status_code, 201)
        self.assertEqual(self.client.post('/api/produtos/', self.payload).status_code, 400)
        for field, value in [('price', '-1'), ('stock', -1), ('stock', '1.5'), ('name', ''), ('category', 'missing')]:
            data = dict(self.payload, code='002')
            data[field] = value
            self.assertEqual(self.client.post('/api/produtos/', data).status_code, 400)

    @override_settings(DEBUG=False)
    def test_production_requires_authentication(self):
        self.assertEqual(self.client.get('/api/produtos/').status_code, 401)
