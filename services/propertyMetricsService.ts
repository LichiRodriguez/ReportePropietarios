import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface PropertyMetrics {
  total_views: number;
  unique_visitors: number;
  leads_count: number;
  visit_requests: number;
  phone_clicks: number;
  whatsapp_clicks: number;
  email_inquiries: number;
  favorites_count: number;
  avg_time_on_page: number;
  portal_views: PortalViews;
}

interface PortalViews {
  zonaprop: number;
  argenprop: number;
  mercadolibre: number;
  website: number;
  other: number;
}

interface MetricsComparison {
  current: PropertyMetrics;
  previous: PropertyMetrics;
  changes: {
    views_change_pct: number;
    leads_change_pct: number;
    visits_change_pct: number;
  };
}

export class PropertyMetricsService {
  private supabase: SupabaseClient;
  private searchEngineUrl: string;

  constructor(supabaseUrl: string, supabaseKey: string, searchEngineUrl: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.searchEngineUrl = searchEngineUrl;
  }

  async getPropertyMetrics(propertyId: string, month: Date): Promise<PropertyMetrics> {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    try {
      const { data: metrics, error } = await this.supabase
        .from('property_metrics')
        .select('*')
        .eq('property_id', propertyId)
        .gte('date', startOfMonth.toISOString())
        .lte('date', endOfMonth.toISOString());

      if (error) throw error;

      if (!metrics || metrics.length === 0) {
        return this.getEmptyMetrics();
      }

      return this.aggregateMetrics(metrics);
    } catch (error) {
      console.error('Error fetching property metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  async getMetricsComparison(propertyId: string, month: Date): Promise<MetricsComparison> {
    const previousMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);

    const [current, previous] = await Promise.all([
      this.getPropertyMetrics(propertyId, month),
      this.getPropertyMetrics(propertyId, previousMonth),
    ]);

    const calcChange = (curr: number, prev: number): number => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100 * 100) / 100;
    };

    return {
      current,
      previous,
      changes: {
        views_change_pct: calcChange(current.total_views, previous.total_views),
        leads_change_pct: calcChange(current.leads_count, previous.leads_count),
        visits_change_pct: calcChange(current.visit_requests, previous.visit_requests),
      },
    };
  }

  async fetchPortalMetrics(propertyId: string, month: Date): Promise<PortalViews> {
    try {
      const response = await fetch(`${this.searchEngineUrl}/api/metrics/${propertyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: new Date(month.getFullYear(), month.getMonth(), 1).toISOString(),
          end_date: new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString(),
        }),
      });

      if (!response.ok) {
        console.warn('Search engine metrics unavailable');
        return { zonaprop: 0, argenprop: 0, mercadolibre: 0, website: 0, other: 0 };
      }

      return await response.json();
    } catch (error) {
      console.warn('Could not fetch portal metrics:', error);
      return { zonaprop: 0, argenprop: 0, mercadolibre: 0, website: 0, other: 0 };
    }
  }

  async saveMetrics(propertyId: string, month: Date, metrics: PropertyMetrics): Promise<void> {
    const { error } = await this.supabase
      .from('monthly_property_metrics')
      .upsert({
        property_id: propertyId,
        month: new Date(month.getFullYear(), month.getMonth(), 1).toISOString(),
        metrics: metrics,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'property_id,month',
      });

    if (error) {
      console.error('Error saving metrics:', error);
      throw error;
    }
  }

  private aggregateMetrics(metrics: any[]): PropertyMetrics {
    return {
      total_views: metrics.reduce((sum, m) => sum + (m.views || 0), 0),
      unique_visitors: metrics.reduce((sum, m) => sum + (m.unique_visitors || 0), 0),
      leads_count: metrics.reduce((sum, m) => sum + (m.leads || 0), 0),
      visit_requests: metrics.reduce((sum, m) => sum + (m.visit_requests || 0), 0),
      phone_clicks: metrics.reduce((sum, m) => sum + (m.phone_clicks || 0), 0),
      whatsapp_clicks: metrics.reduce((sum, m) => sum + (m.whatsapp_clicks || 0), 0),
      email_inquiries: metrics.reduce((sum, m) => sum + (m.email_inquiries || 0), 0),
      favorites_count: metrics.reduce((sum, m) => sum + (m.favorites || 0), 0),
      avg_time_on_page: metrics.length > 0
        ? metrics.reduce((sum, m) => sum + (m.avg_time_on_page || 0), 0) / metrics.length
        : 0,
      portal_views: {
        zonaprop: metrics.reduce((sum, m) => sum + (m.portal_views?.zonaprop || 0), 0),
        argenprop: metrics.reduce((sum, m) => sum + (m.portal_views?.argenprop || 0), 0),
        mercadolibre: metrics.reduce((sum, m) => sum + (m.portal_views?.mercadolibre || 0), 0),
        website: metrics.reduce((sum, m) => sum + (m.portal_views?.website || 0), 0),
        other: metrics.reduce((sum, m) => sum + (m.portal_views?.other || 0), 0),
      },
    };
  }

  private getEmptyMetrics(): PropertyMetrics {
    return {
      total_views: 0,
      unique_visitors: 0,
      leads_count: 0,
      visit_requests: 0,
      phone_clicks: 0,
      whatsapp_clicks: 0,
      email_inquiries: 0,
      favorites_count: 0,
      avg_time_on_page: 0,
      portal_views: {
        zonaprop: 0,
        argenprop: 0,
        mercadolibre: 0,
        website: 0,
        other: 0,
      },
    };
  }
}
