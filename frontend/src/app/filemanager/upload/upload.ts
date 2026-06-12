import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SideNavbar } from '../side-navbar/side-navbar';
import { FileService } from '../../core/files/file.service';
import { formatBytes } from '../../core/files/format';

interface UploadItem {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

@Component({
  selector: 'app-upload',
  imports: [SideNavbar],
  templateUrl: './upload.html',
  styleUrl: './upload.css',
})
export class Upload {
  private readonly fileService = inject(FileService);
  private readonly router = inject(Router);

  protected readonly items = signal<UploadItem[]>([]);
  protected readonly dragging = signal(false);
  protected readonly uploading = signal(false);

  protected readonly format = formatBytes;

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(input.files);
      input.value = '';
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (event.dataTransfer?.files) {
      this.addFiles(event.dataTransfer.files);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
  }

  remove(index: number): void {
    this.items.update((list) => list.filter((_, i) => i !== index));
  }

  async uploadAll(): Promise<void> {
    if (this.uploading()) {
      return;
    }
    this.uploading.set(true);

    for (const item of this.items()) {
      if (item.status === 'done') {
        continue;
      }
      this.patch(item, { status: 'uploading', progress: 0, error: undefined });
      try {
        await this.fileService.upload(item.file, (percent) =>
          this.patch(item, { progress: percent }),
        );
        this.patch(item, { status: 'done', progress: 100 });
      } catch (err) {
        const message =
          err instanceof HttpErrorResponse
            ? (err.error?.message ?? `Upload failed (${err.status})`)
            : 'Encryption or upload failed';
        this.patch(item, { status: 'error', error: message });
      }
    }

    this.uploading.set(false);
  }

  goToFiles(): void {
    this.router.navigateByUrl('/filemanager/files');
  }

  private addFiles(files: FileList): void {
    const incoming: UploadItem[] = Array.from(files).map((file) => ({
      file,
      progress: 0,
      status: 'pending',
    }));
    this.items.update((list) => [...list, ...incoming]);
  }

  private patch(item: UploadItem, changes: Partial<UploadItem>): void {
    Object.assign(item, changes);
    // refresh the signal with a new array reference so the view updates
    this.items.update((list) => [...list]);
  }
}
