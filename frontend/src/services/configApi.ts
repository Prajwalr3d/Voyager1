// ============================================================================
// SMARTCHUNK CONFIGURATION API SERVICE
// Parameter storage, validation, and defaults management
// ============================================================================

import { SmartChunkConfig } from '../types';
import { apiGet, apiPost } from './apiClient';
import { DEFAULT_SMARTCHUNK_CONFIG } from '../demo/demoData';

const CONFIG_STORAGE_KEY = 'smartchunk_user_config_v2';

let cachedConfig: SmartChunkConfig = loadInitialConfig();

function loadInitialConfig(): SmartChunkConfig {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SMARTCHUNK_CONFIG, ...JSON.parse(saved) };
    }
  } catch {
    // LocalStorage unavailable
  }
  return { ...DEFAULT_SMARTCHUNK_CONFIG };
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  estimatedChunksPer10kWords: number;
}

export function validateSmartChunkConfig(config: SmartChunkConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.max_chunk_size_tokens < 64) {
    errors.push('Max chunk size must be at least 64 tokens.');
  }
  if (config.max_chunk_size_tokens > 4096) {
    errors.push('Max chunk size cannot exceed 4096 tokens for current embedding models.');
  }
  if (config.overlap_tokens < 0) {
    errors.push('Overlap size cannot be negative.');
  }
  if (config.overlap_tokens >= config.max_chunk_size_tokens) {
    errors.push('Overlap size must be strictly smaller than max chunk size.');
  }

  if (config.overlap_tokens > config.max_chunk_size_tokens * 0.4) {
    warnings.push('Overlap exceeds 40% of max chunk size; this may inflate storage and duplicate index chunks.');
  }
  if (!config.preserve_formulas && !config.preserve_tables) {
    warnings.push('Mathematical formulas and tables will be split arbitrarily across token windows without AST integrity.');
  }
  if (config.enable_deduplication && config.deduplication_threshold < 0.70) {
    warnings.push('Deduplication threshold below 0.70 may cause false positive consolidation of distinct sections.');
  }

  const effectiveStep = Math.max(1, config.max_chunk_size_tokens - config.overlap_tokens);
  // Estimate ~1.33 tokens per word -> 10,000 words ~ 13,300 tokens
  const estimatedChunks = Math.ceil(13300 / effectiveStep);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    estimatedChunksPer10kWords: estimatedChunks,
  };
}

export async function fetchSmartChunkConfig(): Promise<SmartChunkConfig> {
  try {
    const data = await apiGet<SmartChunkConfig>('/api/v1/config');
    cachedConfig = data;
    return data;
  } catch {
    return cachedConfig;
  }
}

export async function saveSmartChunkConfig(newConfig: SmartChunkConfig): Promise<SmartChunkConfig> {
  const validation = validateSmartChunkConfig(newConfig);
  if (!validation.isValid) {
    throw new Error(`Invalid configuration: ${validation.errors.join('; ')}`);
  }

  try {
    const data = await apiPost<SmartChunkConfig>('/api/v1/config', newConfig);
    cachedConfig = data;
  } catch {
    cachedConfig = { ...newConfig };
  }

  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cachedConfig));
  } catch {
    // Ignore storage errors
  }

  return cachedConfig;
}

export function resetSmartChunkConfigToDefaults(): SmartChunkConfig {
  cachedConfig = { ...DEFAULT_SMARTCHUNK_CONFIG };
  try {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
  } catch {}
  return cachedConfig;
}

