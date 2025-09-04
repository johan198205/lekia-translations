// TODO: Adopt in normalize, upload route, optimize, SSE in next iterations

/**
 * Maximum file size for uploads in bytes
 */
export const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;

/**
 * Maximum characters for description truncation
 */
export const DESCRIPTION_TRUNCATE_CHARS = 4000 as const;

/**
 * Server-Sent Events polling interval in milliseconds
 */
export const SSE_POLL_INTERVAL_MS = 1000 as const;

/**
 * Server-Sent Events heartbeat interval in milliseconds
 */
export const SSE_HEARTBEAT_MS = 15000 as const;

/**
 * Error message constants for consistent error handling
 */
export const ERROR_MESSAGES = Object.freeze({
  invalidFileType: 'Invalid file type. Please upload an Excel file.',
  fileTooLarge: 'File size exceeds maximum limit.',
  missingRequiredColumns: 'Required columns are missing from the file.',
  internalError: 'An internal error occurred. Please try again.',
  batchNotFound: 'Batch not found.',
  noPendingProducts: 'No pending products found for processing.',
} as const);

/**
 * Header aliases for column normalization
 */
export const HEADER_ALIASES = Object.freeze({
  name_sv: ['product_name_sv', 'name_sv', 'product_name', 'name'],
  description_sv: ['description_sv', 'description', 'product_description'],
  attributes: ['attributes', 'spec', 'specification', 'specs'],
  tone_hint: ['tone_hint', 'tone', 'style'],
} as const);

/**
 * Type for error message keys
 */
export type ErrorKey = keyof typeof ERROR_MESSAGES;

/**
 * Type for header alias keys
 */
export type HeaderAliasKey = keyof typeof HEADER_ALIASES;
