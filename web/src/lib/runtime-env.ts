import "server-only";

/** Read an env var at RUNTIME. Next.js inlines static `process.env.FOO` references at
 *  build time, freezing them to the build value. A `new Function` body is opaque to the
 *  bundler, so this is a real runtime lookup and the k8s-injected value wins.
 *  (Same trick as lib/oauth.ts.) */
// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
const readRuntimeEnv = new Function(
  "k",
  "return (typeof process !== 'undefined' && process.env && process.env[k]) || '';",
) as (k: string) => string;

export function runtimeEnv(key: string): string {
  return readRuntimeEnv(key);
}
