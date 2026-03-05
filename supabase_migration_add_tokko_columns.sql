-- Agregar columnas para datos de Tokko en reportes
-- Ejecutar en Supabase SQL Editor

ALTER TABLE monthly_property_reports
ADD COLUMN IF NOT EXISTS tokko_stats JSONB DEFAULT NULL;

ALTER TABLE monthly_property_reports
ADD COLUMN IF NOT EXISTS tokko_property JSONB DEFAULT NULL;
