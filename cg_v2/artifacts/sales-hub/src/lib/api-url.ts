import { getBaseUrl } from "@workspace/api-client-react";

export function resolveApiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const base = getBaseUrl();
  return base ? `${base}${path}` : path;
}
