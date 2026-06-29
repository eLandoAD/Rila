import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CryptoService } from '../core/crypto/crypto.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-share',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './share.html',
})
export class ShareComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly crypto = inject(CryptoService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly fileId = signal<string | null>(null);
  readonly encName = signal<string | null>(null);
  readonly iv = signal<string | null>(null);
  readonly rawDek = signal<string | null>(null);

  readonly fileName = signal<string>('Secure Encrypted File');
  readonly loading = signal(false);
  readonly decrypting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const params = this.route.snapshot.queryParamMap;
    // il link pubblico ora usa il "token" di condivisione, non l'id del file
    const token = params.get('token');
    const name = params.get('name');
    const iv = params.get('iv');
    const hash = window.location.hash ? window.location.hash.substring(1) : null;

    if (!token || !name || !iv || !hash) {
      this.error.set('Invalid or incomplete secure sharing link.');
      return;
    }

    this.fileId.set(token);
    this.encName.set(name);
    this.iv.set(iv);
    this.rawDek.set(hash);

    this.decryptFileName();
  }

  private async decryptFileName(): Promise<void> {
    try {
      const name = this.encName();
      const iv = this.iv();
      const rawDek = this.rawDek();
      if (!name || !iv || !rawDek) return;

      const key = await this.crypto.importRawDek(rawDek);
      const decName = await this.crypto.decryptTextWithKey(name, iv, key);
      this.fileName.set(decName);
    } catch (err) {
      console.error('Failed to decrypt filename', err);
      // We don't block the download page, just fallback to default filename
    }
  }

  async downloadAndDecrypt(): Promise<void> {
    const id = this.fileId();
    const iv = this.iv();
    const rawDek = this.rawDek();
    const defaultName = this.fileName();

    if (!id || !iv || !rawDek) {
      this.error.set('Missing security metadata for decryption.');
      return;
    }

    this.loading.set(true);
    this.decrypting.set(false);
    this.error.set(null);
    this.success.set(false);

    try {
      // 1. Download the public raw cipher bytes
      const url = `${environment.apiBaseUrl}/files/public/${id}`;
      const cipherBytes = await this.http.get(url, { responseType: 'arraybuffer' }).toPromise();
      
      if (!cipherBytes) {
        throw new Error('No data received from server.');
      }

      this.loading.set(false);
      this.decrypting.set(true);

      // 2. Decrypt the file using the imported DEK
      const key = await this.crypto.importRawDek(rawDek);
      const plainBytes = await this.crypto.decryptWithKey(cipherBytes, iv, key);

      // 3. Trigger local file download
      const blob = new Blob([plainBytes], { type: 'application/octet-stream' });
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = defaultName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      this.decrypting.set(false);
      this.success.set(true);
    } catch (err: any) {
      console.error('Download/Decryption failed', err);
      this.loading.set(false);
      this.decrypting.set(false);
      this.error.set(
        'Decryption failed. The link might be corrupted or the key is invalid.'
      );
    }
  }
}
