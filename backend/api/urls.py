from django.urls import path
from .views import DashboardView, health
from .auth import LoginView, LogoutView
from .user_management import UserDetailView, UsersCollectionView

urlpatterns = [path('auth/login/', LoginView.as_view()), path('auth/logout/', LogoutView.as_view()), path('health/', health, name='health'), path('dashboard/', DashboardView.as_view(), name='dashboard'), path('users/', UsersCollectionView.as_view(), name='users'), path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail')]
