-- Ajustes de custo usam o razão de estoque com quantidade zero.
-- Isso preserva a igualdade de quantidades e mantém uma trilha auditável da reavaliação do estoque.
CREATE INDEX IF NOT EXISTS idx_movements_reference_type_id
ON inventory_movements(reference_type, reference_id);
