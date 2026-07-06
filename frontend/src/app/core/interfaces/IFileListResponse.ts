export interface IFileListResponse {
  id: string;
  encName: string;
  fileSize: number;
  createdAt: number;
  iv: string;
  wrappedDek: string;
  dekIv: string;
}