from django.urls import path
from .views import InstallmentsView, PayInstallmentView, ProductSearchView, SalesView

urlpatterns = [
    path('', SalesView.as_view(), name='sales'),
    path('produtos/', ProductSearchView.as_view(), name='sales-product-search'),
    path('parcelas/', InstallmentsView.as_view(), name='sales-installments'),
    path('parcelas/<int:pk>/pagar/', PayInstallmentView.as_view(), name='pay-installment'),
]
