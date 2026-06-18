export const buildAiRequestCacheKey = (endpoint: string, payload: unknown) =>
  `${endpoint}::${JSON.stringify(payload)}`;

export const fetchJsonWithTimeout = async <T,>(
  endpoint: string,
  body: unknown,
  timeoutMs: number
): Promise<{ response: Response; data: T }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const rawText = await response.text();
    const data = rawText ? JSON.parse(rawText) as T : {} as T;
    return { response, data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`The AI request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
