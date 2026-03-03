interface TokkoProperty {
  id: number;
  reference_code: string;
  address: string;
  publication_title: string;
  status: number;
  price: number;
  currency: string;
  photos: TokkoPhoto[];
  videos: any[];
  operations: TokkoOperation[];
}

interface TokkoPhoto {
  id: number;
  image: string;
  thumb: string;
  is_front_cover: boolean;
}

interface TokkoOperation {
  operation_type: string;
  prices: { price: number; currency: string }[];
}

interface TokkoMetrics {
  views: number;
  contacts: number;
  favorites: number;
  shared: number;
  period_start: string;
  period_end: string;
}

export class TokkobrokerService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TOKKO_API_KEY || '';
    this.baseUrl = 'https://www.tokkobroker.com/api/v1';
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async getProperty(propertyId: string): Promise<TokkoProperty | null> {
    if (!this.isConfigured()) {
      console.warn('TokkoBoker API key not configured');
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/property/${propertyId}/?key=${this.apiKey}&format=json`
      );

      if (!response.ok) {
        console.error(`TokkoBoker API error: ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching property from TokkoBoker:', error);
      return null;
    }
  }

  async getProperties(filters: {
    status?: number;
    operation_type?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<TokkoProperty[]> {
    if (!this.isConfigured()) return [];

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        format: 'json',
        limit: String(filters.limit || 50),
        offset: String(filters.offset || 0),
      });

      if (filters.status !== undefined) {
        params.append('status', String(filters.status));
      }

      const response = await fetch(
        `${this.baseUrl}/property/?${params.toString()}`
      );

      if (!response.ok) {
        console.error(`TokkoBoker API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return data.objects || [];
    } catch (error) {
      console.error('Error fetching properties from TokkoBoker:', error);
      return [];
    }
  }

  async getPropertyMetrics(
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TokkoMetrics | null> {
    if (!this.isConfigured()) return null;

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        format: 'json',
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      });

      const response = await fetch(
        `${this.baseUrl}/property/${propertyId}/metrics/?${params.toString()}`
      );

      if (!response.ok) {
        console.warn(`Metrics not available for property ${propertyId}`);
        return null;
      }

      const data = await response.json();
      return {
        views: data.views || 0,
        contacts: data.contacts || 0,
        favorites: data.favorites || 0,
        shared: data.shared || 0,
        period_start: startDate.toISOString(),
        period_end: endDate.toISOString(),
      };
    } catch (error) {
      console.error('Error fetching metrics from TokkoBoker:', error);
      return null;
    }
  }

  async getContacts(propertyId: string): Promise<any[]> {
    if (!this.isConfigured()) return [];

    try {
      const response = await fetch(
        `${this.baseUrl}/property/${propertyId}/contacts/?key=${this.apiKey}&format=json`
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.objects || [];
    } catch (error) {
      console.error('Error fetching contacts from TokkoBoker:', error);
      return [];
    }
  }

  async syncProperties(supabase: any): Promise<{
    synced: number;
    errors: number;
  }> {
    if (!this.isConfigured()) {
      return { synced: 0, errors: 0 };
    }

    const result = { synced: 0, errors: 0 };

    try {
      const properties = await this.getProperties({ limit: 100 });

      for (const tkkProp of properties) {
        try {
          const { error } = await supabase
            .from('properties')
            .upsert({
              tokko_id: tkkProp.id,
              address: tkkProp.address,
              price: tkkProp.price,
              status: tkkProp.status === 2 ? 'active' : 'inactive',
              tokko_data: tkkProp,
              synced_at: new Date().toISOString(),
            }, {
              onConflict: 'tokko_id',
            });

          if (error) throw error;
          result.synced++;
        } catch (err) {
          result.errors++;
          console.error(`Error syncing property ${tkkProp.id}:`, err);
        }
      }

      return result;
    } catch (error) {
      console.error('Error in property sync:', error);
      throw error;
    }
  }
}
