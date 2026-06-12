import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SideNavbar } from '../side-navbar/side-navbar';
import { FileService } from '../../core/files/file.service';
import { FileItem, FolderItem } from '../../core/files/file.models';
import { formatBytes } from '../../core/files/format';

interface MoveTarget {
  id: string | null;
  name: string;
  depth: number;
}

interface MoveState {
  kind: 'file' | 'folder';
  id: string;
  name: string;
  targets: MoveTarget[];
}

@Component({
  selector: 'app-files',
  imports: [SideNavbar, RouterLink, DatePipe],
  templateUrl: './files.html',
  styleUrl: './files.css',
})
export class Files implements OnInit {
  private readonly fileService = inject(FileService);

  protected readonly folders = this.fileService.folders;
  protected readonly files = this.fileService.files;
  protected readonly breadcrumbs = this.fileService.breadcrumbs;
  protected readonly locked = this.fileService.locked;

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly uploadProgress = signal<number | null>(null);
  protected readonly move = signal<MoveState | null>(null);

  protected readonly format = formatBytes;

  ngOnInit(): void {
    void this.load(null);
  }

  async load(folderId: string | null): Promise<void> {
    this.error.set(null);
    try {
      await this.fileService.loadFolder(folderId);
    } catch (err) {
      this.report(err);
    }
  }

  // --- folders ---

  async createFolder(): Promise<void> {
    const name = prompt('New folder name')?.trim();
    if (!name) {
      return;
    }
    await this.run(() => this.fileService.createFolder(name));
  }

  async renameFolder(folder: FolderItem): Promise<void> {
    const name = prompt('Rename folder', folder.name)?.trim();
    if (!name || name === folder.name) {
      return;
    }
    await this.run(() => this.fileService.renameFolder(folder.id, name));
  }

  async deleteFolder(folder: FolderItem): Promise<void> {
    if (!confirm(`Delete folder "${folder.name}" and everything inside it?`)) {
      return;
    }
    await this.run(() => this.fileService.deleteFolder(folder.id));
  }

  // --- files ---

  async onUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    try {
      for (const file of Array.from(files)) {
        this.uploadProgress.set(0);
        await this.fileService.upload(file, (p) => this.uploadProgress.set(p));
      }
      await this.fileService.loadFolder(this.fileService.currentFolderId());
    } catch (err) {
      this.report(err);
    } finally {
      this.uploadProgress.set(null);
      this.busy.set(false);
      input.value = '';
    }
  }

  async download(file: FileItem): Promise<void> {
    await this.run(() => this.fileService.download(file));
  }

  async renameFile(file: FileItem): Promise<void> {
    const name = prompt('Rename file', file.name)?.trim();
    if (!name || name === file.name) {
      return;
    }
    await this.run(() => this.fileService.renameFile(file.id, name));
  }

  async deleteFile(file: FileItem): Promise<void> {
    if (!confirm(`Delete "${file.name}"?`)) {
      return;
    }
    await this.run(() => this.fileService.deleteFile(file.id));
  }

  // --- move ---

  async openMove(kind: 'file' | 'folder', item: FileItem | FolderItem): Promise<void> {
    this.error.set(null);
    try {
      const all = await this.fileService.listAllFolders();
      const targets: MoveTarget[] = [
        { id: null, name: 'Root', depth: 0 },
        ...all
          // a folder cannot be moved into itself
          .filter((f) => !(kind === 'folder' && f.id === item.id))
          .map((f) => ({ id: f.id, name: f.name, depth: f.depth + 1 })),
      ];
      this.move.set({ kind, id: item.id, name: item.name, targets });
    } catch (err) {
      this.report(err);
    }
  }

  async confirmMove(targetId: string | null): Promise<void> {
    const state = this.move();
    if (!state) {
      return;
    }
    this.move.set(null);
    await this.run(() =>
      state.kind === 'file'
        ? this.fileService.moveFile(state.id, targetId)
        : this.fileService.moveFolder(state.id, targetId),
    );
  }

  closeMove(): void {
    this.move.set(null);
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      await action();
    } catch (err) {
      this.report(err);
    } finally {
      this.busy.set(false);
    }
  }

  private report(err: unknown): void {
    this.error.set(
      err instanceof HttpErrorResponse
        ? (err.error?.message ?? `Request failed (${err.status})`)
        : err instanceof Error
          ? err.message
          : 'Something went wrong',
    );
  }
}
