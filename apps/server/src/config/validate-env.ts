/**
 * Boot-time env check. Imported by main.ts right after load-env and BEFORE the
 * app module graph, so a misconfigured deploy fails with one readable list of
 * every missing/invalid variable instead of the first module that trips.
 */
import { EnvValidationError, getConfig, loadConfig } from './env';

try {
  const { warnings } = loadConfig(process.env);
  for (const warning of warnings) console.warn(`[config] WARNING: ${warning}`);
  getConfig();
} catch (err) {
  if (err instanceof EnvValidationError) {
    console.error(`[config] ${err.message}`);
    process.exit(1);
  }
  throw err;
}

export {};
