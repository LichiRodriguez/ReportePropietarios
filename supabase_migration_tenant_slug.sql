-- Agregar slug a tenants para URLs amigables
-- Ej: /auth/rodriguez-drimal en vez de /auth/a1b2c3d4e5f6...
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Generar slugs para tenants existentes basados en el nombre
UPDATE tenants
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REPLACE(REPLACE(REPLACE(name, 'á', 'a'), 'é', 'e'), 'í', 'i'),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL;
