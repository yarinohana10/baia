/**
 * Load `.env` from the working directory into process.env before any module
 * reads configuration at import time (better-auth, email transport). Existing
 * environment variables always win. Skipped under Jest so tests stay hermetic.
 */
if (process.env.NODE_ENV !== 'test' && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file - rely on the real environment (Docker, CI, production).
  }
}

export {};
