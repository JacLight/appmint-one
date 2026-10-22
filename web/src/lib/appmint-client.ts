// @ts-nocheck — vendored AppEngine connector (ported from base-app, kept as-is)
import { appmintConfig } from './appmint-config';
import axios from 'axios';
import { appmintEndpoints } from './appmint-endpoints';
import { deepCopy } from '@/lib-client/helpers';
import { getProxiedUrl } from './proxy-utils';
import { activeSession } from './active-session';
import { getRequestInfo } from './activity-tracker';

export class AppEngineClient {
  private renewTries = 0;
  private token: string | null = null;

  constructor(private appConfig: any) {}

  async getAppToken() {
    try {
      const path = getProxiedUrl(appmintEndpoints.appkey.path, this.appConfig.appengine.host);
      let data = {
        appId: this.appConfig.appengine.appId,
        secret: this.appConfig.appengine.secret,
        key: this.appConfig.appengine.key,
      };
      this.renewTries = this.renewTries + 1;
      const rt = await axios.post(path, data, this.getBaseHeader());
      if (rt?.data?.token) {
        return rt.data.token;
      } else {
        console.error('invalid  App Key | App Secret || App Id');
        return null;
      }
    } catch (error: any) {
      console.error('Failed to connect to API server:', error.message);
      // Return null to indicate failure, let the calling code handle it
      return null;
    }
  }

  getBaseHeader(): { headers: any } {
    return {
      headers: {
        'Content-Type': 'application/json',
        orgid: this.appConfig.orgId,
        domainAsOrg: this.appConfig.domainAsOrg,
        'shared-org-id': this.appConfig.orgId,
      },
    };
  }

  async getHeaderWithToken() {
    if (!this.token) {
      this.token = await this.getAppToken();
    }
    const init = this.getBaseHeader();
    init.headers['Authorization'] = `Bearer ${this.token}`;
    return deepCopy(init);
  }

  async processRequest(
    method: string,
    clientPath: string,
    clientData?: any,
    clientAuthorization?: string | null,
    clientQuery?: any,
    clientInfo?: any,
    isMultiPath?: boolean,
  ): Promise<any> {
    if (typeof window !== 'undefined') {
      return await this.processRequestClient(method, clientPath, clientData, clientInfo);
    } else {
      return await this.processRequestServer(method, clientPath, clientData, clientAuthorization, clientQuery, clientInfo, isMultiPath);
    }
  }

