# API de caixa

Um caixa aberto por instalação. SQLite, valores Decimal e horário do servidor.

- GET `/api/caixa/atual/`: caixa aberto, responsável, abertura, totais e movimentações; sem caixa retorna status closed.
- POST `/api/caixa/abrir/`: initial_value (decimal em string), request_id (UUID).
- POST `/api/caixa/<id>/movimentacoes/`: category (venda, suprimento ou sangria), value (string decimal positiva), description, notes (opcional), request_id (UUID).
- POST `/api/caixa/<id>/fechar/`: counted_value (string decimal não negativa), notes (opcional).

Saldo = valor inicial + vendas + suprimentos - sangrias. Entradas não incluem valor inicial. Sangrias não podem exceder saldo. Atualização condicional do saldo e lançamento ocorrem na mesma transação. Caixa fechado não recebe lançamentos. Banco ocupado retorna 503; conflitos retornam 409.

Reenvie o mesmo request_id com o mesmo conteúdo para recuperar uma abertura/movimentação já gravada sem duplicá-la. Reutilização em outra movimentação retorna 409.

O caixa exige autenticação, inclusive em DEBUG. O responsável vem exclusivamente da conta autenticada; nomes enviados pelo cliente são ignorados. Login: POST /api/auth/login/ (username, password). Envie o token retornado no header Authorization: Token <token>. Logout: POST /api/auth/logout/.

A lista suporta vendas reais gravadas como movimentações. A tela de vendas/pedidos ainda não foi integrada a esse endpoint. Histórico conectado ao banco, sem dados demonstrativos. Fechamento básico foi conectado para não deixar o botão alterar apenas o estado local.

Testes: `.venv\Scripts\python.exe manage.py test caixa`.

O login utiliza contas do Django. Crie a primeira com `python manage.py createsuperuser` e preencha nome/sobrenome no admin. A página de usuários ainda é demonstrativa. O frontend guarda o token apenas em memória (recarregar exige novo login).


## Histórico

GET `/api/caixa/historico/?period=month&search=Maria` (autenticado).
`period`: week, month, year ou custom. Custom exige `from` e `to` em YYYY-MM-DD, inclusive.
A semana começa na segunda-feira; limites usam America/Sao_Paulo. Seleciona sessões fechadas pela data de abertura. Busca parcial por responsável de abertura/fechamento ou data em DD/MM/YYYY ou YYYY-MM-DD. Retorna sessions com dados completos e movements, e totals com sessions, revenue (somente vendas), withdrawals e deposits. Totais respeitam período e busca. Valor inicial e suprimentos não são faturamento.

Novos fechamentos armazenam o nome do usuário que fechou; nomes ausentes em registros antigos são exibidos como Não registrado. Saldos informados e diferenças ausentes permanecem nulos.
