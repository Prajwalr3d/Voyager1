import { API_BASE_URL, getDemoModePreference } from './apiClient';
import { SystemHealth } from '../types';

export async function checkBackendHealth(): Promise<SystemHealth> {
  if (getDemoModePreference()) {
    return {
      status: 'online',
      backend_version: 'v2.4.0 (Demo Mode Fixture)',
      embedding_model: 'text-embedding-3-large',
      vector_store: 'Qdrant In-Memory Simulation',
      api_latency_ms: 12,
      is_demo_mode: true,
    };
  }

  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${API_BASE_URL}/api/v1/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latency = Math.round(performance.now() - start);

    if (res.ok) {
      const data = await res.json();
      return {
        status: 'online',
        backend_version: data.version || 'v2.4.0',
        embedding_model: data.embedding_model || 'text-embedding-3-large',
        vector_store: data.vector_store || 'Qdrant',
        api_latency_ms: latency,
        is_demo_mode: false,
      };
    } else {
      return {
        status: 'degraded',
        backend_version: `HTTP ${res.status}`,
        api_latency_ms: latency,
        is_demo_mode: false,
      };
    }
  } catch (err: any) {
    return {
      status: 'offline',
      backend_version: 'Unreachable',
      api_latency_ms: Math.round(performance.now() - start),
      is_demo_mode: false,
    };
  }
}

