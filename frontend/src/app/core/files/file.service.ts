import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CryptoService } from '../crypto/crypto.service';
import {
  Breadcrumb,
  FileItem,
  FileUploadResponse,
  FolderContentDto,
  FolderItem,
} from './file.models';

/**
 * Talks to the backend folder/file API. All names are encrypted/decrypted
 * client-side with the session DEK, and file contents are encrypted before
 * upload and decrypted after download.
 */
@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly http = inject(HttpClient);
  private readonly crypto = inject(CryptoService);
  private readonly baseUrl = environment.apiBaseUrl;

  readonly folders = signal<FolderItem[]>([]);
  readonly files = signal<FileItem[]>([]);
  readonly breadcrumbs = signal<Breadcrumb[]>([]);
  readonly currentFolderId = signal<string | null>(null);

  /** True when there is no DEK in memory (e.g. after a page reload). */
  readonly locked = signal(!this.crypto.hasSession());

  async loadFolder(folderId: string | null): Promise<void> {
    if (!this.crypto.hasSession()) {
      this.locked.set(true);
      return;
    }
    this.locked.set(false);

    const params: Record<string, string> = folderId ? { folderId } : {};
    const content = await firstValueFrom(
      this.http.get<FolderContentDto>(`${this.baseUrl}/folders/content`, { params }),
    );

    const folders = await Promise.all(
      content.folders.map(async (f) => ({
        id: f.id,
        name: await this.crypto.decryptName(f.encName),
        parentId: f.parentId,
      })),
    );
    const files = await Promise.all(
      content.files.map(async (f) => ({
        id: f.id,
        name: await this.crypto.decryptName(f.encName),
        size: f.fileSize,
        createdAt: f.createdAt,
      })),
    );
    const breadcrumbs = await Promise.all(
      content.breadcrumbs.map(async (b) => ({
        id: b.id,
        name: await this.crypto.decryptName(b.encName),
      })),
    );

    this.folders.set(folders.sort((a, b) => a.name.localeCompare(b.name)));
    this.files.set(files.sort((a, b) => a.name.localeCompare(b.name)));
    this.breadcrumbs.set(breadcrumbs);
    this.currentFolderId.set(content.currentFolderId);
  }

  async createFolder(name: string): Promise<void> {
    const encName = await this.crypto.encryptName(name);
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/folders/create`, {
        encName,
        parentId: this.currentFolderId(),
      }),
    );
    await this.loadFolder(this.currentFolderId());
  }

  async renameFolder(id: string, name: string): Promise<void> {
    const newEncName = await this.crypto.encryptName(name);
    await firstValueFrom(this.http.patch(`${this.baseUrl}/folders/${id}`, { newEncName }));
    await this.loadFolder(this.currentFolderId());
  }

  async deleteFolder(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/folders/${id}`));
    await this.loadFolder(this.currentFolderId());
  }

  async moveFolder(id: string, targetFolderId: string | null): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.baseUrl}/folders/${id}/move`, { targetFolderId }));
    await this.loadFolder(this.currentFolderId());
  }

  async upload(file: File, onProgress?: (percent: number) => void): Promise<void> {
    const buffer = await file.arrayBuffer();
    const { cipher, iv } = await this.crypto.encrypt(buffer);
    const encName = await this.crypto.encryptName(file.name);

    const form = new FormData();
    form.append('file', new Blob([cipher]), 'blob');
    form.append('iv', iv);
    form.append('encName', encName);
    const folderId = this.currentFolderId();
    if (folderId) {
      form.append('folder_id', folderId);
    }

    await new Promise<FileUploadResponse>((resolve, reject) => {
      this.http
        .post<FileUploadResponse>(`${this.baseUrl}/files/upload`, form, {
          observe: 'events',
          reportProgress: true,
        })
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              onProgress?.(Math.round((event.loaded / event.total) * 100));
            } else if (event.type === HttpEventType.Response && event.body) {
              resolve(event.body);
            }
          },
          error: reject,
        });
    });
  }

  async download(file: FileItem): Promise<void> {
    const response = await firstValueFrom(
      this.http.get(`${this.baseUrl}/files/download/${file.id}`, {
        responseType: 'arraybuffer',
        observe: 'response',
      }),
    );
    const iv = response.headers.get('x-iv');
    if (!iv) {
      throw new Error('Missing IV header — cannot decrypt this file');
    }
    const plain = await this.crypto.decrypt(response.body as ArrayBuffer, iv);
    const url = URL.createObjectURL(new Blob([plain]));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async renameFile(id: string, name: string): Promise<void> {
    const newEncName = await this.crypto.encryptName(name);
    await firstValueFrom(this.http.patch(`${this.baseUrl}/files/${id}`, { newEncName }));
    await this.loadFolder(this.currentFolderId());
  }

  async deleteFile(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/files/${id}`));
    await this.loadFolder(this.currentFolderId());
  }

  async moveFile(id: string, targetFolderId: string | null): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.baseUrl}/files/${id}/move`, { targetFolderId }));
    await this.loadFolder(this.currentFolderId());
  }

  /** Flat, depth-annotated list of every folder, for the "move to…" picker. */
  async listAllFolders(): Promise<{ id: string; name: string; depth: number }[]> {
    const out: { id: string; name: string; depth: number }[] = [];
    const walk = async (parentId: string | null, depth: number): Promise<void> => {
      const params: Record<string, string> = parentId ? { folderId: parentId } : {};
      const content: FolderContentDto = await firstValueFrom(
        this.http.get<FolderContentDto>(`${this.baseUrl}/folders/content`, { params }),
      );
      const decrypted = await Promise.all(
        content.folders.map(async (f): Promise<{ id: string; name: string }> => ({
          id: f.id,
          name: await this.crypto.decryptName(f.encName),
        })),
      );
      decrypted.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
      for (const f of decrypted) {
        out.push({ id: f.id, name: f.name, depth });
        await walk(f.id, depth + 1);
      }
    };
    await walk(null, 0);
    return out;
  }
}
