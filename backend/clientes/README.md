# API de clientes

Autenticada com Django Token. GET `/api/clientes/?search=nome&page=1&page_size=10` pesquisa nome, CPF e telefone e lista até 10 clientes; limite de página 100. POST `/api/clientes/` cria. GET/PATCH/PUT/DELETE `/api/clientes/<id>/` consulta, edita, exclui. Campos graváveis: name, cpf (validado e único), phone, email, credit_limit e active. debt_balance é somente leitura. CPF é normalizado para 11 dígitos. Não se permite excluir cliente com saldo devedor.

Neste momento, a tela de vendas ainda não persiste vendas no banco nem as relaciona a clientes. Assim, situação detalhada informa saldo devedor do cliente, mas compras realizadas/histórico ficam vazios (0/nenhuma compra) até integrar vendas/crediário a este app. O saldo devedor inicia em zero e não pode ser editado pelo formulário.
