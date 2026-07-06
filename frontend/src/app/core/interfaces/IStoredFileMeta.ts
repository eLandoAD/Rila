export interface IStoredFileMeta {
  id: string;
  name: string;      
  encName: string;   
  size: number;
  iv: string;
  uploadedAt: number;
  wrappedDek: string;
  dekIv: string;
}