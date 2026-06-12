export interface StoredFileMeta {
  id: string;
  name: string;
  size: number;
  iv: string;
  uploadedAt: number;
}

export interface FileUploadResponse {
  id: string;
  encName: string;
  message: string;
}
