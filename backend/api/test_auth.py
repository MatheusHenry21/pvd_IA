from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

class AuthenticationTests(TestCase):
    def test_login_identity_and_logout(self):
        get_user_model().objects.create_user(username='test-login', email='maria@example.com', password='test-password-only', first_name='Maria', last_name='Silva')
        client = APIClient()
        self.assertIn(client.post('/api/auth/login/', {'email': 'maria@example.com', 'password': 'wrong'}).status_code, (400, 401, 403))
        result = client.post('/api/auth/login/', {'email': 'MARIA@example.com', 'password': 'test-password-only'})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data['user']['name'], 'Maria Silva')
        client.credentials(HTTP_AUTHORIZATION='Token ' + result.data['token'])
        self.assertEqual(client.get('/api/caixa/atual/').status_code, 200)
        self.assertEqual(client.post('/api/auth/logout/').status_code, 204)
        self.assertEqual(client.get('/api/caixa/atual/').status_code, 401)
