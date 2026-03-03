import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PropertyMetricsService } from './propertyMetricsService';
import { MarketAnalysisService } from './marketAnalysisService';

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

    const [metrics, marketData] = await Promise.all([
      this.metricsService.getPropertyMetrics(propertyId, month),
      this.marketService.comparePropertyToMarket(propertyId),
    ]);

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
