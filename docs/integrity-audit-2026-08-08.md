# Auditoria de integridade operacional — 2026-08-08

Escopo: estoque, vendas, pedidos, cancelamentos, devoluções/trocas, entradas, compras, estornos, inventários, crédito de clientes e contas a receber.

## Invariantes obrigatórios

1. O estoque de cada variante deve coincidir com a soma de `inventory_movements.quantity`.
2. Toda alteração de quantidade precisa gerar uma movimentação identificável.
3. Uma entrada originada por compra não pode ser excluída diretamente; deve ser estornada pela compra.
4. Uma entrada manual só pode ser excluída se não houver movimentação posterior da variante.
5. Inventário não pode sobrescrever silenciosamente movimentações ocorridas depois da contagem.
6. Devolução recompõe estoque pelo custo histórico do item devolvido e recalcula o custo médio.
7. O efeito financeiro da devolução/troca deve ser calculado pelo valor das mercadorias, independentemente de o acerto ocorrer por reembolso, crédito ou abatimento de dívida.
8. Devolução de venda pendente deve reduzir automaticamente a conta a receber antes de gerar reembolso/crédito.
9. Troca por item mais caro deve registrar a diferença como paga ou pendente.
10. Produto existente não deve ter estoque/custo médio alterado pelo cadastro de produto; ajustes devem passar pelos fluxos de estoque.

Este documento acompanha a implementação dos hardenings correspondentes e o endpoint de verificação de integridade.