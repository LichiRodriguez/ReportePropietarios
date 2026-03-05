interface TokkoProperty {
  id: number;
  reference_code: string;
  address: string;
  real_address: string;
  publication_title: string;
  status: number;
  price: number;
  currency: string;
  photos: TokkoPhoto[];
  videos: any[];
  operations: TokkoOperation[];
  type: { id: number; name: string; code: string };
  location: { full_location: string; name: string; short_location: string };
  room_amount: number;
  suite_amount: number;
  bathroom_amount: number;
  parking_lot_amount: number;
  age: number;
  total_surface: string;
  roofed_surface: string;
  front_measure: string;
  depth_measure: string;
  producer: { name: string; email: string; phone: string; picture: string };
  branch: { name: string; address: string; phone: string; email: string; logo: string };
  public_url: string;
  created_at: string;
}

interface TokkoPhoto {
  image: string;
  thumb: string;
  is_front_cover: boolean;
  original: string;
}

interface TokkoOperation {
  operation_type: string;
  prices: { price: number; currency: string }[];
}

export interface TokkoChartStats {
  totals: {
    leads: [number, string];
    mails: [number, string];
    whatsapps: [number, string];
    events: [number, string];
    all: [number, string];
  };
  data: any[][];
  pie_charts: { data: string; name: string }[];
}

export interface TokkoPortalStats {
  portal_name: string;
  portal_id: string;
  publication_id: number;
  publication_url: string;
  exposure: {
    total: number;
    segment: number;
    score: string;
  };
  views: {
    total: number;
    segment: number;
    score: string;
  };
  interested: {
    total: number;
    segment: number;
    form_contacts: number;
    seen_phone_contacts: number;
    whatsapp_contacts: number;
  };
  performance: string;
}

export interface TokkoPropertyStats {
  emails_enviados: number;
  whatsapp_enviados: number;
  contactos_interesados: number;
  eventos_realizados: number;
  desglose_mensual: {
    year: string;
    month: string;
    destacada: number;
    emails: number;
    whatsapp: number;
    eventos: number;
  }[];
  fuentes_contacto: { etiqueta: string; total: number }[];
}

export class TokkobrokerService {
  private apiKey: string;
  private baseUrl: string;
  private username: string;
  private password: string;
  private sessionCookie: string | null = null;
  private sessionExpiry: number = 0;

