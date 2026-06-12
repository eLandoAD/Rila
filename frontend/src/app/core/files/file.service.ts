import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CryptoService } from '../crypto/crypto.service';
import { FileUploadResponse, StoredFileMeta } from './file.models';

const INDEX_KEY = 'sv_files';

/**
 * Handles encrypted upload/download against the backend.
 *
 * The backend only exposes `POST /files/upload` and `GET /files/download/{id}`
 * (no listing endpoint), so the list of the user's files is kept locally per
 * browser alongside the per-file IV needed to decrypt it.
 */
@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly http = inject(HttpClient);
  private readonly crypto = inject(CryptoService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly baseUrl = `${environment.apiBaseUrl}/files`;

  readonly files = signal<StoredFileMeta[]>(this.readIndex());

  async upload(file: File, onProgress?: (percent: number) => void): Promise<StoredFileMeta> {
    const buffer = await file.arrayBuffer();
    const { cipher, iv } = await this.crypto.encrypt(buffer);
    const encName = await this.crypto.encryptText(file.name, iv);

    const form = new FormData();
    form.append('file', new Blob([cipher]), 'blob');
    form.append('iv', iv);
    form.append('encName', encName);

    const response = await new Promise<FileUploadResponse>((resolve, reject) => {
      this.http
        .post<FileUploadResponse>(`${this.baseUrl}/upload`, form, {
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

    const meta: StoredFileMeta = {
      id: response.id,
      name: file.name,
      size: file.size,
      iv,
      uploadedAt: Date.now(),
    };
    this.files.update((list) => [meta, ...list]);
    this.persist();
    return meta;
  }

  async download(meta: StoredFileMeta): Promise<void> {
    const cipher = await new Promise<ArrayBuffer>((resolve, reject) => {
      this.http
        .get(`${this.baseUrl}/download/${meta.id}`, { responseType: 'arraybuffer' })
        .subscribe({ next: resolve, error: reject });
    });

    const plain = await this.crypto.decrypt(cipher, meta.iv);
    const url = URL.createObjectURL(new Blob([plain]));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = meta.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  removeFromList(id: string): void {
    this.files.update((list) => list.filter((f) => f.id !== id));
    this.persist();
  }

  private persist(): void {
    if (this.isBrowser) {
      localStorage.setItem(INDEX_KEY, JSON.stringify(this.files()));
    }
  }

  private readIndex(): StoredFileMeta[] {
    if (!this.isBrowser) {
      return [];
    }
    try {
      return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as StoredFileMeta[];
    } catch {
      return [];
    }
  }
}
