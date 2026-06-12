/** Raw DTOs returned by the backend (names are ciphertext). */
export interface FileResponseDto {
  id: string;
  encName: string;
  fileSize: number;
  createdAt: number;
}

export interface FolderResponseDto {
  id: string;
  encName: string;
  parentId: string | null;
}

export interface FolderContentDto {
  folders: FolderResponseDto[];
  files: FileResponseDto[];
  breadcrumbs: FolderResponseDto[];
  currentFolderId: string | null;
  currentFolderName: string;
}

export interface FileUploadResponse {
  id: string;
  encName: string;
  message: string;
}

/** View models with decrypted names. */
export interface FileItem {
  id: string;
  name: string;
  size: number;
  createdAt: number;
}

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Breadcrumb {
  id: string;
  name: string;
}
