from django.urls import path
from .views import CreditReportView, InstallmentsView, PayInstallmentView, ProductSearchView, SaleCancellationView, SalesReportView, SalesView, TopSellingProductsReportView

urlpatterns = [
    path('relatorio/', SalesReportView.as_view(), name='sales-report'),
    path('relatorio/produtos/', TopSellingProductsReportView.as_view(), name='top-selling-products-report'),
    path('relatorio/crediario/', CreditReportView.as_view(), name='credit-report'),
    path('cancelamentos/', SaleCancellationView.as_view(), name='sale-cancellation'),
    path('', SalesView.as_view(), name='sales'),
    path('produtos/', ProductSearchView.as_view(), name='sales-product-search'),
    path('parcelas/', InstallmentsView.as_view(), name='sales-installments'),
    path('parcelas/<int:pk>/pagar/', PayInstallmentView.as_view(), name='pay-installment'),
]
