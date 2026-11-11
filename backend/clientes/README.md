# API de clientes

Autenticada com Django Token. GET `/api/clientes/?search=nome&page=1&page_size=10` pesquisa nome, CPF e telefone e lista até 10 clientes; limite de página 100. POST `/api/clientes/` cria. GET/PATCH/PUT/DELETE `/api/clientes/<id>/` consulta, edita, exclui. Campos graváveis: name, cpf (validado e único), phone, email, credit_limit e active. debt_balance é somente leitura. CPF é normalizado para 11 dígitos. Não se permite excluir cliente com saldo devedor.

As vendas persistidas são relacionadas aos clientes. A situação detalhada mostra a quantidade de compras e as 10 mais recentes. Vendas no crediário aumentam o saldo devedor; cada parcela paga reduz o saldo correspondente. O saldo devedor continua somente leitura no formulário.
