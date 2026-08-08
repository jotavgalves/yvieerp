export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  YVIE_ADMIN_PASSWORD: string;
  YVIE_SESSION_SECRET: string;
}

export interface SessionPayload { exp: number }
