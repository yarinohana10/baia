type Messages = { [key: string]: string | Messages };

const isObject = (v: unknown): v is Messages => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Deep merge: nested namespaces combine, leaf strings from `extra` win. */
export function mergeMessages(base: Messages, extra: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const existing = out[key];
    out[key] = isObject(existing) && isObject(value) ? mergeMessages(existing, value) : value;
  }
  return out;
}
