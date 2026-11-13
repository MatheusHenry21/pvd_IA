from django.urls import path
from .views import HistoryView, CurrentView, OpenView, MovementView, CloseView, CashReportView
urlpatterns = [path('relatorio/', CashReportView.as_view(), name='cash-report'), path('historico/', HistoryView.as_view()), path('atual/', CurrentView.as_view()), path('abrir/', OpenView.as_view()), path('<int:pk>/movimentacoes/', MovementView.as_view()), path('<int:pk>/fechar/', CloseView.as_view())]
