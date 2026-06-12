import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Client-side AES-GCM encryption. The encryption key (DEK) is derived from the user's
 * password and stored only in memory during the session.
 */
@Injectable({ providedIn: 'root' })
export class CryptoService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  
  // The Data Encryption Key (DEK) kept in memory during the session.
  private currentDek: CryptoKey | null = null;

  /**
   * Encrypts a file's data using the session DEK.
   */
  async encrypt(data: ArrayBuffer): Promise<{ cipher: ArrayBuffer; iv: string }> {
    const key = this.getRequiredKey();
    const ivBytes = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, key, data);
    return { cipher, iv: this.toBase64(ivBytes) };
  }

  /**
   * Decrypts a file's data using the session DEK.
   */
  async decrypt(cipher: ArrayBuffer, iv: string): Promise<ArrayBuffer> {
    const key = this.getRequiredKey();
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.fromBase64(iv) }, key, cipher);
  }

  /**
   * Phase 2 Support: Generates everything needed for a new user registration.
   */
  async setupRegistrationKeys(password: string): Promise<{
    encryptedDek: string;
    iv: string;
    salt: string;
  }> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const dek = await this.generateDEK();
    const kek = await this.deriveKEK(password, salt);
    
    const { encryptedDek, iv } = await this.encryptDEK(dek, kek);
    
    // Store in memory for immediate use after registration
    this.currentDek = dek;
    
    return {
      encryptedDek,
      iv,
      salt: this.toBase64(salt)
    };
  }

  /**
   * Phase 3 Support: Decrypts the DEK after a successful login.
   */
  async setupLoginKeys(password: string, encryptedDek: string, iv: string, salt: string): Promise<void> {
    const saltBytes = this.fromBase64(salt);
    const kek = await this.deriveKEK(password, saltBytes);
    this.currentDek = await this.decryptDEK(encryptedDek, iv, kek);
  }

  /**
   * Clears the key from memory on logout.
   */
  clearSession(): void {
    this.currentDek = null;
  }

  /**
   * Whether a DEK is loaded in memory (i.e. the user can encrypt/decrypt).
   */
  hasSession(): boolean {
    return this.currentDek !== null;
  }

  /**
   * Encrypts a file/folder name. The per-name IV is embedded in the returned
   * string (`iv:ciphertext`) so it is self-contained.
   */
  async encryptName(name: string): Promise<string> {
    const data = new TextEncoder().encode(name);
    const { cipher, iv } = await this.encrypt(data.buffer as ArrayBuffer);
    return `${iv}:${this.toBase64(new Uint8Array(cipher))}`;
  }

  /**
   * Decrypts a name produced by {@link encryptName}.
   */
  async decryptName(encName: string): Promise<string> {
    const sep = encName.indexOf(':');
    if (sep === -1) {
      return encName;
    }
    const iv = encName.slice(0, sep);
    const cipher = this.fromBase64(encName.slice(sep + 1));
    const plain = await this.decrypt(cipher.buffer as ArrayBuffer, iv);
    return new TextDecoder().decode(plain);
  }

  private getRequiredKey(): CryptoKey {
    if (!this.currentDek) {
      throw new Error('Encryption key not initialized. Please log in.');
    }
    return this.currentDek;
  }

  private async generateDEK(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // must be extractable for wrapKey
      ['encrypt', 'decrypt']
    );
  }

  private async deriveKEK(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBytes,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, // KEK is never extractable
      ['wrapKey', 'unwrapKey']
    );
  }

  private async encryptDEK(dek: CryptoKey, kek: CryptoKey): Promise<{ encryptedDek: string; iv: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrappedDek = await crypto.subtle.wrapKey(
      'raw',
      dek,
      kek,
      { name: 'AES-GCM', iv }
    );

    return {
      encryptedDek: this.toBase64(new Uint8Array(wrappedDek)),
      iv: this.toBase64(iv),
    };
  }

  private async decryptDEK(encryptedDek: string, iv: string, kek: CryptoKey): Promise<CryptoKey> {
    return crypto.subtle.unwrapKey(
      'raw',
      this.fromBase64(encryptedDek),
      kek,
      { name: 'AES-GCM', iv: this.fromBase64(iv) },
      { name: 'AES-GCM', length: 256 },
      false, // DEK stays in memory, not extractable
      ['encrypt', 'decrypt']
    );
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
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
