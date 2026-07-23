import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { SideNavbar } from '../side-navbar/side-navbar';
import { FileService } from '../../core/files/file.service';
import { FolderService } from '../../core/files/folder.service';
import { IStoredFileMeta } from '../../core/interfaces/IStoredFileMeta';
import { IFolderResponse } from '../../core/interfaces/IFolderResponse';
import { formatBytes } from '../../core/files/format';
import { CryptoService } from '../../core/crypto/crypto.service';

type MoveTarget =
  | { kind: 'file'; meta: IStoredFileMeta }
  | { kind: 'folder'; folder: IFolderResponse };

@Component({
  selector: 'app-files',
  standalone: true,
  imports: [SideNavbar, DatePipe],
  templateUrl: './files.html',
})
export class Files implements OnInit {
  private readonly fileService = inject(FileService);
  protected readonly folderService = inject(FolderService);
  private readonly crypto = inject(CryptoService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly files = this.folderService.currentFiles;
  protected readonly folders = this.folderService.currentFolders;
  protected readonly breadcrumbs = this.folderService.breadcrumbs;
  protected readonly currentFolderId = this.folderService.currentFolderId;

  protected readonly downloadingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly moving = signal<MoveTarget | null>(null);
  protected readonly format = formatBytes;

  // File Preview State
  protected readonly previewFile = signal<IStoredFileMeta | null>(null);
  protected readonly previewLoading = signal(false);
  protected readonly previewUrl = signal<any>(null);
  protected readonly previewTextContent = signal<string | null>(null);
  protected readonly previewType = signal<'image' | 'pdf' | 'text' | 'unsupported'>('unsupported');
  private previewRawUrl: string | null = null;

  // File Share State
  protected readonly sharingFile = signal<IStoredFileMeta | null>(null);
  protected readonly sharingLoading = signal(false);
  protected readonly sharingError = signal<string | null>(null);
  protected readonly sharingSuccess = signal(false);

  // Drag and Drop / Inline upload state
  protected readonly dragging = signal(false);
  protected readonly uploadingFile = signal(false);
  protected readonly uploadProgress = signal(0);
  protected readonly uploadFileName = signal('');
  private dragCounter = 0;

  // sharing
  protected readonly linkCopied = signal(false);

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

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    // Ignore internal item moves: only show the upload overlay for external files.
    if (event.dataTransfer?.types?.includes('application/json')) {
      return;
    }
    this.dragCounter++;
    this.dragging.set(true);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragCounter--;
    if (this.dragCounter <= 0) {
      this.dragCounter = 0;
      this.dragging.set(false);
    }
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragCounter = 0;
    this.dragging.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      await this.uploadFileList(event.dataTransfer.files);
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      await this.uploadFileList(input.files);
      input.value = '';
    }
  }

  private async uploadFileList(files: FileList): Promise<void> {
    this.uploadingFile.set(true);
    this.error.set(null);
    const folderId = this.currentFolderId();

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        this.uploadFileName.set(file.name);
        this.uploadProgress.set(0);

        await this.fileService.upload(file, folderId, (percent) => {
          this.uploadProgress.set(percent);
        });
      }
      // Refresh current folder contents
      await this.folderService.loadFolderContent(folderId);
    } catch (err) {
      console.error('File upload failed', err);
      this.error.set('One or more file uploads failed.');
    } finally {
      this.uploadingFile.set(false);
      this.uploadProgress.set(0);
      this.uploadFileName.set('');
    }
  }

  // --- Internal Item Drag and Drop (Move) ---

  onItemDragStart(event: DragEvent, kind: 'file' | 'folder', id: string): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/json', JSON.stringify({ kind, id }));
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onFolderDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  async onItemDrop(event: DragEvent, targetFolderId: string | null): Promise<void> {
    event.preventDefault();
    // Stop the move drop from bubbling up to the page-level upload handler.
    event.stopPropagation();
    this.dragCounter = 0;
    this.dragging.set(false);
    const dataStr = event.dataTransfer?.getData('application/json');
    if (!dataStr) return;
    try {
      const { kind, id } = JSON.parse(dataStr);
      if (kind === 'file') {
        await this.fileService.move(id, targetFolderId);
      } else if (kind === 'folder') {
        if (id === targetFolderId) return; // Prevent moving into itself
        await this.folderService.moveFolder(id, targetFolderId);
      }
      // Refresh so the moved item disappears from the current view immediately.
      await this.folderService.loadFolderContent(this.currentFolderId());
    } catch (err) {
      console.error('Failed to move item via drag and drop', err);
      this.error.set('Failed to move item.');
    }
  }

  // --- File Previews ---

  async openPreview(file: IStoredFileMeta): Promise<void> {
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
      const decryptedBuffer = await this.fileService.downloadAndDecryptRaw(file.id, file.iv, file.wrappedDek, file.dekIv);
      
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

  async renameFolder(folder: IFolderResponse): Promise<void> {
    const name = prompt('New folder name:', folder.name)?.trim();
    if (!name || name === folder.name) return;
    try {
      await this.folderService.renameFolder(folder.id, name);
    } catch {
      this.error.set('Failed to rename folder.');
    }
  }

  async deleteFolder(folder: IFolderResponse): Promise<void> {
    if (!confirm(`Delete folder "${folder.name}" and all its content?`)) return;
    try {
      await this.folderService.deleteFolder(folder.id);
    } catch {
      this.error.set('Failed to delete folder.');
    }
  }

  // --- Files ---

  async download(meta: IStoredFileMeta): Promise<void> {
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

  async renameFile(meta: IStoredFileMeta): Promise<void> {
    const name = prompt('New file name:', meta.name)?.trim();
    if (!name || name === meta.name) return;
    try {
      await this.fileService.rename(meta, name);
    } catch {
      this.error.set('Failed to rename file.');
    }
  }

  async removeFile(meta: IStoredFileMeta): Promise<void> {
    if (!confirm(`Delete "${meta.name}"?`)) return;
    try {
      await this.fileService.delete(meta.id);
    } catch {
      this.error.set('Failed to delete file.');
    }
  }

  shareFile(meta: IStoredFileMeta): void {
    this.sharingFile.set(meta);
    this.sharingLoading.set(false);
    this.sharingError.set(null);
    this.sharingSuccess.set(false);
  }

  closeShare(): void {
    this.sharingFile.set(null);
  }

  async confirmEmailShare(file: IStoredFileMeta, email: string): Promise<void> {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    this.sharingLoading.set(true);
    this.sharingError.set(null);
    this.sharingSuccess.set(false);

    try {
      // get the recipient's public key
      const publicKey = await this.fileService.getPublicKey(trimmedEmail);
      // unlock the file key and encrypt it only for the recipient
      const fileKey = await this.crypto.unwrapFileKey(file.wrappedDek, file.dekIv)
      const encryptedKey = await this.crypto.encryptKeyForRecipient(fileKey, publicKey)
      // share
      await this.fileService.shareByEmail(file.id, trimmedEmail, encryptedKey)
      this.sharingSuccess.set(true);
    } catch (err: any) {
      console.error('Failed to share file by email', err);
      const errMsg = err?.error?.message || 'Failed to share file. Make sure the email is registered.';
      this.sharingError.set(errMsg);
    } finally {
      this.sharingLoading.set(false);
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
  protected moveDestinations(): IFolderResponse[] {
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

  async publishFile(meta: IStoredFileMeta): Promise<void> {
    try {
      const token = await this.fileService.publish(meta.id)
      const rawKey = await this.crypto.getFileKeyBase64(meta.wrappedDek, meta.dekIv)
      const link = `${window.location.origin}/share?token=${token}`
        + `&name=${encodeURIComponent(meta.encName)}`
        + `&iv=${encodeURIComponent(meta.iv)}`
        + `#${rawKey}`;
        // feedback
      await navigator.clipboard.writeText(link);
      this.linkCopied.set(true)
      setTimeout(() => this.linkCopied.set(false), 2000)
    } catch (error) {
      this.error.set('Failed to create public link')
    }
  }

  async unpublishFile(meta: IStoredFileMeta): Promise<void> {
    try {
      await this.fileService.unpublish(meta.id)
    } catch (error) {
      this.error.set('Failed to remove public link')
    }
  }
}
