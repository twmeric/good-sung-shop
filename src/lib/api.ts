const API_BASE = "https://good-sung-shop.jimsbond007.workers.dev";

/**
 * API fetch wrapper that automatically injects the admin token
 * from localStorage as a Bearer Authorization header.
 * Replaces EdgeSpark's client.api.fetch which doesn't work with
 * our custom RBAC session token system.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem("admin_token");
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
}
