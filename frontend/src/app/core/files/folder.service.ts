import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CryptoService } from '../crypto/crypto.service';
import { FolderResponse, FolderContentResponse, StoredFileMeta } from './file.models';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FolderService {
  private readonly http = inject(HttpClient);
  private readonly crypto = inject(CryptoService);
  private readonly baseUrl = `${environment.apiBaseUrl}/folders`;

  // Current navigation state
  readonly currentFolders = signal<FolderResponse[]>([]);
  readonly currentFiles = signal<StoredFileMeta[]>([]);
  readonly breadcrumbs = signal<FolderResponse[]>([]);
  readonly currentFolderId = signal<string | null>(null);

  /**
   * Loads the content of a folder and decrypts all names on-the-fly.
   */
  async loadFolderContent(folderId: string | null = null): Promise<void> {
    try {
      const params: any = {};
      if (folderId) params.folderId = folderId;

      const res = await firstValueFrom(
        this.http.get<FolderContentResponse>(`${this.baseUrl}/content`, { params })
      );

      // 1. Decrypt folder names
      const decryptedFolders = await Promise.all(
        res.folders.map(async (f) => ({
          ...f,
          name: await this.crypto.decryptText(f.encName, f.iv)
        }))
      );

      // 2. Decrypt file names
      const decryptedFiles: StoredFileMeta[] = await Promise.all(
        res.files.map(async (f) => ({
          id: f.id,
          name: await this.crypto.decryptText(f.encName, f.iv),
          encName: f.encName,
          size: f.fileSize,
          iv: f.iv,
          uploadedAt: f.createdAt
        }))
      );

      // 3. Decrypt breadcrumb names
      const decryptedBreadcrumbs = await Promise.all(
        res.breadcrumbs.map(async (b) => ({
          ...b,
          name: await this.crypto.decryptText(b.encName, b.iv)
        }))
      );

      // Update signals
      this.currentFolders.set(decryptedFolders);
      this.currentFiles.set(decryptedFiles);
      this.breadcrumbs.set(decryptedBreadcrumbs);
      this.currentFolderId.set(res.currentFolderId);
    } catch (err) {
      console.error('Failed to load or decrypt folder content', err);
      // Reset on error
      this.currentFolders.set([]);
      this.currentFiles.set([]);
      this.breadcrumbs.set([]);
      this.currentFolderId.set(null);
    }
  }

  /**
   * Creates a new encrypted folder.
   */
  async createFolder(name: string, parentId: string | null): Promise<void> {
    const ivBytes = crypto.getRandomValues(new Uint8Array(12));
    const iv = this.toBase64(ivBytes);
    const encName = await this.crypto.encryptText(name, iv);

    await firstValueFrom(
      this.http.post(`${this.baseUrl}/create`, {
        encName,
        iv,
        parentId
      })
    );

    // Refresh current folder
    await this.loadFolderContent(parentId);
  }

  async deleteFolder(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/${id}`));
    await this.loadFolderContent(this.currentFolderId());
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
