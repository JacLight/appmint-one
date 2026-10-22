'use client';

// from base-app/src/services/returns-service.ts — ported verbatim; only import paths rewired.
import { getAppEngineClient } from '@/modules/store/lib/appmint-client';

/**
 * The signed-in customer's returns (F-SF-RET-014), through the site's API proxy.
 * The returns API checks that each order and RMA belongs to the signed-in customer.
 */
class ReturnsService {
  private client = getAppEngineClient();

  async myReturns(): Promise<any[]> {
    const result = await this.client.processRequest('get', 'storefront/returns/my-returns');
    return Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
  }

  async requestReturn(body: any): Promise<any> {
    return this.client.processRequest('post', 'storefront/returns/request', body);
  }

  async markShipped(rmaNumber: string, carrier: string, trackingNumber: string): Promise<any> {
    return this.client.processRequest('put', `storefront/returns/rma/${encodeURIComponent(rmaNumber)}/ship`, { carrier, trackingNumber });
  }

  async cancel(rmaNumber: string, reason: string): Promise<any> {
    return this.client.processRequest('put', `storefront/returns/rma/${encodeURIComponent(rmaNumber)}/cancel`, { reason });
  }
}

export const returnsService = new ReturnsService();