  getBrowserClientInfo(clientInfo?: any): any {
    if (typeof window === 'undefined') return clientInfo || {};
    const info = { ...(clientInfo || {}) };
    if (!info.host) info.host = window.location.host;
    if (!info.protocol) info.protocol = window.location.protocol.replace(':', '');
    if (!info.timezone) info.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!info.orgId) info.orgId = this.appConfig.orgId;
    if (!info.userAgent && typeof navigator !== 'undefined') info.userAgent = navigator.userAgent;
    if (!info.url) info.url = window.location.href;
    return info;
  }

  applyClientInfoHeaders(headers: any, clientInfo: any) {
    if (!clientInfo) return;
    headers['x-client-info'] = JSON.stringify(clientInfo);
    if (clientInfo.host) headers['x-client-host'] = clientInfo.host;
    if (clientInfo.protocol) headers['x-client-protocol'] = clientInfo.protocol;
    if (clientInfo.timezone) headers['x-client-timezone'] = clientInfo.timezone;
    if (clientInfo.orgId) headers['x-client-orgid'] = clientInfo.orgId;
  }

  // Server-side fallback: when a caller (e.g. SSR helper like findData/search)
  // doesn't pass clientInfo, pull it from the active Next.js request via
  // next/headers. next/headers is request-scoped by Next.js, so this is safe
  // inside route handlers, server components, and server actions. Returns null
  // if not in a request scope (e.g. background job, build-time).
  async getServerClientInfo(): Promise<any | null> {
    if (typeof window !== 'undefined') return null;
    try {
      const { headers } = await import('next/headers');
      const h: any = await headers();
      const info: any = (await getRequestInfo(h)) || {};
      const origin = h.get('origin');
      const referer = h.get('referer');
      if (origin) {
        try {
          info.host = new URL(origin).host;
        } catch {}
      } else if (referer && !info.host) {
        try {
          info.host = new URL(referer).host;
        } catch {}
      }
      if (!info.timezone) info.timezone = h.get('x-client-timezone') || undefined;
      if (!info.orgId) info.orgId = this.appConfig.orgId;
      return info;
    } catch {
      // Outside a request scope — nothing we can do.
      return null;
    }
  }

  private async executeClientRequest(method: string, path: string, data: any, header: { headers: any }) {
    if (method === 'post') return axios.post(path, data, header);
    if (method === 'put') return axios.put(path, data, header);
    if (method === 'get') return axios.get(path, header);
    if (method === 'delete') return axios.delete(path, data ? { ...header, data } : header);
    return null;
  }

  private async refreshClientToken(): Promise<boolean> {
    try {
      const refreshToken = activeSession.getRefreshToken();
      if (!refreshToken || refreshToken === 'Bearer ') return false;
      const path = getProxiedUrl(appmintEndpoints.refresh_token.path, '');
      const rt = await axios.post(path, {}, { headers: { 'Content-Type': 'application/json', authorization: refreshToken } });
      const newToken = rt?.data?.token;
      if (!newToken) return false;
      activeSession.setActiveSession(newToken, rt?.data?.user || activeSession.getUser(), rt?.data?.refreshToken || '');
      return true;
    } catch {
      return false;
    }
  }

  async processRequestClient(method: string, clientPath: string, clientData?: any, clientInfo?: any): Promise<any> {
    const path = getProxiedUrl(clientPath, '');

    const data = clientData || {};

    const info = this.getBrowserClientInfo(clientInfo);
    const header: { headers: any } = {
      headers: {
        'Content-Type': 'application/json',
        authorization: activeSession.getToken(),
      },
    };
    this.applyClientInfoHeaders(header.headers, info);
    try {
      const rt = await this.executeClientRequest(method, path, data, header);
      this.renewTries = 0;
      return this.processResponse(rt);
    } catch (err) {
      const error = err as any;
      if (error?.response?.status === 401 && this.renewTries < 1) {
        this.renewTries++;
        const refreshed = await this.refreshClientToken();
        if (refreshed) {
          header.headers.authorization = activeSession.getToken();
          try {
            const rt = await this.executeClientRequest(method, path, data, header);
            this.renewTries = 0;
            return this.processResponse(rt);
          } catch (retryErr) {
            throw retryErr;
          }
        }
      }
      throw error;
    }
  }

  async processRequestServer(
    method: string,
    clientPath: string,
    clientData?: any,
    clientAuthorization?: string | null,
    clientQuery?: any,
    clientInfo?: any,
    isMultiPath?: boolean,
  ): Promise<any> {
    const path = getProxiedUrl(clientPath, this.appConfig.appengine.host);

    const header: any = await this.getHeaderWithToken();

    // If no clientInfo was passed explicitly, try to recover it from the
    // current Next.js request scope. This covers helpers like findData(),
    // search(), getById() that are called during SSR without threading
    // clientInfo through.
    if (!clientInfo) {
      clientInfo = await this.getServerClientInfo();
    }

    // Set x-client-authorization from parameter or clientInfo
    const authToken = clientAuthorization || clientInfo?.authorization;
    if (authToken) {
      header.headers['x-client-authorization'] = authToken;
    }

    this.applyClientInfoHeaders(header.headers, clientInfo);

    if (isMultiPath) {
      header.headers['Content-Type'] = 'multipart/form-data';
    }

    const data = clientData;
    // Query metadata is an internal transport field. Only attach it to a
    // plain JSON object when there is actually a query; mutating a scalar or
    // adding clientQuery to a domain payload makes strict API bodies reject it.
    if (data && typeof data === 'object' && !Array.isArray(data) && !(typeof FormData !== 'undefined' && data instanceof FormData) && clientQuery && Object.keys(clientQuery).length) {
      data.clientQuery = clientQuery;
    }
    method = method.toLowerCase();
    let rt;
    try {
      if (method === 'post') {
        rt = await axios.post(path, data, header);
      } else if (method === 'put') {
        rt = await axios.put(path, data, header);
      } else if (method === 'get') {
        rt = await axios.get(path, header);
      } else if (method === 'patch') {
        rt = await axios.patch(path, data, header);
      } else if (method === 'delete') {
        rt = await axios.delete(path, data ? { ...header, data } : header);
      }
      this.renewTries = 0;
      return this.processResponse(rt);
    } catch (err) {
      const error = err as any;
      console.error('request error -> ', clientPath.split('token=')[0], error.message);
      if (this.renewTries < 2 && error?.response?.status === 401 && error?.response?.statusText === 'Unauthorized') {
        console.log('Appengine Token Expired,.... renewing token');
        this.token = null;
        await this.getHeaderWithToken();
        console.log('auth ok');
        return await this.processRequestServer(method, clientPath, clientData, clientAuthorization, clientQuery, clientInfo, isMultiPath);
      } else {
        throw error;
      }
    }
  }

  async getSite(hostName: string) {
    const sharedHost = this.appConfig.domainAsOrg ? this.appConfig.orgId : '';
    let sitePath = `${appmintEndpoints.get_site.path}/${this.appConfig.siteName}/${hostName}${sharedHost ? '?shared-host=' + sharedHost : ''}`;
    return await this.processRequestServer('get', sitePath);
  }

  async getPage(hostName: string, siteName: string, paths: string, query?: string, clientInfo?: any) {
    const sharedHost = this.appConfig.domainAsOrg ? this.appConfig.orgId : '';
    let pagePath = `${appmintEndpoints.get_page.path}/${hostName}/${siteName}${paths ? '/' + paths : ''}`;
    if (query) {
      pagePath = `${pagePath}?${query}&en=true${sharedHost ? '&shared-host=' + sharedHost : ''}`;
    } else {
      pagePath = `${pagePath}?en=true${sharedHost ? '&shared-host=' + sharedHost : ''}`;
    }

    if (clientInfo) {
      clientInfo['host'] = hostName;
    } else {
      clientInfo = { host: hostName };
    }
    return await this.processRequestServer('get', pagePath, null, null, null, clientInfo);
  }

  async findDataByAttribute(datatype, attrName: any, attrValue, options: any): Promise<any> {
    let url = `${appmintEndpoints.find_by_attribute.path}/${datatype}${attrName && attrValue ? `/${attrName}/${attrValue}` : ''}`;
    return await this.processRequest('get', url, { options });
  }
  async findData(datatype, query: any, options?: any): Promise<any> {
    let url = `${appmintEndpoints.find.path}/${datatype}`;
    return await this.processRequest('post', url, { query, options });
  }

  async search(datatype, keyword, query, options) {
    let url = `${appmintEndpoints.search.path}/${datatype}`;
    return await this.processRequest('post', url, { query, options });
  }

  async getById(datatype: string, id: string) {
    return await this.processRequest('get', `${appmintEndpoints.get.path}/${datatype}/${id}`);
  }

  async saveData(data: any): Promise<any> {
    let sitePath = `${data?.sk ? appmintEndpoints.update.path : appmintEndpoints.create.path}/${this.appConfig.siteName}`;
    return await this.processRequest('post', sitePath);
  }

  async logData(data: any) {
    const sitePath = `${appmintEndpoints.batch_log_data}`;
    const rt: any = await this.processRequestServer('post', sitePath, data, null, null);
    if (rt && Array.isArray(rt.data) && rt.data.length > 0) {
      const [site] = rt.data;
      return site;
    }
    return null;
  }

  async upload(path: string, location: string, file: any, clientInfo?: any): Promise<any> {
    console.debug('request -> updateData', path);
    const formData = new FormData();
    formData.append('location', location);
    formData.append('files', file);

    // Get the proxied URL if needed
    const proxyPath = getProxiedUrl(path, this.appConfig.appengine.host);

    const baseHeaders = (await this.getHeaderWithToken()) as { headers: any };
    const info = typeof window !== 'undefined' ? this.getBrowserClientInfo(clientInfo) : clientInfo;
    this.applyClientInfoHeaders(baseHeaders.headers, info);

    // let rt = await axios.post(path, formData, getHeaderToken());
    try {
      let rt = await fetch(proxyPath, {
        method: 'POST',
        headers: new Headers({
          ...(baseHeaders.headers as Record<string, any>),
        }),
        body: formData,
      });

      if (rt.ok) {
        return rt.json();
      } else {
        throw new Error(rt.statusText);
      }
    } catch (err) {
      const error = err as any;
      if (this.renewTries < 2 && error.statusCode === '401' && error.message === 'jwt expired') {
        console.log('Appengine Token Expired,.... renewing token');
        this.token = null;
        return await this.upload(path, location, file);
      } else {
        console.error(error.message);
        return error;
      }
    }
  }

  processResponse(response: any) {
    if (response && (response.status === 200 || response.status === 201 || response.status === 202 || response.statusText)) {
      console.log('response success -> ', response.status, response.statusText);
      return Array.isArray(response) ? response : response.data;
    }
    return response;
  }
}

let appEngineClient: AppEngineClient;
export const getAppEngineClient = (): AppEngineClient => {
  if (!appEngineClient) {
    appEngineClient = new AppEngineClient(appmintConfig);
  }
  return appEngineClient;
};
