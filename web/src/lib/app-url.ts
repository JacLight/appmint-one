/** This deployment's public origin, read at RUNTIME so one image serves any domain.
 *  APP_URL (k8s) wins; NEXT_PUBLIC_APP_URL is the local-dev value. No hard-coded domain. */
// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
const readEnv = new Function("k", "return (typeof process !== 'undefined' && process.env && process.env[k]) || '';") as (k: string) => string;

export function appUrl(): string {
  return (readEnv("APP_URL") || readEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3710").replace(/\/$/, "");
}
