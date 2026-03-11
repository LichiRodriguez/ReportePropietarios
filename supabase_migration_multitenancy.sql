-- ============================================================
-- MIGRACIÓN: Multi-tenancy
-- Ejecutar en Supabase Dashboard → SQL Editor → New Query
--
-- QUÉ HACE:
--   1. Crea la tabla tenants
--   2. Agrega tenant_id a las 7 tablas existentes (nullable)
--   3. Crea el primer tenant (tu inmobiliaria) y asigna datos existentes
--   4. Hace tenant_id NOT NULL
--   5. Crea índices para performance
--
-- IMPORTANTE: Ejecutar TODO de una sola vez.
-- Si falla a mitad de camino, corregir el error y re-ejecutar
-- (usa IF NOT EXISTS / IF EXISTS donde puede).
-- ============================================================


-- ============================================================
-- PASO 1: Crear tabla tenants
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                  TEXT NOT NULL,
  access_token          TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  -- Configuración por tenant (API keys)
  tokko_api_key         TEXT,
  ga_property_id        TEXT,
  ga_credentials_base64 TEXT,

  -- Branding para el reporte PDF
  agent_name            TEXT,
  company_name          TEXT,
  logo_url              TEXT,
  primary_color         TEXT DEFAULT '#1e40af',

  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_tenants" ON tenants
  FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- PASO 2: Agregar tenant_id a todas las tablas (nullable primero)
-- ============================================================
ALTER TABLE owners                   ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE properties               ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE property_metrics         ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE monthly_property_metrics ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE monthly_property_reports ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE report_deliveries        ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE traffic_sources          ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
-- Nota: report_templates NO lleva tenant_id (templates compartidos por ahora)


-- ============================================================
-- PASO 3: Crear primer tenant y asignar datos existentes
-- ============================================================
-- IMPORTANTE: Cambiar los valores de name, agent_name, company_name
-- por los datos reales de tu inmobiliaria ANTES de ejecutar.
-- ============================================================
DO $$
DECLARE
  v_tenant_id UUID;
  v_token     TEXT;
BEGIN
  INSERT INTO tenants (name, agent_name, company_name, primary_color)
  VALUES (
    'Mi Inmobiliaria',          -- ← CAMBIAR por nombre real
    'Lisandro Rodriguez',       -- ← CAMBIAR por nombre del agente
    'Mi Inmobiliaria',          -- ← CAMBIAR por nombre de empresa para el PDF
    '#1e40af'
  )
  RETURNING id, access_token INTO v_tenant_id, v_token;

  -- Asignar TODOS los registros existentes a este tenant
  UPDATE owners                   SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE properties               SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE property_metrics         SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE monthly_property_metrics SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE monthly_property_reports SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE report_deliveries        SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE traffic_sources          SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tenant creado:';
  RAISE NOTICE '  ID:    %', v_tenant_id;
  RAISE NOTICE '  Token: %', v_token;
  RAISE NOTICE '  URL:   https://TU-APP.vercel.app/auth/%', v_token;
  RAISE NOTICE '========================================';
END $$;


-- ============================================================
-- PASO 4: Hacer tenant_id NOT NULL (ya está todo poblado)
-- ============================================================
ALTER TABLE owners                   ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE properties               ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE property_metrics         ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE monthly_property_metrics ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE monthly_property_reports ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE report_deliveries        ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE traffic_sources          ALTER COLUMN tenant_id SET NOT NULL;


-- ============================================================
-- PASO 5: Índices para performance en queries filtradas por tenant
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_owners_tenant
  ON owners(tenant_id);

CREATE INDEX IF NOT EXISTS idx_properties_tenant
  ON properties(tenant_id);

CREATE INDEX IF NOT EXISTS idx_property_metrics_tenant
  ON property_metrics(tenant_id);

CREATE INDEX IF NOT EXISTS idx_monthly_metrics_tenant
  ON monthly_property_metrics(tenant_id);

CREATE INDEX IF NOT EXISTS idx_monthly_reports_tenant
  ON monthly_property_reports(tenant_id);

CREATE INDEX IF NOT EXISTS idx_report_deliveries_tenant
  ON report_deliveries(tenant_id);

CREATE INDEX IF NOT EXISTS idx_traffic_sources_tenant
  ON traffic_sources(tenant_id);


-- ============================================================
-- VERIFICACIÓN
-- Ejecutar después para confirmar que todo está bien:
--
-- SELECT id, name, access_token, agent_name FROM tenants;
--
-- SELECT COUNT(*) AS owners_sin_tenant
--   FROM owners WHERE tenant_id IS NULL;
-- (debe dar 0)
--
-- SELECT COUNT(*) AS properties_sin_tenant
--   FROM properties WHERE tenant_id IS NULL;
-- (debe dar 0)
-- ============================================================
