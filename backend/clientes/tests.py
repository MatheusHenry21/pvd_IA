import random
from decimal import Decimal
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from .models import Cliente

def make_cpf(seed):
    base = f'{seed:09d}'
    def digit(seq, weights):
        result = sum(int(n) * w for n, w in zip(seq, weights)) % 11
        return '0' if result < 2 else str(11-result)
    return base + digit(base, range(10, 1, -1)) + digit(base + digit(base, range(10, 1, -1)), range(11, 1, -1))

@override_settings(DEBUG=False)
class ClienteApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='qa', password='test-password')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
    def payload(self, index=1, **changes):
        data = {'name':f'Cliente {index:03d}', 'cpf':make_cpf(index), 'phone':f'(11) 99876-{index:04d}', 'email':f'cliente{index}@example.com', 'credit_limit':'500.00', 'active':True}
        return {**data, **changes}
    def test_create_list_pagination_and_last_page(self):
        for i in range(1, 24):
            response=self.client.post('/api/clientes/',self.payload(i),format='json')
            self.assertEqual(response.status_code,201,response.data)
        first=self.client.get('/api/clientes/?page_size=8')
        self.assertEqual(first.status_code,200)
        self.assertEqual(first.data['count'],23)
        self.assertEqual(len(first.data['results']),8)
        second=self.client.get('/api/clientes/?page=2&page_size=8')
        self.assertEqual(len(second.data['results']),8)
        last=self.client.get('/api/clientes/?page=3&page_size=8')
        self.assertEqual(len(last.data['results']),7)
        self.assertEqual(self.client.get('/api/clientes/?page=99').status_code,404)
        self.assertEqual(self.client.get('/api/clientes/?page_size=1000').data['results'].__len__(),23)
    def test_search_cpf_and_phone_punctuated_or_plain(self):
        response=self.client.post('/api/clientes/',self.payload(),format='json')
        self.assertEqual(response.status_code,201)
        for query in ['Cliente 001','00000000191','000.000.001-91','11998760001','(11) 99876-0001']:
            result=self.client.get('/api/clientes/',{'search':query})
            self.assertEqual(result.data['count'],1,(query,result.data))
    def test_validation_uniqueness_read_only_credit_and_edit(self):
        created=self.client.post('/api/clientes/',self.payload(),format='json')
        self.assertEqual(created.status_code,201)
        pk=created.data['id']
        self.assertEqual(created.data['cpf'],make_cpf(1))
        for cpf in ['12345678900','11111111111','short']:
            self.assertEqual(self.client.post('/api/clientes/',self.payload(2,cpf=cpf),format='json').status_code,400)
        self.assertEqual(self.client.post('/api/clientes/',self.payload(2,cpf=make_cpf(1)),format='json').status_code,400)
        for limit in ['-1','10000000000','1.001','NaN','Infinity']:
            self.assertEqual(self.client.post('/api/clientes/',self.payload(2,credit_limit=limit),format='json').status_code,400,limit)
        self.assertEqual(self.client.patch(f'/api/clientes/{pk}/',{'name':'Atualizado','credit_limit':'1200.50','active':False},format='json').status_code,200)
        edit=self.client.patch(f'/api/clientes/{pk}/',{'debt_balance':'500','purchase_count':99},format='json')
        self.assertEqual(edit.status_code,200)
        cliente=Cliente.objects.get(pk=pk)
        self.assertEqual(cliente.debt_balance,Decimal('0'))
        self.assertEqual(self.client.get('/api/clientes/?active=false').data['count'],1)
    def test_protected_delete_and_regular_delete(self):
        cliente=Cliente.objects.create(**{**self.payload(),'cpf':make_cpf(1),'debt_balance':'10.00'})
        self.assertEqual(self.client.delete(f'/api/clientes/{cliente.pk}/').status_code,400)
        cliente.debt_balance=Decimal('0');cliente.save()
        self.assertEqual(self.client.delete(f'/api/clientes/{cliente.pk}/').status_code,204)
        self.assertEqual(self.client.get(f'/api/clientes/{cliente.pk}/').status_code,404)
    def test_auth_is_required(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get('/api/clientes/').status_code,401)
