import { IFileListResponse } from "./IFileListResponse";
import { IFolderResponse } from "./IFolderResponse";

export interface IFolderContentResponse {
  folders: IFolderResponse[];
  files: IFileListResponse[];
  breadcrumbs: IFolderResponse[];
  currentFolderId: string | null;
  currentFolderName: string;
}