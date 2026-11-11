# API de vendas e crediário

Todas as rotas exigem autenticação por token. Uma venda só é criada com um caixa aberto.

- GET /api/vendas/produtos/?search=texto pesquisa produtos ativos por nome ou código no banco.
- POST /api/vendas/ registra a venda, baixa o estoque e grava a movimentação no caixa. Para payment_method "crediario", informe client_id, installment_count (de 1 a 12) e first_due_date no formato YYYY-MM-DD.
- GET /api/vendas/ retorna as 10 vendas mais recentes, incluindo itens e parcelas.
- GET /api/vendas/parcelas/ lista as parcelas e calcula status vencido conforme a data local.
- POST /api/vendas/parcelas/<id>/pagar/ recebe { "observation": "..." }. Exige caixa aberto, marca a parcela como paga, reduz a dívida do cliente e registra a entrada no caixa.

As parcelas têm valores em centavos; qualquer diferença de arredondamento fica na última. Os vencimentos mensais são calculados a partir do primeiro vencimento informado, mantendo o dia original quando possível. Se um mês não tiver esse dia, usa o último dia daquele mês; os meses seguintes voltam ao dia original. Exemplo: 31/01, 28/02, 31/03.
