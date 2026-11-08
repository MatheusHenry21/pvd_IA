# Backend Django API

Python 3.13, Django REST Framework e SQLite. Execute os comandos nesta pasta.

## Rodar no PowerShell

```powershell
.\.venv\Scripts\python.exe manage.py runserver
```

API: http://127.0.0.1:8000/api/health/
Admin: http://127.0.0.1:8000/admin/

O uso direto do Python da venv dispensa ativação. Para ativar opcionalmente:
`.\.venv\Scripts\Activate.ps1`.

## Recriar o ambiente

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
```

## Administração e validação

```powershell
.\.venv\Scripts\python.exe manage.py createsuperuser
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test
```

Banco local: `db.sqlite3`, ignorado pelo Git. CORS permite o frontend local nas portas 8443 e 5173. O frontend pode consultar `http://127.0.0.1:8000/api/health/`. A página de produtos está conectada à API, incluindo categorias, cadastro, edição e exclusão.

Configuração padrão para desenvolvimento. Para produção, configure as variáveis de ambiente `DJANGO_DEBUG=false`, `DJANGO_SECRET_KEY` e `DJANGO_ALLOWED_HOSTS` (hosts separados por vírgula), além das origens CORS apropriadas. Arquivos .env não são carregados automaticamente.


## Produtos

- `/api/produtos/`: listar (GET) e cadastrar (POST).
- `/api/produtos/<id>/`: consultar, editar (PUT/PATCH) e excluir (DELETE).
- `/api/categorias/`: listar e cadastrar; `/api/categorias/<id>/`: consultar e excluir quando não estiver em uso.
- Campos do produto: `name`, `code` (único), `category` (nome de categoria cadastrada), `price` (decimal), `stock` (inteiro não negativo), `active` (booleano).

No frontend, `VITE_API_URL` permite alterar a URL base (padrão: `http://127.0.0.1:8000/api`). Reinicie o Vite após alterar variáveis de ambiente. Mantenha o Django em execução para usar a página.

As rotas de produtos e categorias permitem acesso sem autenticação somente com `DEBUG=True` para uso local. Com `DEBUG=False`, exigem usuário autenticado. O login visual do frontend ainda não autentica no Django.
