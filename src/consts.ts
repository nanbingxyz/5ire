export const TEMP_CHAT_ID = 'temp';

export const EARLIEST_DATE = new Date('2023-08-01');
export const DEFAULT_PROVIDER = 'OpenAI';
export const ERROR_MODEL = 'ERROR_MODEL';

export const DEFAULT_TEMPERATURE = 0.9;

export const DEFAULT_CONTEXT_WINDOW = 128000;
export const MAX_CONTEXT_WINDOW = 40000000; // 40M

export const DEFAULT_MAX_TOKENS = 4096;
export const MAX_TOKENS = 16384;

export const NUM_CTX_MESSAGES = 10;
export const MAX_CTX_MESSAGES = 99;
export const MIN_CTX_MESSAGES = 0;

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const SUPPORTED_FILE_TYPES: { [key: string]: string } = {
  txt: 'text/plain',
  md: 'text/plain',
  csv: 'text/csv',
  epub: 'application/epub+zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export const SUPPORTED_IMAGE_TYPES: { [key: string]: string } = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export const WINDOWS_TITLE_BAR_HEIGHT = 32;
