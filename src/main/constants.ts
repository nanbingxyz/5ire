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
export const MAX_DOCUMENT_SIZE = 1024 * 1024 * 100;

export const SUPPORTED_DOCUMENT_URL_SCHEMAS = [
  // "http",
  // "https",
  "file",
];

export const COMMON_TEXTUAL_FILE_MIMETYPES = {
  txt: "text/plain",
  html: "text/html",
  htm: "text/html",
  json: "application/json",
  xml: "application/xml",
  csv: "text/csv",
  md: "text/markdown",
  yml: "text/yaml",
  yaml: "text/yaml",
};

export const COMMON_BINARY_DOCUMENT_FILE_MIMETYPES = {
  pdf: "application/pdf",
  // Microsoft Office formats
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Old Microsoft Office formats
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  // Open document formats
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
};
