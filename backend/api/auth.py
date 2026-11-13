from django.contrib.auth import authenticate, get_user_model
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import AnonRateThrottle

class LoginThrottle(AnonRateThrottle):
    rate = '10/minute'


class EmailLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        email = attrs['email'].strip().lower()
        user_model = get_user_model()
        account = user_model.objects.filter(email__iexact=email).order_by('id').first()
        user = authenticate(
            request=self.context.get('request'),
            username=account.username if account else email,
            password=attrs['password'],
        )
        if not account or not user or not user.is_active or user.pk != account.pk:
            raise AuthenticationFailed('E-mail ou senha incorretos.')
        attrs['user'] = user
        return attrs


class LoginView(ObtainAuthToken):
    throttle_classes = [LoginThrottle]
    serializer_class = EmailLoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        role = 'administrador' if user.is_staff or user.is_superuser else 'operador'
        return Response({'token': token.key, 'user': {
            'id': user.id,
            'name': user.get_full_name() or user.email or user.username,
            'email': user.email,
            'is_staff': user.is_staff or user.is_superuser,
            'role': role,
        }})

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        if request.auth:
            request.auth.delete()
        return Response(status=204)
