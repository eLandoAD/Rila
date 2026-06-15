import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SideNavbar } from '../side-navbar/side-navbar';
import { FileService } from '../../core/files/file.service';
import { FolderService } from '../../core/files/folder.service';
import { StoredFileMeta, FolderResponse } from '../../core/files/file.models';
import { formatBytes } from '../../core/files/format';

type MoveTarget =
  | { kind: 'file'; meta: StoredFileMeta }
  | { kind: 'folder'; folder: FolderResponse };

@Component({
  selector: 'app-files',
  standalone: true,
  imports: [SideNavbar, RouterLink, DatePipe],
  templateUrl: './files.html',
  styleUrl: './files.css',
})
export class Files implements OnInit {
  private readonly fileService = inject(FileService);
  protected readonly folderService = inject(FolderService);

  protected readonly files = this.folderService.currentFiles;
  protected readonly folders = this.folderService.currentFolders;
  protected readonly breadcrumbs = this.folderService.breadcrumbs;
  protected readonly currentFolderId = this.folderService.currentFolderId;

  protected readonly downloadingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly moving = signal<MoveTarget | null>(null);
  protected readonly format = formatBytes;

  ngOnInit(): void {
    this.navigateTo(null);
  }

  async navigateTo(folderId: string | null): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.folderService.loadFolderContent(folderId);
    } catch {
      this.error.set('Failed to load folder content.');
    } finally {
      this.loading.set(false);
    }
  }

  // --- Folders ---

  async createNewFolder(): Promise<void> {
    const name = prompt('Folder name:')?.trim();
    if (!name) return;
    try {
      await this.folderService.createFolder(name, this.currentFolderId());
    } catch {
      this.error.set('Failed to create folder.');
    }
  }

  async renameFolder(folder: FolderResponse): Promise<void> {
    const name = prompt('New folder name:', folder.name)?.trim();
    if (!name || name === folder.name) return;
    try {
      await this.folderService.renameFolder(folder.id, name);
    } catch {
      this.error.set('Failed to rename folder.');
    }
  }

  async deleteFolder(folder: FolderResponse): Promise<void> {
    if (!confirm(`Delete folder "${folder.name}" and all its content?`)) return;
    try {
      await this.folderService.deleteFolder(folder.id);
    } catch {
      this.error.set('Failed to delete folder.');
    }
  }

  // --- Files ---

  async download(meta: StoredFileMeta): Promise<void> {
    if (this.downloadingId()) return;
    this.error.set(null);
    this.downloadingId.set(meta.id);
    try {
      await this.fileService.download(meta);
    } catch {
      this.error.set('Decryption or download failed.');
    } finally {
      this.downloadingId.set(null);
    }
  }

  async renameFile(meta: StoredFileMeta): Promise<void> {
    const name = prompt('New file name:', meta.name)?.trim();
    if (!name || name === meta.name) return;
    try {
      await this.fileService.rename(meta, name);
    } catch {
      this.error.set('Failed to rename file.');
    }
  }

  async removeFile(meta: StoredFileMeta): Promise<void> {
    if (!confirm(`Delete "${meta.name}"?`)) return;
    try {
      await this.fileService.delete(meta.id);
    } catch {
      this.error.set('Failed to delete file.');
    }
  }

  // --- Move (files & folders) ---

  openMove(target: MoveTarget): void {
    this.moving.set(target);
  }

  closeMove(): void {
    this.moving.set(null);
  }

  /** Folders shown as destinations: subfolders of the current view, minus the one being moved. */
  protected moveDestinations(): FolderResponse[] {
    const t = this.moving();
    return this.folders().filter((f) => !(t?.kind === 'folder' && f.id === t.folder.id));
  }

  async confirmMove(targetFolderId: string | null): Promise<void> {
    const t = this.moving();
    if (!t) return;
    this.closeMove();
    try {
      if (t.kind === 'file') {
        await this.fileService.move(t.meta.id, targetFolderId);
      } else {
        await this.folderService.moveFolder(t.folder.id, targetFolderId);
      }
    } catch {
      this.error.set('Move failed.');
    }
  }
}
