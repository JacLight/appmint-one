/**
 * Slim activity-tracker — provides getRequestInfo() only.
 *
 * The full base-app version also does web-visit logging (jsonwebtoken, ua-parser-js,
 * models). Stowbo doesn't need that here, so this keeps just the request-info builder
 * the AppEngine connector + proxy route rely on to populate the x-client-* headers.
 */
import { appmintConfig } from './appmint-config';

type HeaderLike = {
  get(name: string): string | null;
} | Headers | undefined | null;

function h(headers: HeaderLike, name: string): string | undefined {
  try {
    return headers?.get(name) ?? undefined;
  } catch {
    return undefined;
  }
}

export interface ClientRequestInfo {
  ip?: string;
  host?: string;
  protocol?: string;
  referer?: string;
  userAgent?: string;
  acceptLanguage?: string;
  timezone?: string;
  orgId?: string;
  authorization?: string;
}

/**
 * Best-effort request context pulled from incoming headers. Safe to call with a
 * Next.js ReadonlyHeaders, a Web Headers object, or nothing.
 */
export async function getRequestInfo(headers?: HeaderLike): Promise<ClientRequestInfo> {
  const forwardedFor = h(headers, 'x-forwarded-for');
  const info: ClientRequestInfo = {
    ip: forwardedFor?.split(',')[0]?.trim() || h(headers, 'x-real-ip'),
    host: h(headers, 'x-forwarded-host') || h(headers, 'host'),
    protocol: h(headers, 'x-forwarded-proto'),
    referer: h(headers, 'referer'),
    userAgent: h(headers, 'user-agent'),
    acceptLanguage: h(headers, 'accept-language'),
    timezone: h(headers, 'x-client-timezone'),
    orgId: appmintConfig.orgId,
  };
  return info;
}
