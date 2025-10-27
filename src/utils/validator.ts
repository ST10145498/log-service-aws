 
/**
 * Input Validation Utilities
 */

export const VALID_SEVERITIES = ['info', 'warning', 'error'] as const;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateLogInput(input: any): ValidationResult {
  if (!input || typeof input !== 'object') {
    return {
      isValid: false,
      error: 'Request body must be a valid JSON object'
    };
  }

  if (!input.severity) {
    return {
      isValid: false,
      error: 'Missing required field: severity'
    };
  }

  if (!VALID_SEVERITIES.includes(input.severity)) {
    return {
      isValid: false,
      error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}`
    };
  }

  if (!input.message) {
    return {
      isValid: false,
      error: 'Missing required field: message'
    };
  }

  if (typeof input.message !== 'string') {
    return {
      isValid: false,
      error: 'Message must be a string'
    };
  }

  if (input.message.trim().length === 0) {
    return {
      isValid: false,
      error: 'Message cannot be empty'
    };
  }

  return {
    isValid: true
  };
}