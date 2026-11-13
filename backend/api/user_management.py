import re
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.db.models.functions import Concat
from django.db.models import CharField, Value
from django.db.models.deletion import ProtectedError
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import UserProfile

User = get_user_model()
ROLE_CHOICES = ('administrador', 'operador')


def validate_cpf_digits(value):
    digits = re.sub(r'\D', '', value)
    if len(digits) != 11 or len(set(digits)) == 1:
        raise serializers.ValidationError('Informe um CPF válido com 11 dígitos.')

    def check_digit(base, weights):
        result = sum(int(number) * weight for number, weight in zip(base, weights)) % 11
        return '0' if result < 2 else str(11 - result)

    if check_digit(digits[:9], range(10, 1, -1)) != digits[9] or check_digit(digits[:10], range(11, 1, -1)) != digits[10]:
        raise serializers.ValidationError('CPF inválido.')
    return digits


class ManagedUserSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)
    cpf = serializers.CharField(max_length=14)
    phone = serializers.CharField(max_length=20)
    role = serializers.ChoiceField(choices=ROLE_CHOICES)
    active = serializers.BooleanField()
    password = serializers.CharField(min_length=8, max_length=128, required=False, allow_blank=True, write_only=True, trim_whitespace=False)

    def validate_name(self, value):
        value = ' '.join(value.split())
        if not value:
            raise serializers.ValidationError('Informe o nome do usuário.')
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        duplicate = User.objects.filter(email__iexact=value)
        if self.instance:
            duplicate = duplicate.exclude(pk=self.instance.pk)
        if duplicate.exists():
            raise serializers.ValidationError('Já existe um usuário com este e-mail.')
        return value

    def validate_cpf(self, value):
        value = validate_cpf_digits(value)
        duplicate = UserProfile.objects.filter(cpf=value)
        if self.instance:
            duplicate = duplicate.exclude(user_id=self.instance.pk)
        if duplicate.exists():
            raise serializers.ValidationError('Já existe um usuário com este CPF.')
        return value

    def validate_phone(self, value):
        digits = re.sub(r'\D', '', value)
        if len(digits) not in (10, 11):
            raise serializers.ValidationError('Informe um telefone com DDD.')
        return digits

    def validate(self, attrs):
        password = attrs.get('password', '')
        if not self.instance and not password:
            raise serializers.ValidationError({'password': 'Informe uma senha para o novo usuário.'})
        if password:
            probe = self.instance or User(email=attrs.get('email', ''), first_name=attrs.get('name', '').split(' ')[0])
            try:
                validate_password(password, user=probe)
            except DjangoValidationError as error:
                raise serializers.ValidationError({'password': list(error.messages)})
        return attrs


def user_data(user):
    try:
        profile = user.profile
    except UserProfile.DoesNotExist:
        profile = None
    return {
        'id': user.pk,
        'name': user.get_full_name() or user.email or user.username,
        'email': user.email,
        'cpf': profile.cpf if profile and profile.cpf else '',
        'phone': profile.phone if profile else '',
        'role': 'administrador' if user.is_staff or user.is_superuser else 'operador',
        'active': user.is_active,
    }


def user_stats():
    total = User.objects.count()
    active = User.objects.filter(is_active=True).count()
    administrators = User.objects.filter(Q(is_staff=True) | Q(is_superuser=True)).distinct().count()
    return {'total': total, 'active': active, 'inactive': total - active, 'administrators': administrators}


def prevent_last_admin_change(user, *, active=None, role=None):
    remains_admin = user.is_staff or user.is_superuser
    will_be_admin = role == 'administrador' if role is not None else remains_admin
    will_be_active = active if active is not None else user.is_active
    if remains_admin and user.is_active and (not will_be_admin or not will_be_active):
        other_active_admins = User.objects.filter(is_active=True).filter(Q(is_staff=True) | Q(is_superuser=True)).exclude(pk=user.pk)
        if not other_active_admins.exists():
            raise ValidationError({'detail': 'Não é possível desativar ou rebaixar o último administrador ativo.'})


class UsersCollectionView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        search = request.query_params.get('search', '').strip()[:100]
        queryset = User.objects.order_by('first_name', 'last_name', 'email', 'id')
        if search:
            digits = re.sub(r'\D', '', search)
            queryset = queryset.annotate(full_name=Concat('first_name', Value(' '), 'last_name', output_field=CharField()))
            query = Q(full_name__icontains=search)
            if digits:
                query |= Q(profile__cpf__contains=digits)
            queryset = queryset.filter(query).distinct()
        paginator = Paginator(queryset, 10)
        try:
            page = paginator.page(request.query_params.get('page', 1))
        except (EmptyPage, PageNotAnInteger, ValueError):
            page = paginator.page(paginator.num_pages or 1)
        return Response({
            'count': paginator.count,
            'page': page.number,
            'page_size': 10,
            'total_pages': paginator.num_pages,
            'stats': user_stats(),
            'results': [user_data(user) for user in page.object_list],
        })

    def post(self, request):
        serializer = ManagedUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        name_parts = data['name'].split(' ', 1)
        try:
            with transaction.atomic():
                user = User(
                    username=f"u{uuid4().hex}",
                    email=data['email'],
                    first_name=name_parts[0],
                    last_name=name_parts[1] if len(name_parts) > 1 else '',
                    is_staff=data['role'] == 'administrador',
                    is_active=data['active'],
                )
                user.set_password(data['password'])
                user.save()
                UserProfile.objects.create(user=user, cpf=data['cpf'], phone=data['phone'])
        except IntegrityError:
            raise ValidationError({'detail': 'Não foi possível cadastrar o usuário. Verifique se o e-mail e CPF já estão em uso.'})
        return Response(user_data(user), status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    permission_classes = [IsAdminUser]

    def get_object(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            raise ValidationError({'detail': 'Usuário não encontrado.'})

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def _update(self, request, pk, *, partial):
        user = self.get_object(pk)
        serializer = ManagedUserSerializer(user, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        role = data.get('role')
        active = data.get('active')
        prevent_last_admin_change(user, active=active, role=role)
        if user.pk == request.user.pk and role == 'operador':
            raise ValidationError({'detail': 'Você não pode rebaixar o próprio usuário.'})
        if user.pk == request.user.pk and active is False:
            raise ValidationError({'detail': 'Você não pode desativar o próprio usuário.'})

        name = data.get('name')
        if name:
            name_parts = name.split(' ', 1)
            user.first_name = name_parts[0]
            user.last_name = name_parts[1] if len(name_parts) > 1 else ''
        if 'email' in data:
            user.email = data['email']
        if role:
            user.is_staff = role == 'administrador'
            if role == 'operador':
                user.is_superuser = False
        if active is not None:
            user.is_active = active
        if data.get('password'):
            user.set_password(data['password'])
        user.save()
        profile, _ = UserProfile.objects.get_or_create(user=user)
        if 'cpf' in data:
            profile.cpf = data['cpf']
        if 'phone' in data:
            profile.phone = data['phone']
        profile.save()
        return Response(user_data(user))

    def delete(self, request, pk):
        user = self.get_object(pk)
        if user.pk == request.user.pk:
            raise ValidationError({'detail': 'Você não pode excluir o próprio usuário.'})
        prevent_last_admin_change(user, active=False)
        try:
            user.delete()
        except ProtectedError:
            raise ValidationError({'detail': 'Este usuário possui histórico vinculado. Desative a conta para remover o acesso.'})
        return Response(status=status.HTTP_204_NO_CONTENT)
