import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SideNavbar } from '../side-navbar/side-navbar';
import { FileService } from '../../core/files/file.service';
import { StoredFileMeta } from '../../core/files/file.models';
import { formatBytes } from '../../core/files/format';

@Component({
  selector: 'app-files',
  imports: [SideNavbar, RouterLink, DatePipe],
  templateUrl: './files.html',
  styleUrl: './files.css',
})
export class Files {
  private readonly fileService = inject(FileService);

  protected readonly files = this.fileService.files;
  protected readonly downloadingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly format = formatBytes;

  async download(meta: StoredFileMeta): Promise<void> {
    if (this.downloadingId()) {
      return;
    }
    this.error.set(null);
    this.downloadingId.set(meta.id);
    try {
      await this.fileService.download(meta);
    } catch (err) {
      this.error.set(
        err instanceof HttpErrorResponse
          ? (err.error?.message ?? `Download failed (${err.status})`)
          : 'Decryption or download failed',
      );
    } finally {
      this.downloadingId.set(null);
    }
  }

  remove(meta: StoredFileMeta): void {
    this.fileService.removeFromList(meta.id);
  }
}
