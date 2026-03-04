import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PropertyMetricsService } from './propertyMetricsService';
import { MarketAnalysisService } from './marketAnalysisService';
import { TokkobrokerService } from './tokkobrokerService';
import { GoogleAnalyticsService } from './googleAnalyticsService';

interface GenerationOptions {
  month?: Date;
  propertyIds?: string[];
  autoNotify?: boolean;
}

interface GenerationResult {
  total_properties: number;
  reports_generated: number;
  reports_failed: number;
  errors: string[];
}

export class ReportGenerationService {
  private supabase: SupabaseClient;
  private metricsService: PropertyMetricsService;
  private marketService: MarketAnalysisService;

  constructor(supabaseUrl: string, supabaseKey: string, searchEngineUrl: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.metricsService = new PropertyMetricsService(supabaseUrl, supabaseKey, searchEngineUrl);
    this.marketService = new MarketAnalysisService(supabaseUrl, supabaseKey, searchEngineUrl);
  }

  async generateMonthlyReports(options: GenerationOptions = {}): Promise<GenerationResult> {
    const month = options.month || this.getPreviousMonth();
    const result: GenerationResult = {
      total_properties: 0,
      reports_generated: 0,
      reports_failed: 0,
      errors: [],
    };

    try {
      let query = this.supabase
        .from('properties')
        .select('id, address, neighborhood, property_type, price, owner_id')
        .eq('status', 'active')
        .eq('reports_enabled', true);

      if (options.propertyIds && options.propertyIds.length > 0) {
        query = query.in('id', options.propertyIds);
      }

      const { data: properties, error } = await query;

      if (error) throw error;

      if (!properties || properties.length === 0) {
        console.log('No active properties found for report generation');
        return result;
      }

      result.total_properties = properties.length;

      for (const property of properties) {
        try {
          await this.generatePropertyReport(property.id, month);
          result.reports_generated++;
        } catch (error: any) {
          result.reports_failed++;
          result.errors.push(`Property ${property.id}: ${error.message}`);
          console.error(`Failed to generate report for property ${property.id}:`, error);
        }
      }

      console.log(`Report generation complete: ${result.reports_generated}/${result.total_properties} successful`);

      return result;
    } catch (error) {
      console.error('Error in monthly report generation:', error);
      throw error;
    }
  }

