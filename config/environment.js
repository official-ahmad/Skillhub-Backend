import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  throw new Error(`Unable to load the backend environment file: ${envPath}`);
}

export function validateEnvironment(requiredKeys) {
  for (const key of requiredKeys) {
    if (!process.env[key]?.trim()) {
      throw new Error(`${key} must be configured in the backend .env file`);
    }
  }
}
