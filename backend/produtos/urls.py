from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import ProdutoViewSet, CategoriaViewSet, StockReportView
router = DefaultRouter()
router.register('produtos', ProdutoViewSet)
router.register('categorias', CategoriaViewSet)
urlpatterns = [path('produtos/estoque/', StockReportView.as_view(), name='stock-report'), *router.urls]
