-- ============================================
-- MIGRACIÓN: Sistema de Reportes para Propietarios
-- Ejecutar en Supabase SQL Editor (https://app.supabase.com → SQL Editor → New Query)
-- ============================================

-- 1. Tabla de propietarios (owners)
CREATE TABLE IF NOT EXISTS owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  whatsapp VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de propiedades (properties)
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address VARCHAR(500) NOT NULL,
  neighborhood VARCHAR(255),
  property_type VARCHAR(50), -- 'sale', 'rent'
  price NUMERIC(15, 2),
  owner_id UUID REFERENCES owners(id),
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive'
  reports_enabled BOOLEAN DEFAULT true,
  surface_total NUMERIC(10, 2),
  rooms INTEGER,
  bathrooms INTEGER,
  slug VARCHAR(500),
  tokko_id VARCHAR(100) UNIQUE,
  tokko_data JSONB,
  synced_at TIMESTAMPTZ,
  external_ids JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de métricas diarias por propiedad
CREATE TABLE IF NOT EXISTS property_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  visit_requests INTEGER DEFAULT 0,
  phone_clicks INTEGER DEFAULT 0,
  whatsapp_clicks INTEGER DEFAULT 0,
  email_inquiries INTEGER DEFAULT 0,
  favorites INTEGER DEFAULT 0,
  avg_time_on_page NUMERIC(10, 2) DEFAULT 0,
  portal_views JSONB DEFAULT '{"zonaprop": 0, "argenprop": 0, "mercadolibre": 0, "website": 0, "other": 0}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para consultas por propiedad y rango de fechas
CREATE INDEX IF NOT EXISTS idx_property_metrics_property_date
  ON property_metrics(property_id, date);

-- 4. Tabla de métricas mensuales agregadas
CREATE TABLE IF NOT EXISTS monthly_property_metrics (
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (property_id, month)
);

-- 5. Tabla de reportes mensuales
CREATE TABLE IF NOT EXISTS monthly_property_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES owners(id),
  report_month TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'reviewed', 'sent'
  metrics JSONB DEFAULT '{}'::jsonb,
  metrics_comparison JSONB DEFAULT '{}'::jsonb,
  market_data JSONB DEFAULT '{}'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  custom_notes TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para consultas por estado y mes
CREATE INDEX IF NOT EXISTS idx_reports_status
  ON monthly_property_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_property_month
  ON monthly_property_reports(property_id, report_month);

-- 6. Tabla de templates de reportes
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  template_html TEXT NOT NULL,
  template_whatsapp TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabla de entregas de reportes
CREATE TABLE IF NOT EXISTS report_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES monthly_property_reports(id) ON DELETE CASCADE,
  delivery_method VARCHAR(50) NOT NULL, -- 'whatsapp', 'email'
  recipient_phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_report
  ON report_deliveries(report_id);

-- 8. Tabla de fuentes de tráfico
CREATE TABLE IF NOT EXISTS traffic_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source VARCHAR(255) NOT NULL,
  medium VARCHAR(255),
  sessions INTEGER DEFAULT 0,
  users INTEGER DEFAULT 0,
  pageviews INTEGER DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traffic_sources_property
  ON traffic_sources(property_id, date);

-- 9. Habilitar Row Level Security (RLS)
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_property_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_property_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_sources ENABLE ROW LEVEL SECURITY;

-- 10. Políticas RLS: permitir acceso completo al service_role (backend)
-- Para owners
CREATE POLICY "Service role full access on owners" ON owners
  FOR ALL USING (true) WITH CHECK (true);

-- Para properties
CREATE POLICY "Service role full access on properties" ON properties
  FOR ALL USING (true) WITH CHECK (true);

-- Para property_metrics
CREATE POLICY "Service role full access on property_metrics" ON property_metrics
  FOR ALL USING (true) WITH CHECK (true);

-- Para monthly_property_metrics
CREATE POLICY "Service role full access on monthly_property_metrics" ON monthly_property_metrics
  FOR ALL USING (true) WITH CHECK (true);

-- Para monthly_property_reports
CREATE POLICY "Service role full access on monthly_property_reports" ON monthly_property_reports
  FOR ALL USING (true) WITH CHECK (true);

-- Para report_templates
CREATE POLICY "Service role full access on report_templates" ON report_templates
  FOR ALL USING (true) WITH CHECK (true);

-- Para report_deliveries
CREATE POLICY "Service role full access on report_deliveries" ON report_deliveries
  FOR ALL USING (true) WITH CHECK (true);

-- Para traffic_sources
CREATE POLICY "Service role full access on traffic_sources" ON traffic_sources
  FOR ALL USING (true) WITH CHECK (true);

-- 11. Insertar template por defecto
INSERT INTO report_templates (name, template_html, template_whatsapp, is_default)
VALUES (
  'Reporte Mensual Estándar',
  '<h1>Reporte Mensual - {{property_address}}</h1>
<p>Período: {{report_month}}</p>
<h2>Métricas</h2>
<ul>
  <li>Visitas totales: {{metrics.total_views}}</li>
  <li>Visitantes únicos: {{metrics.unique_visitors}}</li>
  <li>Consultas recibidas: {{metrics.leads_count}}</li>
  <li>Solicitudes de visita: {{metrics.visit_requests}}</li>
</ul>
<h2>Análisis de Mercado</h2>
<p>Precio de la propiedad: ${{market_data.property_price}}</p>
<p>Promedio del mercado: ${{market_data.market_average}}</p>
<p>Posición: {{market_data.position}}</p>
{{#if custom_notes}}
<h2>Notas</h2>
<p>{{custom_notes}}</p>
{{/if}}',
  '📊 *Reporte Mensual*
🏠 {{property_address}}
📅 {{report_month}}

📈 *Métricas del mes:*
👁 Visitas: {{metrics.total_views}}
👤 Visitantes únicos: {{metrics.unique_visitors}}
📩 Consultas: {{metrics.leads_count}}
🏠 Solicitudes de visita: {{metrics.visit_requests}}
📞 Clicks en teléfono: {{metrics.phone_clicks}}
💬 Clicks en WhatsApp: {{metrics.whatsapp_clicks}}

💰 *Mercado:*
Tu propiedad: ${{market_data.property_price}}
Promedio zona: ${{market_data.market_average}}
Posición: {{market_data.position}}

{{#if custom_notes}}📝 *Notas:* {{custom_notes}}{{/if}}',
  true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- ¡MIGRACIÓN COMPLETADA!
-- Verifica ejecutando:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('owners', 'properties', 'property_metrics',
--   'monthly_property_metrics', 'monthly_property_reports',
--   'report_templates', 'report_deliveries', 'traffic_sources');
-- Debería retornar 8 tablas.
-- ============================================
