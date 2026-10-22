// Replaces base-app/src/lib/active-session.ts. Here the customer JWT lives in an httpOnly
// cookie the browser cannot read, so the page hands the signed-in customer to the
// storefront through <StoreSession> (components/store-session.tsx). getToken() only says
// whether someone is signed in; the token itself never reaches the browser.
let user: any = null;

export namespace activeSession {
  export const setSessionUser = (u: any) => { user = u || null; };
  export const getUser = () => user;
  export const getToken = (): string => (user ? 'session' : '');
  export const getRefreshToken = () => '';
  export const setActiveSession = (_t?: string, u?: any) => { if (u) user = u; };
  export const clearSession = () => { user = null; };
}
