/** Raw DTOs returned by the backend (names are ciphertext). */
export interface FileResponseDto {
  id: string;
  name: string;      // Decrypted name
  encName: string;   // Encrypted name from server
  size: number;
  iv: string;
  uploadedAt: number;
}

export interface FileUploadResponse {
  id: string;
  encName: string;
  message: string;
}

export interface FileListResponse {
  id: string;
  encName: string;
  fileSize: number;
  createdAt: number;
  iv: string;
}

export interface FolderResponse {
  id: string;
  encName: string;
  iv: string;
  parentId: string | null;
  name?: string; // Decrypted name (populated in frontend)
}

export interface FolderContentResponse {
  folders: FolderResponse[];
  files: FileListResponse[];
  breadcrumbs: FolderResponse[];
  currentFolderId: string | null;
  currentFolderName: string;
}
