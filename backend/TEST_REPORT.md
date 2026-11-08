# Testes adversariais de produtos

Executados em 07/11/2026. Resultado final: 11 testes Django aprovados.

## Cobertura automatizada

- 133 combinações de campos e valores: nulos, tipos incorretos, booleanos, negativos, números enormes, NaN/Infinity, textos longos, Unicode, SQL e script como texto.
- 150 ciclos com criação, edição, consulta, exclusão e segunda exclusão (750 requisições).
- 50 tentativas de cadastrar o mesmo código: uma criação e 49 rejeições.
- JSON malformado e corpos de tipo incorreto.
- Limites de preço, casas decimais, estoque, nome e código.
- Oito criações concorrentes com código idêntico.
- Proteção de categoria em uso, autenticação fora de DEBUG e health/CORS.

Os testes Django usam banco de teste descartável.

## Testes na página real

Cadastro de categoria; duplo clique; campos obrigatórios; preço negativo e estoque fracionado; nome contendo script (exibido como texto); criação; edição de nome, preço e estoque zero; persistência ao sair e voltar; busca por código; filtro de categoria; cancelar exclusão; excluir produto e categoria temporários. Produto original preservado.

## Falhas encontradas e corrigidas

1. Categoria chamada Todos colidia com o filtro geral. Agora o filtro geral usa null e o texto Todos os produtos.
2. Gravações concorrentes retornavam 500 por código duplicado ou bloqueio SQLite. Agora retornam 400 por conflito ou 503 com Retry-After para banco ocupado. Não há retry automático de mutações.
3. Estoque acima de 2147483647 era aceito no SQLite. API e formulário agora aplicam esse limite explicitamente.
4. Fechamento dos modais de exclusão/categoria durante operações foi bloqueado. Formulário rejeita preço não finito. Filtros quebram linha e tabela permite rolagem horizontal.

## Limites

Teste local, com concorrência limitada a oito requisições. Não é garantia de ausência de bugs nem teste de capacidade de produção. SQLite pode devolver 503 quando ocupado; o usuário deve tentar novamente. Login do frontend continua demonstrativo. Não foram simulados quedas de rede, todos os dispositivos ou sessões simultâneas de edição do mesmo produto.

Reexecutar: `.venv\Scripts\python.exe manage.py test api produtos` dentro de backend.
