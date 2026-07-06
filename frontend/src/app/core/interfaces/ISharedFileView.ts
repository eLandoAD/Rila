export interface ISharedFileView {
  id: string;
  fileId: string;
  name: string;              
  size: number;
  uploadedAt: number;
  iv: string;
  senderEmail: string;
  senderUsername: string;
  fileKey: CryptoKey | null; 
}