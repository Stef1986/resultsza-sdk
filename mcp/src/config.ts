/**
 * The ResultsZA API key from the environment (`RESULTSZA_API_KEY`), trimmed so
 * a key pasted with a trailing newline or spaces still works. Empty means not set.
 */
export function readApiKey(env: Record<string, string | undefined>): string | null {
  const key = (env.RESULTSZA_API_KEY ?? "").trim();
  return key === "" ? null : key;
}
