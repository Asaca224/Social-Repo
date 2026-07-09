import { randomBytes } from "node:crypto";

// Minimal env so getEnv() validates during tests. No real DB is contacted.
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/socialops";
process.env.TOKEN_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
process.env.META_GRAPH_API_VERSION ??= "v21.0";
