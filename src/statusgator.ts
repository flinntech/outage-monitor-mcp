import fetch from 'node-fetch';

export interface Service {
  id: string;
  name: string;
  url: string;
  status: string;
  favicon?: string;
}

export interface Incident {
  id: string;
  service_id: string;
  service_name: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  url?: string;
}

export interface ServiceStatus {
  service_id: string;
  service_name: string;
  status: string;
  current_incidents: Incident[];
  last_checked: string;
}

export interface HistoricalQuery {
  service?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  limit?: number;
}

export interface UptimeStats {
  service_id: string;
  service_name: string;
  period_start: string;
  period_end: string;
  total_incidents: number;
  total_downtime_minutes: number;
  uptime_percentage: number;
  incidents: Incident[];
}

export class StatusGatorClient {
  private apiKey: string;
  private baseUrl: string = 'https://statusgator.com/api/v3';

  // Service name mappings to common StatusGator identifiers
  private serviceMap: { [key: string]: string } = {
    'att': 'att',
    'verizon': 'verizon',
    't-mobile': 't-mobile',
    'tmobile': 't-mobile',
    'aws': 'amazon-web-services',
    'amazon-web-services': 'amazon-web-services',
    'google-cloud': 'google-cloud',
    'gcp': 'google-cloud',
    'azure': 'microsoft-azure',
    'microsoft-azure': 'microsoft-azure',
  };

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('StatusGator API key is required');
    }
    this.apiKey = apiKey;
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`StatusGator API error: ${response.status} ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch from StatusGator: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get all services
   */
  async getServices(): Promise<Service[]> {
    const response = await this.makeRequest<{ data: Service[] }>('/services');
    return response.data;
  }

  /**
   * Search for a service by name
   */
  async searchService(serviceName: string): Promise<Service | null> {
    const normalizedName = serviceName.toLowerCase().trim();
    const mappedName = this.serviceMap[normalizedName] || normalizedName;

    const services = await this.getServices();

    // Try exact match first
    let service = services.find(s =>
      s.id === mappedName ||
      s.name.toLowerCase() === mappedName
    );

    // If no exact match, try partial match
    if (!service) {
      service = services.find(s =>
        s.name.toLowerCase().includes(mappedName) ||
        s.id.includes(mappedName)
      );
    }

    return service || null;
  }

  /**
   * Get service status by service ID or name
   */
  async getServiceStatus(serviceIdentifier: string): Promise<ServiceStatus | null> {
    try {
      // First, try to find the service
      let serviceId = serviceIdentifier;
      const service = await this.searchService(serviceIdentifier);

      if (service) {
        serviceId = service.id;
      }

      // Get service details and incidents
      const [serviceData, incidentsData] = await Promise.all([
        this.makeRequest<{ data: Service }>(`/services/${serviceId}`),
        this.getServiceIncidents(serviceId)
      ]);

      return {
        service_id: serviceData.data.id,
        service_name: serviceData.data.name,
        status: serviceData.data.status,
        current_incidents: incidentsData.filter(i => i.status !== 'resolved'),
        last_checked: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error getting service status: ${error}`);
      return null;
    }
  }

  /**
   * Get incidents for a specific service
   */
  async getServiceIncidents(serviceId: string): Promise<Incident[]> {
    try {
      const response = await this.makeRequest<{ data: Incident[] }>(
        `/services/${serviceId}/incidents`
      );
      return response.data;
    } catch (error) {
      console.error(`Error getting incidents: ${error}`);
      return [];
    }
  }

  /**
   * Get all current incidents across all monitored services
   */
  async getAllCurrentIncidents(): Promise<Incident[]> {
    const monitoredServices = [
      'att', 'verizon', 't-mobile', 'aws', 'google-cloud', 'azure'
    ];

    const allIncidents: Incident[] = [];

    for (const serviceName of monitoredServices) {
      const status = await this.getServiceStatus(serviceName);
      if (status && status.current_incidents.length > 0) {
        allIncidents.push(...status.current_incidents);
      }
    }

    return allIncidents;
  }

  /**
   * Check for outages on a specific service
   */
  async checkOutage(serviceName: string): Promise<{
    service: string;
    hasOutage: boolean;
    status: string;
    incidents: Incident[];
  }> {
    const status = await this.getServiceStatus(serviceName);

    if (!status) {
      return {
        service: serviceName,
        hasOutage: false,
        status: 'unknown',
        incidents: [],
      };
    }

    const hasOutage = status.status !== 'operational' && status.status !== 'up';

    return {
      service: status.service_name,
      hasOutage,
      status: status.status,
      incidents: status.current_incidents,
    };
  }

  /**
   * Get historical incidents for a service within a date range
   */
  async getHistoricalIncidents(
    serviceName: string,
    startDate?: string,
    endDate?: string,
    status?: string
  ): Promise<Incident[]> {
    try {
      const service = await this.searchService(serviceName);
      if (!service) {
        throw new Error(`Service '${serviceName}' not found`);
      }

      // Get all incidents for the service
      let incidents = await this.getServiceIncidents(service.id);

      // Filter by date range if provided
      if (startDate) {
        const start = new Date(startDate);
        incidents = incidents.filter(i => new Date(i.created_at) >= start);
      }

      if (endDate) {
        const end = new Date(endDate);
        incidents = incidents.filter(i => new Date(i.created_at) <= end);
      }

      // Filter by status if provided
      if (status) {
        incidents = incidents.filter(i => i.status.toLowerCase() === status.toLowerCase());
      }

      // Sort by date (newest first)
      incidents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return incidents;
    } catch (error) {
      console.error(`Error getting historical incidents: ${error}`);
      return [];
    }
  }

  /**
   * Get details of a specific incident
   */
  async getIncidentDetails(serviceId: string, incidentId: string): Promise<Incident | null> {
    try {
      const response = await this.makeRequest<{ data: Incident }>(
        `/services/${serviceId}/incidents/${incidentId}`
      );
      return response.data;
    } catch (error) {
      console.error(`Error getting incident details: ${error}`);
      return null;
    }
  }

  /**
   * Calculate uptime statistics for a service over a period
   */
  async getServiceUptime(
    serviceName: string,
    startDate: string,
    endDate: string
  ): Promise<UptimeStats | null> {
    try {
      const service = await this.searchService(serviceName);
      if (!service) {
        throw new Error(`Service '${serviceName}' not found`);
      }

      const incidents = await this.getHistoricalIncidents(serviceName, startDate, endDate);

      // Calculate total downtime
      let totalDowntimeMinutes = 0;
      incidents.forEach(incident => {
        if (incident.resolved_at) {
          const start = new Date(incident.created_at);
          const end = new Date(incident.resolved_at);
          const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
          totalDowntimeMinutes += durationMinutes;
        }
      });

      // Calculate period duration in minutes
      const periodStart = new Date(startDate);
      const periodEnd = new Date(endDate);
      const periodMinutes = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60);

      // Calculate uptime percentage
      const uptimePercentage = periodMinutes > 0
        ? ((periodMinutes - totalDowntimeMinutes) / periodMinutes) * 100
        : 100;

      return {
        service_id: service.id,
        service_name: service.name,
        period_start: startDate,
        period_end: endDate,
        total_incidents: incidents.length,
        total_downtime_minutes: Math.round(totalDowntimeMinutes),
        uptime_percentage: Math.round(uptimePercentage * 100) / 100,
        incidents: incidents,
      };
    } catch (error) {
      console.error(`Error calculating uptime: ${error}`);
      return null;
    }
  }

  /**
   * Get incident history for multiple services
   */
  async getMultiServiceHistory(
    services: string[],
    startDate?: string,
    endDate?: string
  ): Promise<{ [serviceName: string]: Incident[] }> {
    const results: { [serviceName: string]: Incident[] } = {};

    for (const serviceName of services) {
      const incidents = await this.getHistoricalIncidents(serviceName, startDate, endDate);
      results[serviceName] = incidents;
    }

    return results;
  }
}