  constructor(config?: {
    apiKey?: string;
    username?: string;
    password?: string;
  }) {
    this.apiKey = config?.apiKey || process.env.TOKKO_API_KEY || '';
    this.username = config?.username || process.env.TOKKO_USERNAME || '';
    this.password = config?.password || process.env.TOKKO_PASSWORD || '';
    this.baseUrl = 'https://www.tokkobroker.com';
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  isSessionConfigured(): boolean {
    return this.username.length > 0 && this.password.length > 0;
  }

  // --- Login programático al dashboard de Tokko ---

  private async login(): Promise<string> {
    if (this.sessionCookie && Date.now() < this.sessionExpiry) {
      return this.sessionCookie;
    }

    if (!this.isSessionConfigured()) {
      throw new Error('Tokko credentials not configured (TOKKO_USERNAME / TOKKO_PASSWORD)');
    }

    try {
      // Paso 1: GET login page para obtener csrftoken y sessionid
      const loginPageRes = await fetch(`${this.baseUrl}/not_connected/`, {
        redirect: 'manual',
      });

      const setCookies = loginPageRes.headers.getSetCookie?.() || [];
      let csrfToken = '';
      let sessionId = '';
      const cookies: string[] = [];

      for (const cookie of setCookies) {
        const [nameValue] = cookie.split(';');
        cookies.push(nameValue);
        if (nameValue.startsWith('csrftoken=')) {
          csrfToken = nameValue.split('=')[1];
        }
        if (nameValue.startsWith('sessionid=')) {
          sessionId = nameValue.split('=')[1];
        }
      }

      if (!csrfToken) {
        // Fallback: parse from headers raw
        const rawHeaders = loginPageRes.headers;
        const allSetCookie = rawHeaders.get('set-cookie') || '';
        const csrfMatch = allSetCookie.match(/csrftoken=([^;]+)/);
        if (csrfMatch) csrfToken = csrfMatch[1];
        const sessionMatch = allSetCookie.match(/sessionid=([^;]+)/);
        if (sessionMatch) sessionId = sessionMatch[1];
      }

      if (!csrfToken) {
        throw new Error('Could not obtain CSRF token from Tokko login page');
      }

      // Paso 2: POST login con credenciales
      const loginBody = new URLSearchParams({
        csrfmiddlewaretoken: csrfToken,
        username: this.username,
        password: this.password,
      });

      const cookieHeader = cookies.length > 0
        ? cookies.join('; ')
        : `csrftoken=${csrfToken}; sessionid=${sessionId}`;

      const loginRes = await fetch(`${this.baseUrl}/login/?next=/home`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieHeader,
          'Referer': `${this.baseUrl}/not_connected/`,
        },
        body: loginBody.toString(),
        redirect: 'manual',
      });

      // Tokko redirige a /home si el login es exitoso (302)
      if (loginRes.status !== 302) {
        throw new Error(`Tokko login failed with status ${loginRes.status}`);
      }

      // Extraer la nueva cookie de sesión autenticada
      const loginSetCookies = loginRes.headers.getSetCookie?.() || [];
      let authSessionId = '';

      for (const cookie of loginSetCookies) {
        if (cookie.startsWith('sessionid=')) {
          authSessionId = cookie.split(';')[0].split('=')[1];
        }
      }

      if (!authSessionId) {
        // Fallback
        const rawCookie = loginRes.headers.get('set-cookie') || '';
        const match = rawCookie.match(/sessionid=([^;]+)/);
        if (match) authSessionId = match[1];
      }

      if (!authSessionId) {
        throw new Error('Could not obtain authenticated session from Tokko');
      }

      // Guardar la nueva cookie de CSRF si se envió
      let newCsrf = csrfToken;
      for (const cookie of loginSetCookies) {
        if (cookie.startsWith('csrftoken=')) {
          newCsrf = cookie.split(';')[0].split('=')[1];
        }
      }

      this.sessionCookie = `sessionid=${authSessionId}; csrftoken=${newCsrf}`;
      // Sesión válida por 12 horas (conservador)
      this.sessionExpiry = Date.now() + 12 * 60 * 60 * 1000;

      console.log('Tokko dashboard login successful');
      return this.sessionCookie;
    } catch (error) {
      console.error('Error logging into Tokko dashboard:', error);
      this.sessionCookie = null;
      this.sessionExpiry = 0;
      throw error;
    }
  }

  private async fetchDashboard(path: string): Promise<Response> {
    const cookie = await this.login();
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        'Cookie': cookie,
        'Referer': `${this.baseUrl}/home`,
      },
      redirect: 'manual',
    });

    // Si redirige a login, la sesión expiró - reintentar
    if (response.status === 302) {
      const location = response.headers.get('location') || '';
      if (location.includes('not_connected') || location.includes('login')) {
        this.sessionCookie = null;
        this.sessionExpiry = 0;
        const newCookie = await this.login();
        return fetch(`${this.baseUrl}${path}`, {
          headers: {
            'Cookie': newCookie,
            'Referer': `${this.baseUrl}/home`,
          },
        });
      }
    }

    return response;
  }

  // --- Estadísticas del dashboard (datos reales) ---

  async getPropertyStats(tokkoPropertyId: number): Promise<TokkoPropertyStats | null> {
    try {
      const response = await this.fetchDashboard(`/property/${tokkoPropertyId}/charts_stats`);

      if (!response.ok) {
        console.warn(`Stats not available for Tokko property ${tokkoPropertyId}: ${response.status}`);
        return null;
      }

      const data: TokkoChartStats = await response.json();
      return this.parseChartStats(data);
    } catch (error) {
      console.error(`Error fetching stats for Tokko property ${tokkoPropertyId}:`, error);
      return null;
    }
  }

  private parseChartStats(data: TokkoChartStats): TokkoPropertyStats {
    // Parsear totales
    const stats: TokkoPropertyStats = {
      emails_enviados: data.totals?.mails?.[0] || 0,
      whatsapp_enviados: data.totals?.whatsapps?.[0] || 0,
      contactos_interesados: data.totals?.leads?.[0] || 0,
      eventos_realizados: data.totals?.events?.[0] || 0,
      desglose_mensual: [],
      fuentes_contacto: [],
    };

    // Parsear desglose mensual (skip header row)
    if (data.data && data.data.length > 1) {
      for (let i = 1; i < data.data.length; i++) {
        const row = data.data[i];
        if (Array.isArray(row) && row.length >= 5) {
          const [yearMonth, destacada, emails, whatsapp, eventos] = row;
          stats.desglose_mensual.push({
            year: Array.isArray(yearMonth) ? yearMonth[0] : String(yearMonth),
            month: Array.isArray(yearMonth) ? yearMonth[1] : '1',
            destacada: Number(destacada) || 0,
            emails: Number(emails) || 0,
            whatsapp: Number(whatsapp) || 0,
            eventos: Number(eventos) || 0,
          });
        }
      }
    }

    // Parsear fuentes de contacto (pie charts)
    if (data.pie_charts && data.pie_charts.length > 0) {
      try {
        const pieData = JSON.parse(data.pie_charts[0].data);
        // Skip header row [["Etiqueta", "Total"], ...]
        for (let i = 1; i < pieData.length; i++) {
          stats.fuentes_contacto.push({
            etiqueta: pieData[i][0],
            total: pieData[i][1],
          });
        }
      } catch {
        // Ignore parse errors
      }
    }

    return stats;
  }

  // --- Estadísticas de portales (ZonaProp, etc.) ---

  // Mapa de portal_id a nombre legible
  private static PORTAL_NAMES: Record<string, string> = {
    '4': 'ZonaProp',
    '2': 'Red Navent',
  };

  async getPortalStats(tokkoPropertyId: number): Promise<TokkoPortalStats[]> {
    if (!this.isSessionConfigured()) return [];

    try {
      // 1. Obtener publicaciones de la propiedad en ZonaProp (portal_id=4)
      const pubResponse = await this.fetchDashboard(
        `/portals/api/v1/publication/?property_id=${tokkoPropertyId}&portal_id=4&limit=100`
      );

      if (!pubResponse.ok) {
        console.warn(`Could not fetch publications for property ${tokkoPropertyId}`);
        return [];
      }

      const pubData = await pubResponse.json();
      const publications = pubData.objects || [];
      const results: TokkoPortalStats[] = [];

      // 2. Para cada publicación con stats, obtener stats_detail
      for (const pub of publications) {
        if (!pub.has_stats) continue;

        try {
          const statsResponse = await this.fetchDashboard(
            `/portals/${pub.portal_id}/publication/${pub.id}/stats_detail/`
          );

          if (!statsResponse.ok) continue;

          const statsData = await statsResponse.json();
          const stats = statsData.stats;

          if (!stats) continue;

          results.push({
            portal_name: TokkobrokerService.PORTAL_NAMES[pub.portal_id] || `Portal ${pub.portal_id}`,
            portal_id: pub.portal_id,
            publication_id: pub.id,
            publication_url: Array.isArray(pub.url) ? pub.url[0] || '' : pub.url || '',
            exposure: {
              total: stats.exposure?.total || 0,
              segment: stats.exposure?.segment || 0,
              score: stats.exposure?.view_score || '',
            },
            views: {
              total: stats.views?.total || 0,
              segment: stats.views?.segment || 0,
              score: stats.views?.interested_score || '',
            },
            interested: {
              total: stats.interested?.total || 0,
              segment: stats.interested?.segment || 0,
              form_contacts: stats.interested?.form_contacts || 0,
              seen_phone_contacts: stats.interested?.seen_phone_contacts || 0,
              whatsapp_contacts: stats.interested?.whatsapp_contacts || 0,
            },
            performance: stats.performance || '',
          });
        } catch (err) {
          console.error(`Error fetching stats_detail for publication ${pub.id}:`, err);
        }
      }

      return results;
    } catch (error) {
      console.error(`Error fetching portal stats for property ${tokkoPropertyId}:`, error);
      return [];
    }
  }

  // --- API pública de Tokko (datos de propiedades) ---

  async getProperty(propertyId: string): Promise<TokkoProperty | null> {
    if (!this.isConfigured()) {
      console.warn('Tokko API key not configured');
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/property/${propertyId}/?key=${this.apiKey}&format=json`
      );

      if (!response.ok) {
        console.error(`Tokko API error: ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching property from Tokko:', error);
      return null;
    }
  }

  async getProperties(filters: {
    status?: number;
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
        `${this.baseUrl}/api/v1/property/?${params.toString()}`
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.objects || [];
    } catch (error) {
      console.error('Error fetching properties from Tokko:', error);
      return [];
    }
  }

  async syncProperties(supabase: any): Promise<{ synced: number; errors: number }> {
    if (!this.isConfigured()) {
      return { synced: 0, errors: 0 };
    }

    const result = { synced: 0, errors: 0 };

    try {
      const properties = await this.getProperties({ limit: 200 });

      for (const tkkProp of properties) {
        try {
          const { error } = await supabase
            .from('properties')
            .upsert({
              tokko_id: String(tkkProp.id),
              address: tkkProp.real_address || tkkProp.address,
              price: tkkProp.operations?.[0]?.prices?.[0]?.price || 0,
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
