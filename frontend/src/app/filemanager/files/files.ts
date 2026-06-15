import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SideNavbar } from '../side-navbar/side-navbar';
import { FileService } from '../../core/files/file.service';
import { FolderService } from '../../core/files/folder.service';
import { StoredFileMeta, FolderResponse } from '../../core/files/file.models';
import { formatBytes } from '../../core/files/format';

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

  protected readonly downloadingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly format = formatBytes;

  ngOnInit(): void {
    this.navigateTo(null);
  }

  async navigateTo(folderId: string | null): Promise<void> {
    this.error.set(null);
    try {
      await this.folderService.loadFolderContent(folderId);
    } catch (err) {
      this.error.set('Failed to load folder content.');
    }
  }

  async createNewFolder(): Promise<void> {
    const name = prompt('Enter folder name:');
    if (name) {
      try {
        await this.folderService.createFolder(name, this.folderService.currentFolderId());
      } catch (err) {
        alert('Failed to create folder.');
      }
    }
  }

  async deleteFolder(id: string): Promise<void> {
    if (confirm('Are you sure you want to delete this folder and all its content?')) {
      try {
        await this.folderService.deleteFolder(id);
      } catch (err) {
        alert('Failed to delete folder.');
      }
    }
  }

  async download(meta: StoredFileMeta): Promise<void> {
    if (this.downloadingId()) return;
    this.error.set(null);
    this.downloadingId.set(meta.id);
    try {
      await this.fileService.download(meta);
    } catch (err) {
      this.error.set('Decryption or download failed');
    } finally {
      this.downloadingId.set(null);
    }
  }

  async removeFile(meta: StoredFileMeta): Promise<void> {
    if (confirm(`Are you sure you want to delete ${meta.name}?`)) {
      try {
        await this.fileService.delete(meta.id);
      } catch (err) {
        alert('Failed to delete file.');
      }
    }
  }
}
