from django.test import TestCase
from django.urls import reverse


class HealthTests(TestCase):
    def test_health_is_public_and_checks_database(self):
        response = self.client.get(reverse('health'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok', 'database': 'sqlite3'})

    def test_health_is_read_only(self):
        self.assertEqual(self.client.post(reverse('health')).status_code, 405)

    def test_local_frontend_cors(self):
        response = self.client.get(reverse('health'), HTTP_ORIGIN='http://localhost:8443')
        self.assertEqual(response.headers['Access-Control-Allow-Origin'], 'http://localhost:8443')
