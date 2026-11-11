from datetime import date
from decimal import Decimal
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from caixa.models import Caixa, Movimentacao
from clientes.models import Cliente
from produtos.models import Categoria, Produto
from .models import ItemVenda, Parcela, Venda


@override_settings(DEBUG=False)
class SalesApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='cashier', password='test-password', first_name='Ana', last_name='Martins',
        )
        self.api = APIClient()
        self.api.force_authenticate(self.user)
        self.category = Categoria.objects.create(name='Testes')
        self.product = self.make_product('Massa para Gesso', 'G-100', '25.50', stock=10)
        self.caixa = Caixa.objects.create(
            user=self.user, responsible='Ana Martins',
            initial_value=Decimal('100.00'), balance=Decimal('100.00'),
            is_open=True, request_id=uuid4(),
        )

    def make_product(self, name, code, price='10.00', stock=10, active=True):
        return Produto.objects.create(
            name=name, code=code, category=self.category, price=price,
            stock=stock, active=active,
        )

    def make_client(self, **changes):
        values = {
            'name': 'Cliente Teste', 'cpf': '12345678901',
            'credit_limit': Decimal('500.00'), 'debt_balance': Decimal('0.00'),
            'active': True,
        }
        values.update(changes)
        return Cliente.objects.create(**values)

    def payload(self, **changes):
        values = {
            'request_id': str(uuid4()),
            'items': [{'product_id': self.product.pk, 'quantity': 2}],
            'payment_method': 'pix',
            'discount': '1.00',
            'observation': 'Separar para retirada.',
        }
        values.update(changes)
        return values

    def test_product_search_reads_active_products_from_database_and_limits_results(self):
        for index in range(9):
            self.make_product(f'Massa Gesso {index}', f'GS-{index:02d}')
        self.make_product('Massa Gesso inativa', 'GS-OFF', active=False)

        response = self.api.get('/api/vendas/produtos/?search=gesso')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 8)
        self.assertTrue(all('Gesso' in row['name'] for row in response.data['results']))
        self.assertNotIn('GS-OFF', [row['code'] for row in response.data['results']])

    def test_create_sale_saves_snapshot_discount_observation_and_decrements_stock(self):
        response = self.api.post(
            '/api/vendas/',
            self.payload(payment_method='dinheiro', cash_received='60.00'),
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        sale = Venda.objects.get(pk=response.data['id'])
        self.assertEqual(sale.operator, 'Ana Martins')
        self.assertEqual(sale.subtotal, Decimal('51.00'))
        self.assertEqual(sale.discount, Decimal('1.00'))
        self.assertEqual(sale.total, Decimal('50.00'))
        self.assertEqual(sale.cash_received, Decimal('60.00'))
        self.assertEqual(sale.change, Decimal('10.00'))
        self.assertEqual(sale.observation, 'Separar para retirada.')
        self.assertEqual(ItemVenda.objects.filter(sale=sale).count(), 1)
        self.assertEqual(self.product.__class__.objects.get(pk=self.product.pk).stock, 8)
        self.caixa.refresh_from_db()
        self.assertEqual(self.caixa.balance, Decimal('150.00'))
        movement = Movimentacao.objects.get(caixa=self.caixa)
        self.assertEqual(movement.category, 'venda')
        self.assertEqual(movement.value, Decimal('50.00'))

    def test_sale_is_blocked_without_open_cash_and_leaves_database_unchanged(self):
        self.caixa.is_open = False
        self.caixa.save(update_fields=['is_open'])

        response = self.api.post(
            '/api/vendas/',
            self.payload(payment_method='dinheiro', cash_received='60.00'),
            format='json',
        )

        self.assertEqual(response.status_code, 409)
        self.assertIn('Abra o caixa', response.data['detail'])
        self.assertEqual(Venda.objects.count(), 0)
        self.assertEqual(Movimentacao.objects.count(), 0)
        self.assertEqual(self.product.__class__.objects.get(pk=self.product.pk).stock, 10)

    def test_all_payment_methods_are_saved_and_credit_updates_customer_debt(self):
        client = self.make_client()
        methods = ['dinheiro', 'pix', 'debito', 'credito', 'crediario']

        for method in methods:
            body = self.payload(
                payment_method=method,
                discount='0.00',
                items=[{'product_id': self.product.pk, 'quantity': 1}],
                client_id=client.pk if method == 'crediario' else None,
            )
            if method == 'crediario':
                body.update(installment_count=1, first_due_date='2026-12-10')
            if method == 'dinheiro':
                body['cash_received'] = '30.00'
            response = self.api.post('/api/vendas/', body, format='json')
            self.assertEqual(response.status_code, 201, (method, response.data))
            self.assertEqual(response.data['payment_method'], method)

        client.refresh_from_db()
        self.assertEqual(client.debt_balance, Decimal('25.50'))
        self.assertEqual(Venda.objects.count(), 5)
        self.assertEqual(Movimentacao.objects.filter(caixa=self.caixa, category='venda').count(), 4)
        self.caixa.refresh_from_db()
        self.assertEqual(self.caixa.balance, Decimal('202.00'))
        self.assertIsNone(Venda.objects.get(payment_method='pix').cash_received)

    def test_credit_sale_generates_monthly_due_dates_and_balanced_cent_values(self):
        client = self.make_client()

        response = self.api.post('/api/vendas/', self.payload(
            payment_method='crediario',
            client_id=client.pk,
            installment_count=3,
            first_due_date='2027-01-31',
        ), format='json')

        self.assertEqual(response.status_code, 201, response.data)
        installments = Parcela.objects.filter(sale_id=response.data['id']).order_by('number')
        self.assertEqual(list(installments.values_list('due_date', flat=True)), [
            date(2027, 1, 31), date(2027, 2, 28), date(2027, 3, 31),
        ])
        self.assertEqual(list(installments.values_list('value', flat=True)), [
            Decimal('16.66'), Decimal('16.66'), Decimal('16.68'),
        ])
        self.assertEqual(sum(installments.values_list('value', flat=True)), Decimal('50.00'))
        self.assertEqual(len(response.data['installments']), 3)

    def test_installment_payment_updates_customer_debt_and_cash_once(self):
        client = self.make_client()
        sale_response = self.api.post('/api/vendas/', self.payload(
            payment_method='crediario',
            client_id=client.pk,
            installment_count=2,
            first_due_date='2026-12-10',
        ), format='json')
        self.assertEqual(sale_response.status_code, 201, sale_response.data)
        installment = Parcela.objects.filter(sale_id=sale_response.data['id']).order_by('number').first()

        response = self.api.post(
            f'/api/vendas/parcelas/{installment.pk}/pagar/',
            {'payment_method': 'dinheiro', 'observation': 'Recebido em dinheiro.'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'pago')
        self.assertEqual(response.data['payment_operator'], 'Ana Martins')
        self.assertEqual(response.data['payment_method'], 'dinheiro')
        self.assertEqual(response.data['payment_observation'], 'Recebido em dinheiro.')
        client.refresh_from_db()
        self.caixa.refresh_from_db()
        self.assertEqual(client.debt_balance, Decimal('25.00'))
        self.assertEqual(self.caixa.balance, Decimal('125.00'))
        self.assertEqual(Movimentacao.objects.filter(caixa=self.caixa).count(), 1)
        self.assertIn('Dinheiro', Movimentacao.objects.get(caixa=self.caixa).notes)

        duplicate = self.api.post(
            f'/api/vendas/parcelas/{installment.pk}/pagar/',
            {'payment_method': 'dinheiro', 'observation': 'Tentativa repetida.'},
            format='json',
        )
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(Movimentacao.objects.filter(caixa=self.caixa).count(), 1)

    def test_installment_payment_is_blocked_when_cash_is_closed(self):
        client = self.make_client()
        sale_response = self.api.post('/api/vendas/', self.payload(
            payment_method='crediario',
            client_id=client.pk,
            installment_count=1,
            first_due_date='2026-12-10',
        ), format='json')
        installment = Parcela.objects.get(sale_id=sale_response.data['id'])
        self.caixa.is_open = False
        self.caixa.save(update_fields=['is_open'])

        response = self.api.post(f'/api/vendas/parcelas/{installment.pk}/pagar/', {'payment_method': 'pix'}, format='json')

        self.assertEqual(response.status_code, 409)
        installment.refresh_from_db()
        client.refresh_from_db()
        self.assertEqual(installment.status, 'pendente')
        self.assertEqual(client.debt_balance, Decimal('50.00'))
        self.assertEqual(Movimentacao.objects.count(), 0)

    def test_installment_payment_accepts_and_saves_each_selected_method(self):
        client = self.make_client()
        sale_response = self.api.post('/api/vendas/', self.payload(
            payment_method='crediario',
            client_id=client.pk,
            installment_count=4,
            first_due_date='2026-12-10',
        ), format='json')
        self.assertEqual(sale_response.status_code, 201, sale_response.data)
        installments = list(Parcela.objects.filter(sale_id=sale_response.data['id']).order_by('number'))
        methods = ['pix', 'dinheiro', 'debito', 'credito']

        for installment, method in zip(installments, methods):
            response = self.api.post(
                f'/api/vendas/parcelas/{installment.pk}/pagar/',
                {'payment_method': method},
                format='json',
            )
            self.assertEqual(response.status_code, 200, (method, response.data))
            self.assertEqual(response.data['payment_method'], method)

        client.refresh_from_db()
        self.caixa.refresh_from_db()
        self.assertEqual(client.debt_balance, Decimal('0.00'))
        self.assertEqual(self.caixa.balance, Decimal('150.00'))
        self.assertEqual(Movimentacao.objects.filter(caixa=self.caixa).count(), 4)

    def test_installment_payment_requires_a_supported_method(self):
        client = self.make_client()
        sale_response = self.api.post('/api/vendas/', self.payload(
            payment_method='crediario',
            client_id=client.pk,
            installment_count=1,
            first_due_date='2026-12-10',
        ), format='json')
        installment = Parcela.objects.get(sale_id=sale_response.data['id'])

        response = self.api.post(
            f'/api/vendas/parcelas/{installment.pk}/pagar/',
            {'payment_method': 'crediario'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        installment.refresh_from_db()
        self.assertEqual(installment.status, 'pendente')
        self.assertEqual(Movimentacao.objects.count(), 0)

    def test_client_lookup_prioritizes_similar_names_and_returns_at_most_five(self):
        for index in range(7):
            self.make_client(
                name=f'Ana Ferreira {index:02d}',
                cpf=f'{index + 200:011d}',
            )
        self.make_client(name='Cliente Inativo', cpf='99999999999', active=False)

        response = self.api.get('/api/clientes/?search=Ana%20Fer&page_size=5&active=true')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 7)
        self.assertEqual(len(response.data['results']), 5)
        self.assertEqual(response.data['results'][0]['name'], 'Ana Ferreira 00')

    def test_client_purchase_history_includes_saved_sales(self):
        client = self.make_client()
        response = self.api.post(
            '/api/vendas/',
            self.payload(payment_method='pix', client_id=client.pk),
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)

        client_response = self.api.get(f'/api/clientes/{client.pk}/')

        self.assertEqual(client_response.status_code, 200)
        self.assertEqual(client_response.data['purchase_count'], 1)
        self.assertEqual(len(client_response.data['purchases']), 1)
        self.assertEqual(client_response.data['purchases'][0]['id'], f"#{response.data['id']}")

    def test_invalid_payment_discount_or_stock_does_not_change_database(self):
        cases = [
            self.payload(payment_method='dinheiro', cash_received='49.99'),
            self.payload(discount='51.01'),
            self.payload(items=[{'product_id': self.product.pk, 'quantity': 11}]),
        ]
        for body in cases:
            response = self.api.post('/api/vendas/', body, format='json')
            self.assertEqual(response.status_code, 400, response.data)
            self.assertEqual(Venda.objects.count(), 0)
            self.assertEqual(self.product.__class__.objects.get(pk=self.product.pk).stock, 10)
            self.assertEqual(Movimentacao.objects.count(), 0)

    def test_credit_limit_failure_rolls_back_sale_and_stock(self):
        client = self.make_client(credit_limit=Decimal('20.00'))

        response = self.api.post(
            '/api/vendas/',
            self.payload(payment_method='crediario', client_id=client.pk, first_due_date='2026-12-10'),
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Venda.objects.count(), 0)
        self.assertEqual(self.product.__class__.objects.get(pk=self.product.pk).stock, 10)
        self.assertEqual(Movimentacao.objects.count(), 0)
        client.refresh_from_db()
        self.assertEqual(client.debt_balance, Decimal('0.00'))

    def test_repeating_request_id_does_not_duplicate_sale_or_decrement_stock_twice(self):
        body = self.payload()

        first = self.api.post('/api/vendas/', body, format='json')
        second = self.api.post('/api/vendas/', body, format='json')

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(first.data['id'], second.data['id'])
        self.assertEqual(Venda.objects.count(), 1)
        self.assertEqual(Movimentacao.objects.count(), 1)
        self.assertEqual(self.product.__class__.objects.get(pk=self.product.pk).stock, 8)

    def test_history_returns_only_the_ten_latest_sales_with_detail_fields(self):
        client = self.make_client()
        sales = []
        for _ in range(12):
            sales.append(Venda.objects.create(
                customer=client, customer_name=client.name, operator='Ana Martins',
                payment_method='pix', subtotal=Decimal('10.00'), discount=Decimal('0.00'),
                total=Decimal('10.00'), observation='Histórico real', request_id=uuid4(),
            ))

        response = self.api.get('/api/vendas/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 10)
        self.assertEqual(response.data['results'][0]['id'], sales[-1].pk)
        row = response.data['results'][0]
        self.assertEqual(row['client'], client.name)
        self.assertEqual(row['operator'], 'Ana Martins')
        self.assertEqual(row['observation'], 'Histórico real')
        self.assertIn('created_at', row)
        self.assertIn('payment_method', row)
        self.assertIn('total', row)

    def test_sales_endpoints_require_authentication(self):
        self.api.force_authenticate(user=None)

        self.assertEqual(self.api.get('/api/vendas/').status_code, 401)
        self.assertEqual(self.api.get('/api/vendas/produtos/?search=gesso').status_code, 401)
