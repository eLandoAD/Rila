import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const KEY_STORAGE = 'sv_enc_key';

/**
 * Client-side AES-GCM encryption. The encryption key never leaves the browser,
 * so the server only ever sees ciphertext (end-to-end encryption).
 */
@Injectable({ providedIn: 'root' })
export class CryptoService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private keyPromise: Promise<CryptoKey> | null = null;

  async encrypt(data: ArrayBuffer): Promise<{ cipher: ArrayBuffer; iv: string }> {
    const key = await this.getKey();
    const ivBytes = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, key, data);
    return { cipher, iv: this.toBase64(ivBytes) };
  }

  async encryptText(text: string, iv: string): Promise<string> {
    const key = await this.getKey();
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: this.fromBase64(iv) },
      key,
      new TextEncoder().encode(text),
    );
    return this.toBase64(new Uint8Array(cipher));
  }

  async decrypt(cipher: ArrayBuffer, iv: string): Promise<ArrayBuffer> {
    const key = await this.getKey();
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.fromBase64(iv) }, key, cipher);
  }

  private getKey(): Promise<CryptoKey> {
    if (!this.keyPromise) {
      this.keyPromise = this.loadOrCreateKey();
    }
    return this.keyPromise;
  }

  private async loadOrCreateKey(): Promise<CryptoKey> {
    if (!this.isBrowser) {
      throw new Error('Encryption is only available in the browser');
    }
    const stored = localStorage.getItem(KEY_STORAGE);
    if (stored) {
      return crypto.subtle.importKey('raw', this.fromBase64(stored), 'AES-GCM', true, [
        'encrypt',
        'decrypt',
      ]);
    }
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
    const raw = await crypto.subtle.exportKey('raw', key);
    localStorage.setItem(KEY_STORAGE, this.toBase64(new Uint8Array(raw)));
    return key;
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const b of bytes) {
      binary += String.fromCharCode(b);
    }
    return btoa(binary);
  }

  private fromBase64(b64: string): Uint8Array<ArrayBuffer> {
    const binary = atob(b64);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
