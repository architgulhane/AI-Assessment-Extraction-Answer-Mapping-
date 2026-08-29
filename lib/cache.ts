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
