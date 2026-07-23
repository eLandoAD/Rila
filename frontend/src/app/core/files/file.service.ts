import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CryptoService } from '../crypto/crypto.service';
import { FolderService } from './folder.service';
import { IFileUploadResponse } from '../interfaces/IFileUploadResponse';
import { IStoredFileMeta } from '../interfaces/IStoredFileMeta';
import { IFileListResponse } from '../interfaces/IFileListResponse';
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
    
    // e2ee -> dedicated file key, wrapped with the master dek
    const fileKey = await this.crypto.generateFileKey()
    const { cipher, iv } = await this.crypto.encryptWithKey(buffer, fileKey);
    const encName = await this.crypto.encryptNameWithKey(file.name, fileKey);
    const { wrappedDek, dekIv } = await this.crypto.wrapFileKey(fileKey)

    // prepare formData
    const form = new FormData();
    form.append('file', new Blob([cipher]), 'blob');
    form.append('iv', iv);
    form.append('encName', encName);
    form.append('wrappedDek', wrappedDek);
    form.append('dekIv', dekIv);
    if (folderId) {
      form.append('folder_id', folderId);
    }

    // actually upload
    await new Promise<void>((resolve, reject) => {
      this.http
        .post<IFileUploadResponse>(`${this.baseUrl}/upload`, form, {
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

    // if we're inside a folder, reload its content to show the new file
    await this.folderService.loadFolderContent(this.folderService.currentFolderId());
  }

  async download(meta: IStoredFileMeta): Promise<void> {
    const cipher = await firstValueFrom(
      this.http.get(`${this.baseUrl}/download/${meta.id}`, { responseType: 'arraybuffer' })
    );

    // unlock the file key and decrypt the content with it
    const fileKey = await this.crypto.unwrapFileKey(meta.wrappedDek, meta.dekIv);
    const plain = await this.crypto.decryptWithKey(cipher, meta.iv, fileKey);

    // Trigger browser download
    const url = URL.createObjectURL(new Blob([plain]));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = meta.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // also needs wrappedDek+dekIv to unlock the file key
  async downloadAndDecryptRaw(id: string, iv: string, wrappedDek: string, dekIv: string): Promise<ArrayBuffer> {
    const cipher = await firstValueFrom(
      this.http.get(`${this.baseUrl}/download/${id}`, { responseType: 'arraybuffer' })
    );
    const fileKey = await this.crypto.unwrapFileKey(wrappedDek, dekIv);
    return this.crypto.decryptWithKey(cipher, iv, fileKey);
  }

  async downloadRaw(id: string): Promise<ArrayBuffer> {
    return firstValueFrom(
      this.http.get(`${this.baseUrl}/download/${id}`, { responseType: 'arraybuffer' })
    );
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/${id}`));
    await this.folderService.loadFolderContent(this.folderService.currentFolderId());
  }

  /**
   * Renames a file. The new name is encrypted client-side reusing the file's IV,
   * so the server only ever sees ciphertext.
   */
  async rename(meta: IStoredFileMeta, newName: string): Promise<void> {
    // unlock the file key and encrypt the new name with it (new iv embedded in encName)
    const fileKey = await this.crypto.unwrapFileKey(meta.wrappedDek, meta.dekIv);
    const newEncName = await this.crypto.encryptNameWithKey(newName, fileKey);
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

  async getAllFiles(): Promise<IStoredFileMeta[]> {
    const res = await firstValueFrom(
      this.http.get<IFileListResponse[]>(this.baseUrl)
    );
    return Promise.all(
      res.map(async (f) => {
        // unlock the file key to decrypt the name
        const fileKey = await this.crypto.unwrapFileKey(f.wrappedDek, f.dekIv);
        return {
          id: f.id,
          name: await this.crypto.decryptNameWithKey(f.encName, fileKey),
          encName: f.encName,
          size: f.fileSize,
          iv: f.iv,
          uploadedAt: f.createdAt,
          wrappedDek: f.wrappedDek,
          dekIv: f.dekIv,
        };
      })
    );
  }

  async shareByEmail(fileId: string, receiverEmail: string, dek: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/share`, { fileId, receiverEmail, dek })
    );
  }

  async getSharedFiles(): Promise<any[]> {
    return firstValueFrom(
      this.http.get<any[]>(`${this.baseUrl}/shared`)
    );
  }

  async removeSharedFile(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/shared/${id}`)
    );
  }

  // gets a given user's public key
  async getPublicKey(email: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.get<{ publicKey: string }>(`${environment.apiBaseUrl}/users/public-key`, { params: { email } })
    );
    return res.publicKey;
  }

  async publish(id: string): Promise<string> {
    // backend responds with the token
    return firstValueFrom(
      this.http.post(`${this.baseUrl}/${id}/publish`, {}, { responseType: 'text' })
    )
  }

  async unpublish(id: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.baseUrl}/${id}/unpublish`, {}));
  }
}
