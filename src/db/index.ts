import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

// DATABASE_URL은 빌드 시점이 아니라 실제 DB 요청 시 사용한다.
// Next.js가 API Route의 모듈을 빌드 중 로드할 수 있으므로
// 여기서 즉시 throw 하면 Vercel/Next.js 프로덕션 빌드가 실패한다.
const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
