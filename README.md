# YVIE ERP

Sistema interno da YVIE para **vendas, pedidos, produtos, estoque, entradas, clientes e financeiro**. O projeto foi estruturado para rodar como aplicação full-stack no **Cloudflare Workers**, com front-end React/Vite, API Worker e banco **Cloudflare D1**.

## Stack

- React + TypeScript + Vite
- Cloudflare Vite Plugin
- Cloudflare Workers Static Assets
- Cloudflare D1 (SQLite)
- Lucide React para ícones
- Autenticação por secret do Cloudflare
- Sessão assinada em cookie `HttpOnly`, `SameSite=Strict` e `Secure` em HTTPS

## Estrutura

```text
src/
  components/       componentes compartilhados e shell do sistema
  context/          carregamento e sincronização dos dados
  lib/              cliente da API e formatadores
  pages/            módulos funcionais do ERP
  styles/           estilos separados por responsabilidade
worker/
  auth.ts           autenticação e sessão
  db.ts             leitura e mapeamento do D1
  http.ts           helpers HTTP
  index.ts          roteador da API
  routes/           regras de clientes, produtos, estoque, vendas e despesas
migrations/
  0001_initial.sql  schema de produção
scripts/
  dev-seed.sql      dados fictícios opcionais apenas para desenvolvimento
public/
  yvie-logo.svg
```

Uma visão mais detalhada está em [`docs/architecture.md`](docs/architecture.md).

## Funcionalidades implementadas

- Login protegido por secret, sem senha exposta no código ou no front-end.
- Dashboard com faturamento, lucro bruto, despesas, lucro líquido, pedidos, estoque, alertas e ranking.
- Clientes com histórico derivado das vendas e botão direto para `wa.me`.
- Produtos com variantes livres de cor/tamanho, SKU, custo, preço, quantidade e estoque mínimo.
- Duplicação de produto sem duplicar estoque ou SKU.
- Arquivamento sem destruir histórico.
- Estoque por variante e ajuste manual rastreável.
- Entradas em lote com várias variantes e cálculo de custo médio ponderado.
- Vendas com preço editável por item, desconto, forma/status de pagamento e status operacional.
- Baixa de estoque e registro financeiro na mesma operação D1.
- Cancelamento de venda com devolução automática ao estoque.
- Kanban de pedidos: `Separando → Pronto → Entregue`.
- Despesas e resultado líquido.
- Relatórios de estoque, margem, ticket, produtos e clientes.
- Notificações de erro não bloqueantes e retorno automático ao login quando a sessão expira.

## Desenvolvimento local

### 1. Instale as dependências

```bash
npm install
```

### 2. Crie os secrets locais

Copie `.dev.vars.example` para `.dev.vars`:

```env
YVIE_ADMIN_PASSWORD=uma-senha-forte
YVIE_SESSION_SECRET=uma-chave-aleatoria-longa-com-32-ou-mais-caracteres
```

`.dev.vars` está ignorado pelo Git e **não deve ser commitado**.

### 3. Aplique o schema local

```bash
npm run db:migrate:local
```

Opcionalmente, carregue dados fictícios de desenvolvimento:

```bash
npm run db:seed:local
```

O seed fica deliberadamente em `scripts/dev-seed.sql`, fora de `migrations/`, para não entrar no fluxo de migrations de produção.

### 4. Execute

```bash
npm run dev
```

## Deploy no Cloudflare

O `wrangler.jsonc` usa provisionamento automático do Wrangler para o binding D1 `DB`. No primeiro deploy, o Cloudflare pode criar o recurso D1 e vinculá-lo ao Worker.

### 1. Configure os secrets no Cloudflare

```bash
npx wrangler secret put YVIE_ADMIN_PASSWORD
npx wrangler secret put YVIE_SESSION_SECRET
```

Use uma senha forte para `YVIE_ADMIN_PASSWORD` e uma chave aleatória longa para `YVIE_SESSION_SECRET`.

### 2. Faça o primeiro deploy/provisionamento

```bash
npm run deploy
```

### 3. Aplique o schema no D1 remoto

```bash
npm run db:migrate:remote
```

Como apenas migrations de produção ficam na pasta `migrations/`, esse comando não carrega os dados fictícios do desenvolvimento.

Depois das migrations, execute novamente `npm run deploy` se necessário.

## Cloudflare Git integration

Se o repositório for conectado ao Cloudflare Workers Builds:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Os secrets `YVIE_ADMIN_PASSWORD` e `YVIE_SESSION_SECRET` devem ser configurados no Worker/Cloudflare, nunca como variáveis públicas do Vite.
- O D1 deve permanecer com o binding `DB`.

## Segurança e integridade

- O front-end nunca recebe o valor dos secrets.
- Todos os endpoints de negócio exigem sessão válida.
- Operações de escrita rejeitam `Origin` diferente do próprio site.
- SQL usa prepared statements/bindings do D1.
- As vendas utilizam `D1Database.batch()` para aplicar venda, itens, movimentos e baixa de estoque na mesma transação.
- A coluna de estoque possui `CHECK (stock >= 0)`.
- Variantes com estoque não podem ser removidas antes de o estoque ser ajustado.
- Exclusões que quebrariam histórico são bloqueadas; produtos são arquivados.

## CI

`.github/workflows/ci.yml` instala as dependências e executa `npm run build` em pushes e pull requests para `main`.

## Próximas evoluções recomendadas

A base já comporta usuários/permissões, fornecedores, contas a pagar/receber, trocas/devoluções parciais, código de barras, importação de Excel, etiquetas, auditoria avançada e integração com WhatsApp/Instagram sem reestruturar o núcleo do banco.
