import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface MarketData {
  average_price: number;
  price_per_sqm: number;
  total_listings: number;
  avg_days_on_market: number;
  price_trend: 'up' | 'down' | 'stable';
  price_change_pct: number;
}

interface ComparisonData {
  property_price: number;
  market_average: number;
  position: 'above' | 'below' | 'at_market';
  difference_pct: number;
}

export class MarketAnalysisService {
  private supabase: SupabaseClient;
  private searchEngineUrl: string;

  constructor(supabaseUrl: string, supabaseKey: string, searchEngineUrl: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.searchEngineUrl = searchEngineUrl;
  }

  async getMarketData(neighborhood: string, propertyType: string): Promise<MarketData> {
    try {
      const { data: listings, error } = await this.supabase
        .from('properties')
        .select('price, surface_total, created_at, status')
        .eq('neighborhood', neighborhood)
        .eq('property_type', propertyType)
        .eq('status', 'active');

      if (error) throw error;

      if (!listings || listings.length === 0) {
        return {
          average_price: 0,
          price_per_sqm: 0,
          total_listings: 0,
          avg_days_on_market: 0,
          price_trend: 'stable',
          price_change_pct: 0,
        };
      }

      const prices = listings.map((l: any) => l.price).filter(Boolean);
      const average_price = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;

      const pricesPerSqm = listings
        .filter((l: any) => l.price && l.surface_total)
        .map((l: any) => l.price / l.surface_total);
      const price_per_sqm = pricesPerSqm.length > 0
        ? pricesPerSqm.reduce((a: number, b: number) => a + b, 0) / pricesPerSqm.length
        : 0;

      const now = new Date();
      const daysOnMarket = listings.map((l: any) => {
        const created = new Date(l.created_at);
        return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      });
      const avg_days_on_market = daysOnMarket.reduce((a: number, b: number) => a + b, 0) / daysOnMarket.length;

      const trend = await this.calculatePriceTrend(neighborhood, propertyType);

      return {
        average_price: Math.round(average_price),
        price_per_sqm: Math.round(price_per_sqm),
        total_listings: listings.length,
        avg_days_on_market: Math.round(avg_days_on_market),
        price_trend: trend.direction,
        price_change_pct: trend.changePct,
      };
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }

  async comparePropertyToMarket(propertyId: string): Promise<ComparisonData> {
    const { data: property, error } = await this.supabase
      .from('properties')
      .select('price, neighborhood, property_type')
      .eq('id', propertyId)
      .single();

    if (error || !property) {
      throw new Error('Property not found');
    }

    const marketData = await this.getMarketData(property.neighborhood, property.property_type);

    const difference_pct = marketData.average_price > 0
      ? ((property.price - marketData.average_price) / marketData.average_price) * 100
      : 0;

    let position: 'above' | 'below' | 'at_market';
    if (difference_pct > 5) {
      position = 'above';
    } else if (difference_pct < -5) {
      position = 'below';
    } else {
      position = 'at_market';
    }

    return {
      property_price: property.price,
      market_average: marketData.average_price,
      position,
      difference_pct: Math.round(difference_pct * 100) / 100,
    };
  }

  private async calculatePriceTrend(
    neighborhood: string,
    propertyType: string
  ): Promise<{ direction: 'up' | 'down' | 'stable'; changePct: number }> {
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const { data: currentMonth } = await this.supabase
      .from('properties')
      .select('price')
      .eq('neighborhood', neighborhood)
      .eq('property_type', propertyType)
      .gte('created_at', oneMonthAgo.toISOString());

    const { data: previousMonth } = await this.supabase
      .from('properties')
      .select('price')
      .eq('neighborhood', neighborhood)
      .eq('property_type', propertyType)
      .gte('created_at', twoMonthsAgo.toISOString())
      .lt('created_at', oneMonthAgo.toISOString());

    if (!currentMonth?.length || !previousMonth?.length) {
      return { direction: 'stable', changePct: 0 };
    }

    const currentAvg = currentMonth.reduce((a: number, b: any) => a + (b.price || 0), 0) / currentMonth.length;
    const previousAvg = previousMonth.reduce((a: number, b: any) => a + (b.price || 0), 0) / previousMonth.length;

    const changePct = previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;

    let direction: 'up' | 'down' | 'stable';
    if (changePct > 2) {
      direction = 'up';
    } else if (changePct < -2) {
      direction = 'down';
    } else {
      direction = 'stable';
    }

    return { direction, changePct: Math.round(changePct * 100) / 100 };
  }

  async getNeighborhoodSummary(neighborhood: string): Promise<{
    sale: MarketData;
    rent: MarketData;
  }> {
    const [sale, rent] = await Promise.all([
      this.getMarketData(neighborhood, 'sale'),
      this.getMarketData(neighborhood, 'rent'),
    ]);

    return { sale, rent };
  }
}
