export const OLLAMA_ERRORS = {
  REQUEST_FAILED: 'Ollama classifier request failed',
} as const;

export const OLLAMA_DEFAULTS = {
  BASE_URL: 'http://localhost:11434',
  CLASSIFIER_MODEL: 'ticket-classifier',
  TIMEOUT_MS: 10_000,
} as const;
