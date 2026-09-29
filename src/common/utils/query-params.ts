export const MAX_PAGE_SIZE = 50;

export function clampPageSize(requested: unknown, defaultSize: number): number {
  const size = Number(requested);

  if (!Number.isInteger(size) || size < 1) return defaultSize;

  return Math.min(size, MAX_PAGE_SIZE);
}

export function parseOffset(requested: unknown): number {
  const offset = Number(requested);

  return Number.isInteger(offset) && offset > 0 ? offset : 0;
}

// A literal "%" is not valid percent-encoding and would make decodeURIComponent throw
export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
