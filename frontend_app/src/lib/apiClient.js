import { getSessionGeneration, performLogout } from "./authSession.js";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const ACCESS_TOKEN_KEY = "zhytomate.accessToken";
const REFRESH_TOKEN_KEY = "zhytomate.refreshToken";

const AUTH_PATHS_WITHOUT_RETRY = new Set(["/auth/login", "/auth/register", "/auth/refresh"]);

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isLoggedIn() {
  return Boolean(getAccessToken());
}

async function readErrorMessage(response) {
  try {
    const body = await response.json();
    return body?.error || response.statusText;
  } catch {
    return response.statusText;
  }
}

// Refresh does NOT rotate the refresh token (backend_app/src/features/auth/auth.service.js's
// refreshAccessToken only re-signs a new access token) - only the access token is replaced here.
let pendingRefresh = null;

function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(false);
  const refreshGeneration = getSessionGeneration();

  if (!pendingRefresh) {
    pendingRefresh = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok || refreshGeneration !== getSessionGeneration()) return false;
        const body = await response.json();
        if (refreshGeneration !== getSessionGeneration()) return false;
        setTokens({ accessToken: body.accessToken });
        return true;
      })
      .catch(() => false)
      .finally(() => {
        pendingRefresh = null;
      });
  }
  return pendingRefresh;
}

function forceLogout() {
  performLogout({ clearSession: clearTokens });
}

export async function apiFetch(path, { method = "GET", body, signal, isRetry = false } = {}) {
  const accessToken = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (response.status === 401 && !isRetry && !AUTH_PATHS_WITHOUT_RETRY.has(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiFetch(path, { method, body, signal, isRetry: true });
    forceLogout();
    throw new ApiError(401, "Session expired");
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  if (response.status === 204) return null;
  return response.json();
}

// For multipart/form-data uploads (e.g. appeal photos) - no content-type header, the browser
// sets the multipart boundary itself; same 401-refresh-retry behavior as apiFetch.
export async function apiUpload(path, formData, { isRetry = false } = {}) {
  const accessToken = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });

  if (response.status === 401 && !isRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiUpload(path, formData, { isRetry: true });
    forceLogout();
    throw new ApiError(401, "Session expired");
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }
  return response.json();
}
