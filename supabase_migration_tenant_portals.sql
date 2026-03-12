-- ============================================================
-- MIGRACIÓN: Agregar portales y email de notificación por tenant
-- Ejecutar en Supabase Dashboard → SQL Editor → New Query
--
-- QUÉ HACE:
--   1. Agrega columna 'portals' (TEXT[]) a la tabla tenants
--      para que cada inmobiliaria configure qué portales usa.
--      Ej: {'ZonaProp', 'BuscadorProp'}
--   2. Agrega columna 'notification_email' (TEXT) para recibir
--      aviso cuando los reportes mensuales están listos.
-- ============================================================

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS portals TEXT[] DEFAULT ARRAY['ZonaProp', 'MercadoLibre', 'ArgenProp'];

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS notification_email TEXT;

-- Actualizar tenant existente (RodriguezDrimal) con sus portales y email
-- UPDATE tenants SET portals = ARRAY['ZonaProp', 'BuscadorProp'], notification_email = 'tu@email.com' WHERE name = 'RodriguezDrimal';
