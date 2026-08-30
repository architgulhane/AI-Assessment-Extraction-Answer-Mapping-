import crypto from "crypto";

// Simple in-memory cache keyed by SHA-256 hash of base64 image strings
class MemoryCache {
  private cache = new Map<string, unknown>();

  public getHash(data: string | string[]): string {
    const combined = Array.isArray(data) ? data.join("") : data;
    return crypto.createHash("sha256").update(combined).digest("hex");
  }

  public get<T>(hash: string): T | undefined {
    return this.cache.get(hash) as T | undefined;
  }

  public set<T>(hash: string, value: T): void {
    this.cache.set(hash, value);
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const fileCache = new MemoryCache();

/**
 * Reusable helper to process items in concurrency-limited batches with delay
 * to stay under API free-tier rate limits (e.g. Gemini 10 RPM).
 */
export async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const chunkResults = await Promise.all(
      chunk.map((item, indexWithinChunk) => fn(item, i + indexWithinChunk))
    );
    results.push(...chunkResults);

    if (i + batchSize < items.length && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return results;
}
