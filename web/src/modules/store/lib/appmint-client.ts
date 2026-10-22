// Replaces base-app/src/lib/appmint-client.ts for the ported storefront: the same
// `getAppEngineClient().processRequest(method, path, body)` call, answered by a server
// action that maps the path to its function in @/api/store (actions/engine.ts).
// Errors are re-thrown axios-shaped ({ response: { status, data } }) so base-app's
// getResponseErrorMessage reads them as before.
import { storeRoute } from '@/modules/store/actions/engine';

class StoreEngineClient {
  async processRequest(method: string, clientPath: string, clientData?: any, ..._rest: any[]): Promise<any> {
    const r = await storeRoute(method, clientPath, clientData ?? null);
    if (r.ok) return r.data;
    const err: any = new Error(r.message);
    err.response = { status: r.status, data: r.body };
    throw err;
  }
}

let client: StoreEngineClient | null = null;
export const getAppEngineClient = () => (client ??= new StoreEngineClient());
