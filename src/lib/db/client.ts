import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

// Lazy: build-time pages should not require DATABASE_URL.
// Throw only when first used at runtime.
export const db = connectionString
  ? drizzle(neon(connectionString), { schema })
  : (new Proxy(
      {},
      {
        get() {
          throw new Error("DATABASE_URL is not set");
        },
      },
    ) as ReturnType<typeof drizzle>);
