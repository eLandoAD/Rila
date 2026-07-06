import { Component, inject, signal, OnInit, WritableSignal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { SideNavbar } from '../side-navbar/side-navbar';
import { FileService } from '../../core/files/file.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { formatBytes } from '../../core/files/format';

@Component({
  selector: 'app-shared',
  standalone: true,
  imports: [SideNavbar, DatePipe],
  templateUrl: './shared.html',
})
export class Shared implements OnInit {
  private readonly fileService = inject(FileService);
  private readonly crypto = inject(CryptoService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly sharedFiles: WritableSignal<any[]> = signal([]);
  protected readonly loading: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly format = formatBytes;

  protected readonly downloadingId: WritableSignal<string | null> = signal(null);

  // stati preview 
  protected readonly previewFile: WritableSignal<any | null> = signal(null);
  protected readonly previewLoading: WritableSignal<boolean> = signal(false);
  protected readonly previewUrl: WritableSignal<any> = signal(null);
  protected readonly previewTextContent: WritableSignal<string | null> = signal(null);
  protected readonly previewType: WritableSignal<'image' | 'pdf' | 'text' | 'unsupported'> = signal('unsupported');
  private previewRawUrl: string | null = null;

  ngOnInit(): void {
    this.loadSharedFiles();
  }

  async loadSharedFiles(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.fileService.getSharedFiles();
      const files = await Promise.all(
        res.map(async (sf) => {
          let decName = 'Decryption Failed';
          let fileKey: CryptoKey | null = null;
          try {
            // decifro la chiave del file con la mia privata, 1 volta
            fileKey = await this.crypto.decryptSharedKey(sf.dek)
            decName = await this.crypto.decryptNameWithKey(sf.encName, fileKey);
          } catch (err) {
            console.error('Failed to decrypt shared file key/name', err);
          }
          return {
            id: sf.id,
            fileId: sf.fileId,
            name: decName,
            size: sf.fileSize,
            uploadedAt: sf.createdAt,
            iv: sf.iv,
            senderEmail: sf.senderEmail,
            senderUsername: sf.senderUsername,
            fileKey,   
          };
        })
      );
      this.sharedFiles.set(files);
    } catch (err) {
      console.error('Failed to load shared files', err);
      this.error.set('Failed to load shared files.');
    } finally {
      this.loading.set(false);
    }
  }

  async download(file: any): Promise<void> {
    if (this.downloadingId()) return;
    this.error.set(null);
    this.downloadingId.set(file.id);
    try {
      const cipher = await this.fileService.downloadRaw(file.fileId);
      if (!file.fileKey) throw new Error('Chiave del file non disponibile');
      const plain = await this.crypto.decryptWithKey(cipher, file.iv, file.fileKey);

      const url = URL.createObjectURL(new Blob([plain]));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download shared file', err);
      this.error.set('Failed to decrypt or download file.');
    } finally {
      this.downloadingId.set(null);
    }
  }

  async removeShared(file: any): Promise<void> {
    if (!confirm(`Remove "${file.name}" from your shared files?`)) return;
    try {
      await this.fileService.removeSharedFile(file.id);
      await this.loadSharedFiles();
    } catch (err) {
      console.error('Failed to remove shared file', err);
      this.error.set('Failed to remove shared file.');
    }
  }

  // --- Preview Logic ---
  async openPreview(file: any): Promise<void> {
    this.closePreview();
    this.previewFile.set(file);
    this.previewLoading.set(true);
    this.error.set(null);

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    let type: 'image' | 'pdf' | 'text' | 'unsupported' = 'unsupported';
    let mimeType = 'application/octet-stream';

    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
      type = 'image';
      mimeType = ext === '.svg' ? 'image/svg+xml' : `image/${ext.substring(1)}`;
    } else if (ext === '.pdf') {
      type = 'pdf';
      mimeType = 'application/pdf';
    } else if (['.txt', '.md', '.json', '.js', '.ts', '.html', '.css', '.xml', '.csv'].includes(ext)) {
      type = 'text';
    }

    this.previewType.set(type);

    try {
      const cipher = await this.fileService.downloadRaw(file.fileId);
      if (!file.fileKey) throw new Error('Chiave del file non disponibile');
      const decryptedBuffer = await this.crypto.decryptWithKey(cipher, file.iv, file.fileKey);

      if (type === 'text') {
        const text = new TextDecoder().decode(decryptedBuffer);
        this.previewTextContent.set(text);
      } else if (type === 'pdf') {
        const blob = new Blob([decryptedBuffer], { type: mimeType });
        const rawUrl = URL.createObjectURL(blob);
        this.previewRawUrl = rawUrl;
        const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
        this.previewUrl.set(safeUrl);
      } else if (type === 'image') {
        const blob = new Blob([decryptedBuffer], { type: mimeType });
        const rawUrl = URL.createObjectURL(blob);
        this.previewRawUrl = rawUrl;
        this.previewUrl.set(rawUrl);
      }
    } catch (err) {
      console.error('Failed to generate preview', err);
      this.error.set('Failed to decrypt and load file preview.');
      this.closePreview();
    } finally {
      this.previewLoading.set(false);
    }
  }

  closePreview(): void {
    const url = this.previewRawUrl;
    if (url) {
      URL.revokeObjectURL(url);
      this.previewRawUrl = null;
    }
    this.previewFile.set(null);
    this.previewUrl.set(null);
    this.previewTextContent.set(null);
    this.previewType.set('unsupported');
    this.previewLoading.set(false);
  }
}
