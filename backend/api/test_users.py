from django.test import TestCase
from django.core.cache import cache
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from .models import UserProfile

User = get_user_model()

class UsersTests(TestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(username='admin', email='admin@example.com', password='Strong!Pass982', is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.payload = dict(name='Maria da Silva', email='maria@example.com', cpf='529.982.247-25', phone='11987654321', role='operador', active=True, password='Strong!Pass982')

    def create(self):
        response = self.client.post('/api/users/', self.payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data['id']

    def test_create_edit_login_and_delete(self):
        pk = self.create()
        user = User.objects.get(pk=pk)
        self.assertTrue(user.check_password(self.payload['password']))
        self.assertEqual(user.profile.cpf, '52998224725')
        response = self.client.patch(f'/api/users/{pk}/', dict(name='Maria Alterada', email='nova@example.com', phone='11911112222', role='administrador', password='Changed!Pass739'), format='json')
        self.assertEqual(response.status_code, 200, response.data)
        public = APIClient()
        login = public.post('/api/auth/login/', dict(email='NOVA@example.com', password='Changed!Pass739'))
        self.assertEqual(login.status_code, 200, login.data)
        self.assertEqual(login.data['user']['role'], 'administrador')
        self.assertEqual(self.client.delete(f'/api/users/{pk}/').status_code, 204)
        self.assertFalse(User.objects.filter(pk=pk).exists())

    def test_search_pagination_and_global_statistics(self):
        pk = self.create()
        for i in range(21):
            User.objects.create_user(username=f'u{i}', first_name=f'Pessoa {i}', is_active=i % 2 == 0)
        page1 = self.client.get('/api/users/').data
        page2 = self.client.get('/api/users/?page=2').data
        self.assertEqual(len(page1['results']), 10)
        self.assertEqual(len(page2['results']), 10)
        self.assertFalse(set(x['id'] for x in page1['results']) & set(x['id'] for x in page2['results']))
        for search in ('Maria da Silva', '529.982.247-25'):
            result = self.client.get('/api/users/', {'search': search}).data
            self.assertEqual([r['id'] for r in result['results']], [pk])
            self.assertEqual(result['stats']['total'], 23)
        for page in ('abc', '-1', '999999'):
            self.assertEqual(self.client.get('/api/users/', {'page': page}).status_code, 200)

    def test_validation_and_duplicates(self):
        self.create()
        for field, value in [('cpf', '11111111111'), ('phone', '123'), ('role', 'gerente'), ('email', 'invalid'), ('password', '123'), ('name', '')]:
            response = self.client.post('/api/users/', {**self.payload, field: value}, format='json')
            self.assertEqual(response.status_code, 400)
            self.assertIn(field, response.data)
        self.assertEqual(self.client.post('/api/users/', self.payload, format='json').status_code, 400)
        self.assertEqual(User.objects.count(), 2)

    def test_operator_cannot_access_users_or_reports(self):
        pk = self.create()
        self.client.force_authenticate(User.objects.get(pk=pk))
        for path in ('/api/users/', '/api/vendas/relatorio/', '/api/vendas/relatorio/produtos/', '/api/vendas/relatorio/crediario/', '/api/caixa/relatorio/', '/api/produtos/estoque/'):
            self.assertEqual(self.client.get(path).status_code, 403, path)
        self.assertEqual(self.client.post('/api/users/', self.payload, format='json').status_code, 403)
        self.assertEqual(self.client.patch(f'/api/users/{self.admin.pk}/', {'role': 'operador'}, format='json').status_code, 403)
        self.assertEqual(self.client.get('/api/caixa/atual/').status_code, 200)

    def test_inactive_account_and_self_protection(self):
        pk = self.create()
        self.assertEqual(self.client.patch(f'/api/users/{pk}/', {'active': False}, format='json').status_code, 200)
        response = APIClient().post('/api/auth/login/', {'email': self.payload['email'], 'password': self.payload['password']})
        self.assertNotEqual(response.status_code, 200)
        for change in ({'active': False}, {'role': 'operador'}):
            self.assertEqual(self.client.patch(f'/api/users/{self.admin.pk}/', change, format='json').status_code, 400)
        self.assertEqual(self.client.delete(f'/api/users/{self.admin.pk}/').status_code, 400)

    def test_login_requires_registered_email_not_username(self):
        User.objects.create_user(username='fake@example.com', email='real@example.com', password='Strong!Pass982')
        response = APIClient().post('/api/auth/login/', {'email': 'fake@example.com', 'password': 'Strong!Pass982'})
        self.assertNotEqual(response.status_code, 200)

    def test_password_spaces_preserved(self):
        self.payload['password'] = '  Strong!Pass982  '
        pk = self.create()
        self.assertTrue(User.objects.get(pk=pk).check_password(self.payload['password']))
