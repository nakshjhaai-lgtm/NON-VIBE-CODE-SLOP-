/**
 * Reads configuration without depending on a particular server runtime.
 * Netlify Edge exposes variables through `Netlify.env`; the guarded fallbacks
 * keep the same modules usable in standards-based local test harnesses.
 */
export function env(name, fallback = '') {
  try {
    const value = globalThis.Netlify?.env?.get(name);
    if (value !== undefined && value !== null && value !== '') return String(value);
  } catch {
    // Not running in Netlify's edge isolate.
  }

  try {
    const value = globalThis.Deno?.env?.get(name);
    if (value !== undefined && value !== null && value !== '') return String(value);
  } catch {
    // Deno was not granted environment access, or is not the host runtime.
  }

  return fallback;
}
