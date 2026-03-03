import Handlebars from 'handlebars';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class ReportTemplateEngine {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.registerHelpers();
  }

  private registerHelpers(): void {
    Handlebars.registerHelper('formatNumber', (value: number) => {
      if (!value && value !== 0) return '0';
      return new Intl.NumberFormat('es-AR').format(value);
    });

    Handlebars.registerHelper('formatCurrency', (value: number) => {
      if (!value && value !== 0) return 'USD 0';
      return `USD ${new Intl.NumberFormat('es-AR').format(value)}`;
    });

    Handlebars.registerHelper('formatPercent', (value: number) => {
      if (!value && value !== 0) return '0%';
      const sign = value > 0 ? '+' : '';
      return `${sign}${value.toFixed(1)}%`;
    });

    Handlebars.registerHelper('trendIcon', (value: number) => {
      if (value > 0) return '↑';
      if (value < 0) return '↓';
      return '→';
    });

    Handlebars.registerHelper('trendColor', (value: number) => {
      if (value > 0) return '#22c55e';
      if (value < 0) return '#ef4444';
      return '#6b7280';
    });

    Handlebars.registerHelper('positionText', (position: string) => {
      switch (position) {
        case 'above': return 'Por encima del mercado';
        case 'below': return 'Por debajo del mercado';
        default: return 'Al precio de mercado';
      }
    });

    Handlebars.registerHelper('formatMonth', (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    });
  }

  async renderReport(reportId: string): Promise<string> {
    const { data: report, error } = await this.supabase
      .from('monthly_property_reports')
      .select(`
        *,
        properties (
          address,
          neighborhood,
          property_type,
          price,
          surface_total,
          rooms,
          bathrooms,
          owners (
            name,
            email
          )
        )
      `)
      .eq('id', reportId)
      .single();

    if (error || !report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    const template = Handlebars.compile(this.getTemplate());

    return template({
      report,
      property: report.properties,
      owner: report.properties.owners,
      metrics: report.metrics || {},
      comparison: report.metrics_comparison || {},
      market: report.market_data || {},
      customNotes: report.custom_notes,
      reportMonth: report.report_month,
      generatedAt: report.generated_at,
    });
  }

  private getTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Mensual - {{property.address}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; color: #1e293b; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 40px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .section { background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section h2 { font-size: 18px; margin-bottom: 16px; color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }
    .metric-card { background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; }
    .metric-value { font-size: 28px; font-weight: bold; color: #1e40af; }
    .metric-label { font-size: 12px; color: #64748b; margin-top: 4px; }
    .metric-change { font-size: 12px; margin-top: 4px; font-weight: 600; }
    .market-position { padding: 16px; border-radius: 8px; text-align: center; font-weight: 600; }
    .portals-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
    .portal-card { padding: 12px; border-radius: 8px; background: #f1f5f9; text-align: center; }
    .portal-name { font-size: 12px; color: #64748b; }
    .portal-value { font-size: 20px; font-weight: bold; color: #1e40af; }
    .notes { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; }
    .footer { text-align: center; padding: 24px; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reporte Mensual de Propiedad</h1>
      <p>{{property.address}}</p>
      <p>Período: {{formatMonth reportMonth}}</p>
      <p>Propietario: {{owner.name}}</p>
    </div>

    <div class="section">
      <h2>Métricas de Rendimiento</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">{{formatNumber metrics.total_views}}</div>
          <div class="metric-label">Visualizaciones</div>
          <div class="metric-change" style="color: {{trendColor comparison.views_change_pct}}">
            {{trendIcon comparison.views_change_pct}} {{formatPercent comparison.views_change_pct}}
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{{formatNumber metrics.leads_count}}</div>
          <div class="metric-label">Consultas</div>
          <div class="metric-change" style="color: {{trendColor comparison.leads_change_pct}}">
            {{trendIcon comparison.leads_change_pct}} {{formatPercent comparison.leads_change_pct}}
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{{formatNumber metrics.visit_requests}}</div>
          <div class="metric-label">Solicitudes de Visita</div>
          <div class="metric-change" style="color: {{trendColor comparison.visits_change_pct}}">
            {{trendIcon comparison.visits_change_pct}} {{formatPercent comparison.visits_change_pct}}
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{{formatNumber metrics.favorites_count}}</div>
          <div class="metric-label">Favoritos</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Rendimiento por Portal</h2>
      <div class="portals-grid">
        <div class="portal-card">
          <div class="portal-value">{{formatNumber metrics.portal_views.zonaprop}}</div>
          <div class="portal-name">ZonaProp</div>
        </div>
        <div class="portal-card">
          <div class="portal-value">{{formatNumber metrics.portal_views.argenprop}}</div>
          <div class="portal-name">ArgenProp</div>
        </div>
        <div class="portal-card">
          <div class="portal-value">{{formatNumber metrics.portal_views.mercadolibre}}</div>
          <div class="portal-name">MercadoLibre</div>
        </div>
        <div class="portal-card">
          <div class="portal-value">{{formatNumber metrics.portal_views.website}}</div>
          <div class="portal-name">Sitio Web</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Contactos</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">{{formatNumber metrics.phone_clicks}}</div>
          <div class="metric-label">Clicks Teléfono</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{{formatNumber metrics.whatsapp_clicks}}</div>
          <div class="metric-label">Clicks WhatsApp</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{{formatNumber metrics.email_inquiries}}</div>
          <div class="metric-label">Consultas Email</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Análisis de Mercado</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">{{formatCurrency market.property_price}}</div>
          <div class="metric-label">Precio Publicado</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{{formatCurrency market.market_average}}</div>
          <div class="metric-label">Promedio de Mercado</div>
        </div>
      </div>
      <div class="market-position" style="margin-top: 16px; background: {{#if (eq market.position 'above')}}#fef3c7{{else if (eq market.position 'below')}}#dcfce7{{else}}#f1f5f9{{/if}}">
        {{positionText market.position}} ({{formatPercent market.difference_pct}})
      </div>
    </div>

    {{#if customNotes}}
    <div class="section">
      <h2>Notas del Agente</h2>
      <div class="notes">
        {{{customNotes}}}
      </div>
    </div>
    {{/if}}

    <div class="footer">
      <p>Reporte generado automáticamente el {{generatedAt}}</p>
      <p>Este reporte es confidencial y está destinado exclusivamente al propietario.</p>
    </div>
  </div>
</body>
</html>
    `;
  }
}
