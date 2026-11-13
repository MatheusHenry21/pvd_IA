from django.urls import path
from .views import DashboardView, health
from .auth import LoginView, LogoutView

urlpatterns = [path('auth/login/', LoginView.as_view()), path('auth/logout/', LogoutView.as_view()), path('health/', health, name='health'), path('dashboard/', DashboardView.as_view(), name='dashboard')]
