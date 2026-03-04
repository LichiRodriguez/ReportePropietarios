-- ============================================
-- MIGRACIÓN: Agregar web_url a properties
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Agregar columna web_url para la URL pública de la propiedad
ALTER TABLE properties ADD COLUMN IF NOT EXISTS web_url VARCHAR(1000);

-- ============================================
-- ¡MIGRACIÓN COMPLETADA!
-- Verifica ejecutando:
-- SELECT id, address, tokko_id, web_url FROM properties LIMIT 5;
-- ============================================
