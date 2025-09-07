/**
 * OpenAI configuration constants
 * 
 * Live mode is activated with OPENAI_MODE=live + OPENAI_API_KEY environment variable.
 * Default mode is 'stub' which uses local mock logic.
 */

/**
 * OpenAI API key
 */
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Whether OpenAI is available (has API key)
 */
export const HAS_OPENAI = !!process.env.OPENAI_API_KEY;

/**
 * OpenAI mode: 'stub' (default) or 'live'
 */
export const OPENAI_MODE: 'stub' | 'live' = 
  (process.env.OPENAI_MODE as 'stub' | 'live') || 'stub';

/**
 * OpenAI API base URL
 */
export const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

/**
 * OpenAI model for optimization tasks
 */
export const OPENAI_MODEL_OPTIMIZE = process.env.OPENAI_MODEL_OPTIMIZE || 'gpt-4o-mini';

/**
 * OpenAI model for translation tasks
 */
export const OPENAI_MODEL_TRANSLATE = process.env.OPENAI_MODEL_TRANSLATE || 'gpt-4o-mini';
