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

    Handlebars.registerHelper('formatCurrency', (value: number, currency?: string) => {
      if (!value && value !== 0) return 'USD 0';
      const curr = typeof currency === 'string' ? currency : 'USD';
      return `${curr} ${new Intl.NumberFormat('es-AR').format(value)}`;
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

    Handlebars.registerHelper('formatDate', (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    });

    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    Handlebars.registerHelper('or', (a: any, b: any) => a || b);
    Handlebars.registerHelper('add', (a: number, b: number) => (a || 0) + (b || 0));
    Handlebars.registerHelper('lowercase', (str: string) => (str || '').toLowerCase());

    Handlebars.registerHelper('truncateAddress', (address: string) => {
      if (!address) return '';
      return address.length > 35 ? address.substring(0, 35) + '...' : address;
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
          tokko_id,
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

    // Fetch tenant branding
    let tenant: any = null;
    if (report.tenant_id) {
      const { data: tenantData } = await this.supabase
        .from('tenants')
        .select('company_name, agent_name, logo_url, primary_color, portals')
        .eq('id', report.tenant_id)
        .single();
      tenant = tenantData;
    }

    const primaryColor = tenant?.primary_color || '#c0392b';

    // Portales configurados del tenant (ej: "ZonaProp, BuscadorProp y otros portales")
    const portals: string[] = tenant?.portals || ['ZonaProp', 'MercadoLibre', 'ArgenProp'];
    const portalsText = portals.length > 0
      ? portals.join(', ') + ' y otros portales'
      : 'portales inmobiliarios';

    const template = Handlebars.compile(this.getTemplate());

    const marketData = report.market_data || {};
    const similarData = marketData.similar_properties || {};

    // Tokko data lives inside market_data JSONB (no separate columns needed)
    const tokkoProperty = marketData.tokko_property || report.tokko_property || null;
    const tokkoStats = marketData.tokko_stats || report.tokko_stats || null;

    // Determinar foto principal
    let mainPhoto = null;
    if (tokkoProperty?.photos) {
      mainPhoto = tokkoProperty.photos.find((p: any) => p.is_front_cover) || tokkoProperty.photos[0];
    }

    // Determinar precio y operación
    let operation = null;
    let price = report.properties?.price || 0;
    let currency = 'USD';
    if (tokkoProperty?.operations?.[0]) {
      const op = tokkoProperty.operations[0];
      operation = op.operation_type === 'Sale' ? 'Venta' : op.operation_type === 'Rent' ? 'Alquiler' : op.operation_type;
      if (op.prices?.[0]) {
        price = op.prices[0].price;
        currency = op.prices[0].currency;
      }
    }

    // Calcular total de interacciones Tokko para el resumen
    const tokkoTotal = tokkoStats
      ? (tokkoStats.emails_enviados || 0) + (tokkoStats.contactos_interesados || 0) + (tokkoStats.whatsapp_enviados || 0) + (tokkoStats.eventos_realizados || 0)
      : 0;

    // Calcular totales cross-platform (portales + web)
    const portalStatsArr: any[] = marketData.portal_stats || [];
    const metrics = report.metrics || {};

    const totalVistas =
      portalStatsArr.reduce((sum: number, p: any) => sum + (p.exposure?.total || 0), 0)
      + (metrics.total_views || 0);

    const totalPersonas =
      portalStatsArr.reduce((sum: number, p: any) => sum + (p.views?.total || 0), 0)
      + (metrics.unique_visitors || 0);

    const totalConsultas =
      portalStatsArr.reduce((sum: number, p: any) => sum + (p.interested?.total || 0), 0)
      + (metrics.leads_count || 0)
      + (metrics.phone_clicks || 0)
      + (metrics.whatsapp_clicks || 0);

    const hasTotals = totalVistas > 0 || totalPersonas > 0 || totalConsultas > 0;

    return template({
      report,
      property: report.properties,
      owner: report.properties?.owners,
      metrics: report.metrics || {},
      comparison: report.metrics_comparison || {},
      market: marketData,
      similarProperties: similarData.properties || [],
      similarCriteria: similarData.search_criteria || null,
      customNotes: report.custom_notes,
      reportMonth: report.report_month,
      generatedAt: report.generated_at,
      tokko: tokkoProperty,
      tokkoStats,
      tokkoTotal,
      mainPhoto,
      operation,
      price,
      currency,
      hasTokkoStats: !!tokkoStats,
      hasTokkoProperty: !!tokkoProperty,
      portalStats: marketData.portal_stats || [],
      hasPortalStats: !!(marketData.portal_stats && marketData.portal_stats.length > 0),
      // Totales cross-platform
      totalVistas,
      totalPersonas,
      totalConsultas,
      hasTotals,
      // Branding del tenant
      primaryColor,
      tenant,
      hasTenant: !!tenant,
      portalsText,
    });
  }

  private getTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte al propietario - {{property.address}}</title>
  <style>
    :root { --primary: {{primaryColor}}; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; color: #333; font-size: 15px; line-height: 1.5; }
    .container { max-width: 800px; margin: 0 auto; padding: 24px; }

    /* Header */
    .report-header { margin-bottom: 28px; border-bottom: 3px solid var(--primary); padding-bottom: 16px; display: flex; align-items: center; gap: 16px; }
    .report-header .header-logo { height: 48px; width: auto; }
    .report-header .header-text h1 { font-size: 26px; color: var(--primary); font-weight: 700; margin-bottom: 4px; }
    .report-header .header-text .period { font-size: 16px; color: #555; }
    .report-header .header-text .period strong { color: #333; }

    /* Property Card */
    .property-card { display: flex; gap: 24px; margin-bottom: 32px; align-items: flex-start; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
    .property-photo { width: 260px; height: 180px; border-radius: 8px; overflow: hidden; flex-shrink: 0; }
    .property-photo img { width: 100%; height: 100%; object-fit: cover; }
    .property-info { flex: 1; padding: 4px 0; }
    .property-type { font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .property-address { font-size: 20px; font-weight: 700; color: #333; margin-bottom: 4px; }
    .property-location { font-size: 14px; color: var(--primary); margin-bottom: 12px; }
    .property-features { display: flex; gap: 16px; margin-bottom: 12px; color: #555; font-size: 14px; }
    .property-features span { display: flex; align-items: center; gap: 4px; }
    .property-operation { font-size: 13px; color: #777; }
    .property-price { font-size: 20px; font-weight: 700; color: #333; margin-top: 4px; }

    /* Sections */
    .section { margin-bottom: 32px; }
    .section-header { margin-bottom: 16px; }
    .section-title { font-size: 19px; font-weight: 700; color: var(--primary); margin-bottom: 2px; }
    .section-subtitle { font-size: 13px; color: #888; }
    .section h2 { font-size: 19px; font-weight: 700; color: var(--primary); margin-bottom: 16px; }

    /* Resumen rápido */
    .summary-banner { background: linear-gradient(135deg, #fef3c7, #fde68a); border: 1px solid #f59e0b; border-radius: 10px; padding: 16px 20px; margin-bottom: 32px; text-align: center; }
    .summary-banner .summary-text { font-size: 16px; color: #92400e; }
    .summary-banner .summary-text strong { font-size: 20px; }

    /* Metrics Cards */
    .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .metrics-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .metric-card { background: #f9fafb; border: 1px solid #e5e7eb; padding: 18px 14px; border-radius: 10px; text-align: center; }
    .metric-card .value { font-size: 34px; font-weight: 800; color: var(--primary); line-height: 1; }
    .metric-card .label { font-size: 13px; color: #555; margin-top: 6px; font-weight: 500; }
    .metric-card .change { font-size: 11px; margin-top: 4px; font-weight: 600; }
    .metric-card.secondary .value { color: #1e40af; }

    /* Funnel visual */
    .funnel { display: flex; align-items: center; gap: 0; margin-bottom: 16px; }
    .funnel-step { flex: 1; text-align: center; padding: 16px 8px; position: relative; }
    .funnel-step .funnel-value { font-size: 30px; font-weight: 800; color: var(--primary); line-height: 1; }
    .funnel-step .funnel-label { font-size: 12px; color: #555; margin-top: 6px; font-weight: 500; }
    .funnel-arrow { font-size: 24px; color: #d1d5db; flex-shrink: 0; padding: 0 4px; }
    .funnel-step:first-child { background: #fef2f2; border-radius: 10px 0 0 10px; border: 1px solid #fecaca; }
    .funnel-step:nth-child(3) { background: #fff7ed; border-top: 1px solid #fed7aa; border-bottom: 1px solid #fed7aa; }
    .funnel-step:last-child { background: #f0fdf4; border-radius: 0 10px 10px 0; border: 1px solid #bbf7d0; }
    .funnel-step:last-child .funnel-value { color: #16a34a; }

    /* Portal Grid */
    .portals-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    .portal-card { background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 10px; text-align: center; }
    .portal-card .portal-value { font-size: 24px; font-weight: 700; color: #333; }
    .portal-card .portal-name { font-size: 12px; color: #666; margin-top: 2px; }

    /* Portal Exposure Stats */
    .portal-exposure { margin-top: 20px; }
    .portal-exposure-title { font-size: 15px; font-weight: 600; color: var(--primary); margin-bottom: 12px; }
    .exposure-funnel { display: flex; gap: 0; align-items: stretch; margin-bottom: 16px; }
    .exposure-step { flex: 1; padding: 16px 12px; text-align: center; position: relative; }
    .exposure-step .exp-value { font-size: 28px; font-weight: 700; }
    .exposure-step .exp-label { font-size: 11px; color: #666; margin-top: 2px; }
    .exposure-step .exp-segment { font-size: 10px; color: #999; margin-top: 4px; }
    .exposure-step:first-child { background: #fef2f2; border-radius: 10px 0 0 10px; border: 1px solid #fecaca; }
    .exposure-step:first-child .exp-value { color: #dc2626; }
    .exposure-step:nth-child(2) { background: #fff7ed; border-top: 1px solid #fed7aa; border-bottom: 1px solid #fed7aa; }
    .exposure-step:nth-child(2) .exp-value { color: #ea580c; }
    .exposure-step:last-child { background: #f0fdf4; border-radius: 0 10px 10px 0; border: 1px solid #bbf7d0; }
    .exposure-step:last-child .exp-value { color: #16a34a; }
    .portal-performance { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .perf-alto { background: #dcfce7; color: #166534; }
    .perf-medio { background: #fef9c3; color: #854d0e; }
    .perf-bajo { background: #fee2e2; color: #991b1b; }

    /* Contact sources */
    .sources-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .source-tag { background: #f3f4f6; border: 1px solid #e5e7eb; padding: 6px 14px; border-radius: 20px; font-size: 13px; color: #555; }

    /* Notes */
    .notes { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 10px; padding: 16px 20px; font-size: 15px; line-height: 1.6; }

    /* Guide section */
    .guide-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 32px; }
    .guide-title { font-size: 17px; font-weight: 700; color: var(--primary); margin-bottom: 16px; }
    .guide-item { margin-bottom: 14px; }
    .guide-item .guide-label { font-weight: 600; font-size: 14px; color: #333; margin-bottom: 2px; }
    .guide-item .guide-text { font-size: 13px; color: #555; line-height: 1.5; }

    /* Footer */
    .footer { margin-top: 36px; padding-top: 24px; border-top: 2px solid #e5e7eb; }
    .footer-content { display: flex; gap: 24px; align-items: center; }
    .footer-agent { display: flex; align-items: center; gap: 12px; }
    .footer-agent .name { font-weight: 600; font-size: 14px; }
    .footer-agent .detail { font-size: 12px; color: #666; }
    .footer-company { flex: 1; text-align: right; }
    .footer-company .company-name { font-weight: 600; font-size: 14px; }
    .footer-company .company-detail { font-size: 12px; color: #666; }
    .footer-note { text-align: center; padding: 16px 0; color: #999; font-size: 11px; }

    /* Divider */
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 8px 0 28px; }

    @media (max-width: 600px) {
      .property-card { flex-direction: column; }
      .property-photo { width: 100%; }
      .metrics-grid, .metrics-grid-3 { grid-template-columns: repeat(2, 1fr); }
      .market-row { flex-direction: column; }
      .funnel { flex-direction: column; }
      .funnel-arrow { transform: rotate(90deg); }
      .funnel-step:first-child, .funnel-step:nth-child(3), .funnel-step:last-child { border-radius: 10px; border: 1px solid #e5e7eb; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="report-header">
      {{#if tenant.logo_url}}<img class="header-logo" src="{{tenant.logo_url}}" alt="{{tenant.company_name}}" />{{/if}}
      <div class="header-text">
        <h1>Reporte al propietario</h1>
        <div class="period">Resumen de actividad del mes de <strong>{{formatMonth reportMonth}}</strong> (últimos 30 días)</div>
      </div>
    </div>

    <!-- Property Card -->
    <div class="property-card">
      {{#if mainPhoto}}
      <div class="property-photo">
        <img src="{{mainPhoto.image}}" alt="{{property.address}}" />
      </div>
      {{/if}}
      <div class="property-info">
        {{#if tokko}}
        <div class="property-type">{{tokko.type.name}}</div>
        <div class="property-address">{{tokko.real_address}}</div>
        <div class="property-location">📍 {{tokko.location.name}}</div>
        <div class="property-features">
          {{#if (gt tokko.room_amount 0)}}<span>🏠 {{tokko.room_amount}} amb.</span>{{/if}}
          {{#if (gt tokko.suite_amount 0)}}<span>🛏 {{tokko.suite_amount}} dorm.</span>{{/if}}
          {{#if (gt tokko.bathroom_amount 0)}}<span>🚿 {{tokko.bathroom_amount}} baño(s)</span>{{/if}}
          {{#if (gt tokko.parking_lot_amount 0)}}<span>🚗 {{tokko.parking_lot_amount}} cochera(s)</span>{{/if}}
        </div>
        {{else}}
        <div class="property-address">{{property.address}}</div>
        {{#if property.neighborhood}}<div class="property-location">📍 {{property.neighborhood}}</div>{{/if}}
        {{/if}}
        {{#if operation}}
        <div class="property-operation">{{operation}}</div>
        {{/if}}
        <div class="property-price">{{formatCurrency price currency}}</div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════ -->
    <!-- SECCIÓN 1: ACTIVIDAD EN PORTALES (TOKKO)  -->
    <!-- ══════════════════════════════════════════ -->
    {{#if hasTokkoStats}}
    <div class="section">
      <div class="section-header">
        <div class="section-title">Actividad en portales inmobiliarios</div>
        <div class="section-subtitle">Datos de los últimos 30 días en {{portalsText}}</div>
      </div>

      <!-- Funnel: Fichas → Consultas → Contactos efectivos -->
      <div class="funnel">
        <div class="funnel-step">
          <div class="funnel-value">{{formatNumber tokkoStats.emails_enviados}}</div>
          <div class="funnel-label">Fichas enviadas</div>
        </div>
        <div class="funnel-arrow">→</div>
        <div class="funnel-step">
          <div class="funnel-value">{{formatNumber tokkoStats.contactos_interesados}}</div>
          <div class="funnel-label">Consultas recibidas</div>
        </div>
        <div class="funnel-arrow">→</div>
        <div class="funnel-step">
          <div class="funnel-value">{{formatNumber (add tokkoStats.whatsapp_enviados tokkoStats.eventos_realizados)}}</div>
          <div class="funnel-label">Contactos directos</div>
        </div>
      </div>

      <!-- Detalle de contactos -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="value">{{formatNumber tokkoStats.emails_enviados}}</div>
          <div class="label">Fichas enviadas por email</div>
        </div>
        <div class="metric-card">
          <div class="value">{{formatNumber tokkoStats.contactos_interesados}}</div>
          <div class="label">Personas interesadas</div>
        </div>
        <div class="metric-card">
          <div class="value">{{formatNumber tokkoStats.whatsapp_enviados}}</div>
          <div class="label">Mensajes por WhatsApp</div>
        </div>
        <div class="metric-card">
          <div class="value">{{formatNumber tokkoStats.eventos_realizados}}</div>
          <div class="label">Visitas coordinadas</div>
        </div>
      </div>

      {{#if tokkoStats.fuentes_contacto.length}}
      <div style="margin-top: 16px;">
        <div style="font-size: 14px; color: #555; margin-bottom: 8px; font-weight: 600;">¿De dónde llegaron los interesados?</div>
        <div class="sources-list">
          {{#each tokkoStats.fuentes_contacto}}
          <span class="source-tag">{{this.etiqueta}}: {{this.total}}</span>
          {{/each}}
        </div>
      </div>
      {{/if}}

      {{#if hasPortalStats}}
      <!-- Exposición en portales (ZonaProp, etc.) -->
      <div class="portal-exposure" style="margin-top: 24px;">
        {{#each portalStats}}
        <div class="portal-exposure-title">📊 Rendimiento en {{this.portal_name}} (últimos 30 días)</div>

        <div class="exposure-funnel">
          <div class="exposure-step">
            <div class="exp-value">{{formatNumber this.exposure.total}}</div>
            <div class="exp-label">Exposición</div>
            <div class="exp-segment">Promedio: {{formatNumber this.exposure.segment}}</div>
          </div>
          <div class="exposure-step">
            <div class="exp-value">{{formatNumber this.views.total}}</div>
            <div class="exp-label">Vistas del aviso</div>
            <div class="exp-segment">Promedio: {{formatNumber this.views.segment}}</div>
          </div>
          <div class="exposure-step">
            <div class="exp-value">{{formatNumber this.interested.total}}</div>
            <div class="exp-label">Contactos interesados</div>
            <div class="exp-segment">Promedio: {{formatNumber this.interested.segment}}</div>
          </div>
        </div>

        <div style="margin-top: 8px; text-align: center;">
          <span class="portal-performance perf-{{lowercase this.performance}}">Desempeño: {{this.performance}}</span>
        </div>
        {{/each}}
      </div>
      {{/if}}
    </div>
    {{/if}}

    <hr class="divider" />

    <!-- ══════════════════════════════════════════ -->
    <!-- SECCIÓN 2: ACTIVIDAD EN NUESTRA WEB       -->
    <!-- ══════════════════════════════════════════ -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">Actividad en nuestra página web</div>
        <div class="section-subtitle">Visitas, consultas y contactos en nuestro sitio web durante los últimos 30 días</div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card secondary">
          <div class="value">{{formatNumber metrics.total_views}}</div>
          <div class="label">Veces que se vio su propiedad</div>
          {{#if comparison.views_change_pct}}
          <div class="change" style="color: {{trendColor comparison.views_change_pct}}">
            {{trendIcon comparison.views_change_pct}} {{formatPercent comparison.views_change_pct}} vs mes anterior
          </div>
          {{/if}}
        </div>
        <div class="metric-card secondary">
          <div class="value">{{formatNumber metrics.unique_visitors}}</div>
          <div class="label">Personas diferentes que la vieron</div>
        </div>
        <div class="metric-card secondary">
          <div class="value">{{formatNumber metrics.leads_count}}</div>
          <div class="label">Consultas recibidas</div>
          {{#if comparison.leads_change_pct}}
          <div class="change" style="color: {{trendColor comparison.leads_change_pct}}">
            {{trendIcon comparison.leads_change_pct}} {{formatPercent comparison.leads_change_pct}}
          </div>
          {{/if}}
        </div>
        <div class="metric-card secondary">
          <div class="value">{{formatNumber metrics.favorites_count}}</div>
          <div class="label">Guardada como favorita</div>
        </div>
      </div>

    </div>

    <!-- ══════════════════════════════════════════ -->
    <!-- EN TOTAL: Resumen cross-platform          -->
    <!-- ══════════════════════════════════════════ -->
    {{#if hasTotals}}
    <div class="section">
      <div class="section-header">
        <div class="section-title">En total</div>
        <div class="section-subtitle">Sumando todos los portales y nuestra página web</div>
      </div>
      <div class="metrics-grid-3">
        <div class="metric-card" style="background: #eef2ff; border-color: #c7d2fe;">
          <div class="value" style="font-size: 38px;">{{formatNumber totalVistas}}</div>
          <div class="label">Vistas</div>
        </div>
        <div class="metric-card" style="background: #eef2ff; border-color: #c7d2fe;">
          <div class="value" style="font-size: 38px;">{{formatNumber totalPersonas}}</div>
          <div class="label">Personas que la vieron</div>
        </div>
        <div class="metric-card" style="background: #eef2ff; border-color: #c7d2fe;">
          <div class="value" style="font-size: 38px;">{{formatNumber totalConsultas}}</div>
          <div class="label">Consultas</div>
        </div>
      </div>
    </div>
    {{/if}}

    {{#if customNotes}}
    <div class="section">
      <div class="section-title">Comentario de su agente</div>
      <div class="notes">
        {{{customNotes}}}
      </div>
    </div>
    {{/if}}

    <!-- Guía: qué significa cada dato -->
    <div class="guide-section">
      <div class="guide-title">{{#if owner.name}}{{owner.name}}, ¿qué{{else}}¿Qué{{/if}} significa cada número?</div>

      <div class="guide-item">
        <div class="guide-label">📬 Fichas enviadas</div>
        <div class="guide-text">Cuántas personas recibieron los datos de tu propiedad. Más fichas = más gente viendo tu aviso.</div>
      </div>

      <div class="guide-item">
        <div class="guide-label">💬 Consultas</div>
        <div class="guide-text">Cada consulta es alguien que pidió más información. Ya sea que coordinamos una visita o no, nos hemos contactado y conversamos sobre tu propiedad.</div>
      </div>

      <div class="guide-item">
        <div class="guide-label">📱 Contactos directos</div>
        <div class="guide-text">Los que nos escribieron por WhatsApp o pidieron visita. Son los más interesados.</div>
      </div>

      {{#if hasPortalStats}}
      <div class="guide-item">
        <div class="guide-label">📈 Rendimiento en portales</div>
        <div class="guide-text">Cuántas veces apareció tu aviso en búsquedas, cuántos lo abrieron y cuántos nos contactaron. El "promedio" te compara con propiedades similares de la zona.</div>
      </div>
      {{/if}}

      <div class="guide-item">
        <div class="guide-label">🌐 Nuestra web</div>
        <div class="guide-text">Visitas a tu propiedad en nuestro sitio web, personas distintas que la vieron, y consultas recibidas.</div>
      </div>

      <div class="guide-item">
        <div class="guide-text" style="margin-top: 8px; color: #333;">Tu propiedad está activa y trabajando en múltiples canales. Si tenés alguna duda, escribinos y lo charlamos.</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      {{#if (or hasTenant tokko.branch)}}
      <div class="footer-content">
        {{#if tenant.agent_name}}
        <div class="footer-agent">
          <div>
            <div class="name">{{tenant.agent_name}}</div>
          </div>
        </div>
        {{else}}
        {{#if tokko.producer}}
        <div class="footer-agent">
          <div>
            <div class="name">{{tokko.producer.name}}</div>
            {{#if tokko.producer.phone}}<div class="detail">Tel: {{tokko.producer.phone}}</div>{{/if}}
            {{#if tokko.producer.email}}<div class="detail">{{tokko.producer.email}}</div>{{/if}}
          </div>
        </div>
        {{/if}}
        {{/if}}
        <div class="footer-company">
          {{#if tenant.company_name}}
          <div class="company-name">{{tenant.company_name}}</div>
          {{else}}
          {{#if tokko.branch}}
          <div class="company-name">{{tokko.branch.name}}</div>
          {{#if tokko.branch.address}}<div class="company-detail">{{tokko.branch.address}}</div>{{/if}}
          {{#if tokko.branch.phone}}<div class="company-detail">Tel: {{tokko.branch.phone}}</div>{{/if}}
          {{#if tokko.branch.email}}<div class="company-detail">{{tokko.branch.email}}</div>{{/if}}
          {{/if}}
          {{/if}}
        </div>
      </div>
      {{/if}}
      <div class="footer-note">
        Reporte generado el {{formatDate generatedAt}} | Datos de los últimos 30 días | Confidencial
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }
}
