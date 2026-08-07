// Minimal ambient type shims for the Cloudflare Worker scaffold.
// The real types are provided by @cloudflare/workers-types at Worker build
// time; these declarations keep `tsc --noEmit` green without that dependency.
declare module "cloudflare:workers" {
  // Binding values are injected by the Cloudflare runtime; name/shape vary per project.
  export const env: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

declare type Fetcher = { fetch(input: RequestInfo, init?: RequestInit): Promise<Response> };

declare interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  run(): Promise<D1Result>;
}

declare interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
}
