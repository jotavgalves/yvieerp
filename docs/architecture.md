# Arquitetura do YVIE ERP

## Visão geral

O projeto é dividido em três camadas:

1. **Interface React** em `src/`.
2. **API Cloudflare Worker** em `worker/`.
3. **Persistência D1** versionada em `migrations/`.

A interface nunca acessa o D1 diretamente. Toda leitura e escrita passa pelas rotas `/api/*`, protegidas por sessão.

## Fluxo de autenticação

```text
Tela de login
    ↓
POST /api/auth/login
    ↓
Validação de YVIE_ADMIN_PASSWORD no Worker
    ↓
Cookie de sessão assinado com YVIE_SESSION_SECRET
    ↓
Rotas /api/* autenticadas
```

Nenhum valor de secret é enviado ao bundle React.

## Fluxo de uma venda

```text
Cliente + itens + pagamento
    ↓
POST /api/sales
    ↓
Validação do cliente e estoque
    ↓
D1 batch
    ├─ cria venda
    ├─ cria itens
    ├─ baixa variantes
    └─ cria movimentos de estoque
    ↓
Dashboard / vendas / pedidos / financeiro usam a mesma origem de dados
```

O cancelamento faz o caminho inverso para o estoque e preserva a venda como histórico com status `Cancelado`.

## Estoque

`products` representa a peça principal. `product_variants` representa combinações de atributos usados pela operação, como cor e tamanho. Os valores são texto livre, portanto tamanho pode ser `P`, `M`, `42`, `Único` etc.

As entradas são preservadas em `stock_entries` e `stock_entry_items`. A variante mantém um custo médio operacional, enquanto o histórico de cada entrada continua registrado.

Toda mudança de quantidade relevante também gera um registro em `inventory_movements`.

## Exclusão e histórico

Dados que participam de histórico comercial não devem desaparecer fisicamente. Por isso:

- produtos são arquivados;
- vendas canceladas permanecem registradas;
- clientes com vendas vinculadas não podem ser excluídos;
- variantes antigas podem ser desativadas sem apagar vendas anteriores;
- uma variante com quantidade positiva precisa ter o estoque ajustado antes de ser removida da estrutura ativa.

## Organização do front-end

```text
src/
├─ components/    shell e componentes reutilizáveis
├─ context/       estado carregado da API
├─ lib/           API client e formatadores
├─ pages/         módulos do ERP
└─ styles/        estilos separados por responsabilidade
```

As ações globais ficam no shell. Ações específicas ficam na página correspondente para evitar repetição de botões e ambiguidade de fluxo.

## Organização do Worker

```text
worker/
├─ auth.ts        assinatura e validação de sessão
├─ db.ts          leitura e serialização do D1
├─ http.ts        respostas, parsing e proteção de origem
├─ index.ts       roteamento HTTP
└─ routes/
   ├─ customers.ts
   ├─ expenses.ts
   ├─ inventory.ts
   ├─ products.ts
   └─ sales.ts
```

As regras de domínio ficam fora do roteador principal para reduzir acoplamento e facilitar evolução e testes.

## Deploy

O projeto deve ser publicado pelo Wrangler. O binding de banco usado pelo Worker chama-se `DB`; os secrets esperados são `YVIE_ADMIN_PASSWORD` e `YVIE_SESSION_SECRET`.

O schema de produção está em `migrations/0001_initial.sql`. Dados fictícios opcionais ficam em `scripts/dev-seed.sql`, fora da pasta de migrations, para que o comando de migration remota nunca os aplique por engano.
