import { env } from "@finn/env/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

export * from "./domain";
export * from "./schema";
export {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  or,
} from "drizzle-orm";
import * as schema from "./schema";

export function createDb() {
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export const db = createDb();
