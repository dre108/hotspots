import { existsSync } from "node:fs";

// Load server/.env for local runs; on a CI server or host the variables are set directly.
if (existsSync(".env")) process.loadEnvFile();