  async generatePropertyReport(propertyId: string, month: Date): Promise<string> {
    const { data: property, error: propError } = await this.supabase
      .from('properties')
      .select(`
        *,
        owners (
          id,
          name,
          email,
          phone,
          whatsapp
        )
      `)
      .eq('id', propertyId)
      .single();

    if (propError || !property) {
      throw new Error(`Property not found: ${propertyId}`);
    }

    const existingReport = await this.checkExistingReport(propertyId, month);
    if (existingReport) {
      console.log(`Report already exists for property ${propertyId} - month ${month.toISOString()}`);
      return existingReport.id;
    }

    let [metrics, marketData, similarProperties] = await Promise.all([
      this.metricsService.getPropertyMetrics(propertyId, month),
      this.marketService.comparePropertyToMarket(propertyId),
      this.marketService.getSimilarProperties(propertyId, month).catch(err => {
        console.warn('Could not fetch similar properties:', err);
        return null;
      }),
    ]);

    // If no metrics in DB, fetch from external sources
    const hasNoMetrics = metrics.total_views === 0 && metrics.leads_count === 0
      && metrics.favorites_count === 0 && metrics.visit_requests === 0;

    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    // Fetch from Tokko if available
    if (hasNoMetrics && property.tokko_id) {
      const tokko = new TokkobrokerService();
      if (tokko.isConfigured()) {
        const tokkoMetrics = await tokko.getPropertyMetrics(
          property.tokko_id,
          startOfMonth,
          endOfMonth
        );

        if (tokkoMetrics) {
          metrics = {
            ...metrics,
            total_views: tokkoMetrics.views || 0,
            leads_count: tokkoMetrics.contacts || 0,
            favorites_count: tokkoMetrics.favorites || 0,
          };
          console.log(`Fetched Tokko metrics for property ${propertyId}: views=${tokkoMetrics.views}, contacts=${tokkoMetrics.contacts}, favorites=${tokkoMetrics.favorites}`);

          // Also save to property_metrics so future queries find it
          try {
            await this.supabase.from('property_metrics').insert({
              property_id: propertyId,
              date: startOfMonth.toISOString().split('T')[0],
              views: tokkoMetrics.views || 0,
              leads: tokkoMetrics.contacts || 0,
              favorites: tokkoMetrics.favorites || 0,
              unique_visitors: 0,
              visit_requests: 0,
              phone_clicks: 0,
              whatsapp_clicks: 0,
              email_inquiries: 0,
              avg_time_on_page: 0,
              portal_views: {},
            });
          } catch (saveErr) {
            console.warn('Could not save Tokko metrics to DB:', saveErr);
          }
        }
      }
    }

    // Fetch from Google Analytics using the property's web_url
    if (property.web_url) {
      try {
        const ga = new GoogleAnalyticsService();
        if (ga.isConfigured()) {
          const gaMetrics = await ga.getMetricsByPageUrl(
            property.web_url,
            startOfMonth,
            endOfMonth
          );

          if (gaMetrics) {
            // Add GA website views to total (don't overwrite Tokko data, complement it)
            metrics = {
              ...metrics,
              total_views: metrics.total_views + gaMetrics.pageviews,
              unique_visitors: metrics.unique_visitors + gaMetrics.unique_visitors,
              avg_time_on_page: gaMetrics.avg_time_on_page || metrics.avg_time_on_page,
              portal_views: {
                ...metrics.portal_views,
                website: gaMetrics.pageviews,
              },
            };
            console.log(`Fetched GA metrics for property ${propertyId} (${property.web_url}): pageviews=${gaMetrics.pageviews}, users=${gaMetrics.unique_visitors}`);
          }
        }
      } catch (gaErr) {
        console.warn('Could not fetch Google Analytics metrics:', gaErr);
      }
    }

    const metricsComparison = await this.metricsService.getMetricsComparison(propertyId, month);

    const reportData = {
      property_id: propertyId,
      owner_id: property.owner_id,
      report_month: new Date(month.getFullYear(), month.getMonth(), 1).toISOString(),
      status: 'draft',
      metrics: {
        total_views: metrics.total_views,
        unique_visitors: metrics.unique_visitors,
        leads_count: metrics.leads_count,
        visit_requests: metrics.visit_requests,
        phone_clicks: metrics.phone_clicks,
        whatsapp_clicks: metrics.whatsapp_clicks,
        email_inquiries: metrics.email_inquiries,
        favorites_count: metrics.favorites_count,
        portal_views: metrics.portal_views,
      },
      metrics_comparison: metricsComparison.changes,
      market_data: {
        property_price: marketData.property_price,
        market_average: marketData.market_average,
        position: marketData.position,
        difference_pct: marketData.difference_pct,
        similar_properties: similarProperties || null,
      },
      custom_notes: null,
      generated_at: new Date().toISOString(),
    };

    const { data: report, error: insertError } = await this.supabase
      .from('monthly_property_reports')
      .insert(reportData)
      .select('id')
      .single();

    if (insertError) throw insertError;

    return report.id;
  }

  async deleteExistingReport(propertyId: string, month: Date): Promise<void> {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const { error } = await this.supabase
      .from('monthly_property_reports')
      .delete()
      .eq('property_id', propertyId)
      .gte('report_month', startOfMonth.toISOString())
      .lte('report_month', endOfMonth.toISOString());

    if (error) {
      console.warn('Error deleting existing report:', error);
    }
  }

  async deleteExistingReportsForMonth(month?: Date): Promise<void> {
    const m = month || this.getPreviousMonth();
    const startOfMonth = new Date(m.getFullYear(), m.getMonth(), 1);
    const endOfMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0);

    const { error } = await this.supabase
      .from('monthly_property_reports')
      .delete()
      .gte('report_month', startOfMonth.toISOString())
      .lte('report_month', endOfMonth.toISOString());

    if (error) {
      console.warn('Error deleting existing reports:', error);
    }
  }

  private async checkExistingReport(propertyId: string, month: Date): Promise<any | null> {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const { data } = await this.supabase
      .from('monthly_property_reports')
      .select('id')
      .eq('property_id', propertyId)
      .gte('report_month', startOfMonth.toISOString())
      .lte('report_month', endOfMonth.toISOString())
      .single();

    return data;
  }

  private getPreviousMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }
}
