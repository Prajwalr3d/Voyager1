// Centralized API client for SmartChunk
// Supports real FastAPI backend integration and explicit Demo Mode fallback

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');

// Demo mode control
const DEMO_MODE_STORAGE_KEY = 'smartchunk_demo_mode';

export function getDemoModePreference(): boolean {
  const stored = localStorage.getItem(DEMO_MODE_STORAGE_KEY);
  if (stored !== null) {
    return stored === 'true';
  }
  // Default to demo mode if specified in env or fallback to true for independent preview
  return import.meta.env.VITE_DEFAULT_DEMO_MODE !== 'false';
}

export function setDemoModePreference(enabled: boolean): void {
  localStorage.setItem(DEMO_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('smartchunk_demo_mode_changed', { detail: enabled }));
}

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Core fetch wrapper with timeout, standardized headers, and error handling.
 */
export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 15000, headers = {}, ...rest } = options;

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const isFormData = rest.body instanceof FormData;
    const finalHeaders: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      Accept: 'application/json',
      ...(headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBody: any = null;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }

      const errorMessage =
        (typeof errorBody === 'object' && errorBody?.detail) ||
        (typeof errorBody === 'object' && errorBody?.message) ||
        `Request failed with status ${response.status}: ${response.statusText}`;

      throw new ApiError(errorMessage, response.status, errorBody);
    }

    return (await response.json()) as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError(`Request timeout after ${timeoutMs}ms`, 408);
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      `Unable to connect to SmartChunk backend at ${API_BASE_URL}. Ensure the FastAPI server is running or switch to Demo Mode. Error: ${err.message}`,
      0
    );
  }
}

export async function apiGet<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'GET', ...options });
}

export async function apiPost<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    ...options,
  });
}

export async function apiDelete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'DELETE', ...options });
}


