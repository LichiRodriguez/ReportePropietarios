import { BetaAnalyticsDataClient } from '@google-analytics/data';
import * as path from 'path';

interface GAMetrics {
  pageviews: number;
  unique_visitors: number;
  avg_session_duration: number;
  bounce_rate: number;
  sessions: number;
}

interface GAPropertyPage {
  page_path: string;
  pageviews: number;
  unique_visitors: number;
  avg_time_on_page: number;
}

export class GoogleAnalyticsService {
  private client: BetaAnalyticsDataClient | null = null;
  private propertyId: string;

  constructor() {
    this.propertyId = process.env.GA_PROPERTY_ID || '';

    const credentialsPath = process.env.GOOGLE_ANALYTICS_CREDENTIALS_PATH;
    if (credentialsPath && this.propertyId) {
      try {
        this.client = new BetaAnalyticsDataClient({
          keyFilename: path.resolve(credentialsPath),
        });
      } catch (error) {
        console.warn('Failed to initialize Google Analytics client:', error);
      }
    }
  }

  isConfigured(): boolean {
    return this.client !== null && this.propertyId.length > 0;
  }

  async getWebsiteMetrics(startDate: Date, endDate: Date): Promise<GAMetrics> {
    if (!this.isConfigured()) {
      return this.getEmptyMetrics();
    }

    try {
      const [response] = await this.client!.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate: this.formatDate(startDate),
            endDate: this.formatDate(endDate),
          },
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'totalUsers' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'sessions' },
        ],
      });

      if (!response.rows || response.rows.length === 0) {
        return this.getEmptyMetrics();
      }

      const row = response.rows[0];
      const values = row.metricValues || [];

      return {
        pageviews: parseInt(values[0]?.value || '0'),
        unique_visitors: parseInt(values[1]?.value || '0'),
        avg_session_duration: parseFloat(values[2]?.value || '0'),
        bounce_rate: parseFloat(values[3]?.value || '0'),
        sessions: parseInt(values[4]?.value || '0'),
      };
    } catch (error) {
      console.error('Error fetching Google Analytics metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  async getPropertyPageMetrics(
    propertySlug: string,
    startDate: Date,
    endDate: Date
  ): Promise<GAPropertyPage | null> {
    if (!this.isConfigured()) return null;

    try {
      const [response] = await this.client!.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate: this.formatDate(startDate),
            endDate: this.formatDate(endDate),
          },
        ],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'totalUsers' },
          { name: 'averageSessionDuration' },
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: {
              matchType: 'CONTAINS',
              value: propertySlug,
            },
          },
        },
      });

      if (!response.rows || response.rows.length === 0) {
        return null;
      }

      const row = response.rows[0];
      const dimensions = row.dimensionValues || [];
      const values = row.metricValues || [];

      return {
        page_path: dimensions[0]?.value || '',
        pageviews: parseInt(values[0]?.value || '0'),
        unique_visitors: parseInt(values[1]?.value || '0'),
        avg_time_on_page: parseFloat(values[2]?.value || '0'),
      };
    } catch (error) {
      console.error('Error fetching property page metrics:', error);
      return null;
    }
  }

  async getTopPages(
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<GAPropertyPage[]> {
    if (!this.isConfigured()) return [];

    try {
      const [response] = await this.client!.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate: this.formatDate(startDate),
            endDate: this.formatDate(endDate),
          },
        ],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'totalUsers' },
          { name: 'averageSessionDuration' },
        ],
        orderBys: [
          {
            metric: { metricName: 'screenPageViews' },
            desc: true,
          },
        ],
        limit,
      });

      if (!response.rows) return [];

      return response.rows.map((row) => {
        const dimensions = row.dimensionValues || [];
        const values = row.metricValues || [];
        return {
          page_path: dimensions[0]?.value || '',
          pageviews: parseInt(values[0]?.value || '0'),
          unique_visitors: parseInt(values[1]?.value || '0'),
          avg_time_on_page: parseFloat(values[2]?.value || '0'),
        };
      });
    } catch (error) {
      console.error('Error fetching top pages:', error);
      return [];
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getEmptyMetrics(): GAMetrics {
    return {
      pageviews: 0,
      unique_visitors: 0,
      avg_session_duration: 0,
      bounce_rate: 0,
      sessions: 0,
    };
  }
}
