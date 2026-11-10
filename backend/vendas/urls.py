from django.urls import path
from .views import ProductSearchView, SalesView

urlpatterns = [
    path('', SalesView.as_view(), name='sales'),
    path('produtos/', ProductSearchView.as_view(), name='sales-product-search'),
]
