from django.contrib import admin
from django.urls import include, path

urlpatterns = [path('api/clientes/', include('clientes.urls')), path('api/caixa/', include('caixa.urls')), path('api/', include('produtos.urls')), path('admin/', admin.site.urls), path('api/', include('api.urls'))]
