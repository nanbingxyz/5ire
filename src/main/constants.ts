export const DOCUMENT_EMBEDDING_MODEL_NAME = "Xenova/bge-m3";
export const DOCUMENT_EMBEDDING_MODEL_FILES = [
  {
    name: "config.json",
    url: "https://huggingface.co/Xenova/bge-m3/resolve/main/config.json?download=true",
  },
  {
    name: "tokenizer_config.json",
    url: "https://huggingface.co/Xenova/bge-m3/resolve/main/tokenizer_config.json?download=true",
  },
  {
    name: "tokenizer.json",
    url: "https://huggingface.co/Xenova/bge-m3/resolve/main/tokenizer.json?download=true",
  },
  {
    name: "model_quantized.onnx",
    path: "onnx/model_quantized.onnx",
    url: "https://huggingface.co/Xenova/bge-m3/resolve/main/onnx/model_quantized.onnx?download=true",
  },
];

export const MAX_COLLECTIONS = 200;
export const MAX_DOCUMENTS_PER_COLLECTION = 1000;
export const MAX_DOCUMENT_SIZE = 1024 * 1024 * 10;

export const SUPPORTED_DOCUMENT_URL_SCHEMAS = [
  // "http",
  // "https",
  "file",
];

export const SUPPORTED_DOCUMENT_MIMETYPES = [
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/pdf",
] as const;
