export interface StoredFileMeta {
  id: string;
  name: string;      
  encName: string;   
  size: number;
  iv: string;
  uploadedAt: number;
  wrappedDek: string;
  dekIv: string;
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
  wrappedDek: string;
  dekIv: string;
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
