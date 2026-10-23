/** getClientInfo may already supply the scheme; send exactly one Bearer prefix. */
export function customerAuthorization(token: string | null | undefined): string | undefined {
  const value = token?.trim().replace(/^(?:Bearer\s+)+/i, "").trim();
  return value ? `Bearer ${value}` : undefined;
}
