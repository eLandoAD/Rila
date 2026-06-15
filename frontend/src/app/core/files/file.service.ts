import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CryptoService } from '../crypto/crypto.service';
import { FolderService } from './folder.service';
import { FileUploadResponse, StoredFileMeta } from './file.models';
import { firstValueFrom } from 'rxjs';

/**
 * Handles encrypted upload/download against the backend.
 * Now synchronized with the server-side state.
 */
@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly http = inject(HttpClient);
  private readonly crypto = inject(CryptoService);
  private readonly folderService = inject(FolderService);
  private readonly baseUrl = `${environment.apiBaseUrl}/files`;

  async upload(file: File, folderId: string | null = null, onProgress?: (percent: number) => void): Promise<void> {
    const buffer = await file.arrayBuffer();
    
    // 1. E2EE Encryption
    const { cipher, iv } = await this.crypto.encrypt(buffer);
    const encName = await this.crypto.encryptName(file.name);

    // 2. Prepare FormData
    const form = new FormData();
    form.append('file', new Blob([cipher]), 'blob');
    form.append('iv', iv);
    form.append('encName', encName);
    if (folderId) {
      form.append('folder_id', folderId);
    }

    // 3. Execute Upload
    await new Promise<void>((resolve, reject) => {
      this.http
        .post<FileUploadResponse>(`${this.baseUrl}/files/upload`, form, {
          observe: 'events',
          reportProgress: true,
        })
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              onProgress?.(Math.round((event.loaded / event.total) * 100));
            } else if (event.type === HttpEventType.Response) {
              resolve();
            }
          },
          error: reject,
        });
    });

    // 4. Refresh folder content if we are in a view that needs it
    await this.folderService.loadFolderContent(this.folderService.currentFolderId());
  }

  async download(meta: StoredFileMeta): Promise<void> {
    const cipher = await firstValueFrom(
      this.http.get(`${this.baseUrl}/download/${meta.id}`, { responseType: 'arraybuffer' })
    );

    // Decrypt with in-memory DEK
    const plain = await this.crypto.decrypt(cipher, meta.iv);
    
    // Trigger browser download
    const url = URL.createObjectURL(new Blob([plain]));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/${id}`));
    await this.folderService.loadFolderContent(this.folderService.currentFolderId());
  }

  /**
   * Renames a file. The new name is encrypted client-side reusing the file's IV,
   * so the server only ever sees ciphertext.
   */
  async rename(meta: StoredFileMeta, newName: string): Promise<void> {
    const newEncName = await this.crypto.encryptText(newName, meta.iv);
    await firstValueFrom(this.http.patch(`${this.baseUrl}/${meta.id}`, { newEncName }));
    await this.folderService.loadFolderContent(this.folderService.currentFolderId());
  }

  /**
   * Moves a file into another folder (null = root).
   */
  async move(id: string, targetFolderId: string | null): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.baseUrl}/${id}/move`, { targetFolderId }));
    await this.folderService.loadFolderContent(this.folderService.currentFolderId());
  }
}
