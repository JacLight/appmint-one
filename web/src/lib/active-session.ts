// @ts-nocheck — vendored AppEngine connector (ported from base-app, kept as-is)
import { localStorageUtils } from '@/lib-client/localstorage';
import { appmintConfig } from './appmint-config';

export namespace activeSession {
  let token: string;
  let user: any;
  let refreshToken: string;

  const setCookie = (name: string, value: any, days = 7) => {
    if (typeof document === 'undefined') return;
    if (!value) return;
    // Only stringify objects, not strings (tokens are already strings)
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(stringValue)}; expires=${expires}; path=/`;
  };

  const getCookie = (name: string) => {
    if (typeof document === 'undefined') return '';
    const value = document?.cookie?.split('; ').reduce((r, v) => {
      const idx = v.indexOf('=');
      if (idx === -1) return r;
      const key = v.substring(0, idx);
      const val = v.substring(idx + 1);
      return key === name ? decodeURIComponent(val) : r;
    }, '');

    // Try to parse JSON if it's a JSON string (for objects), otherwise return as-is
    if (value && (value.startsWith('{') || value.startsWith('['))) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  };

  const clearCookie = (name: string) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  };

  export const setActiveSession = (_token: string, _user: any, _refreshToken: string) => {
    token = _token;
    user = _user;
    refreshToken = _refreshToken;

    // Save to cookies (setCookie will handle stringifying objects)
    setCookie('token', _token);
    setCookie('user', _user); // Don't stringify here, setCookie will do it
    setCookie('refreshToken', _refreshToken);
  };

  export const clearSession = () => {
    token = '';
    user = null;
    refreshToken = '';

    // Clear cookies
    clearCookie('token');
    clearCookie('user');
    clearCookie('refreshToken');
  };

  export const getUser = () => {
    if (!user) {
      // getCookie will automatically parse JSON if it's an object
      user = getCookie('user');
      if (!user) {
        clearCookie('user');
      }
    }
    return user;
  };

  export const getToken = (): string => {
    if (!token) {
      token = getCookie('token');
    }
    return token ? 'Bearer ' + token : '';
  };

  export const getRefreshToken = (): string => {
    if (!refreshToken) {
      refreshToken = getCookie('refreshToken');
    }
    return 'Bearer ' + refreshToken;
  };

  export const getOrgId = () => {
    if (appmintConfig.orgId) {
      return appmintConfig.orgId;
    }
    const session = localStorageUtils.get('session');
    if (session.orgId) {
      appmintConfig.orgId = session.orgId;
    }
    return appmintConfig.orgId;
  };
}
