import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Client-side AES-GCM encryption. The encryption key (DEK) is derived from the user's
 * password or a recovery key and stored only in memory during the session.
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
   * Encrypts a small string (like a filename) using the session DEK.
   */
  async encryptText(text: string, iv: string): Promise<string> {
    const key = this.getRequiredKey();
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: this.fromBase64(iv) as any },
      key,
      new TextEncoder().encode(text)
    );
    return this.toBase64(new Uint8Array(cipher));
  }

  /**
   * Decrypts a file's data using the session DEK.
   */
  async decrypt(cipher: ArrayBuffer, iv: string): Promise<ArrayBuffer> {
    const key = this.getRequiredKey();
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.fromBase64(iv) as any }, key, cipher);
  }

  /**
   * Decrypts a small string (like a filename) using the session DEK.
   */
  async decryptText(encText: string, iv: string): Promise<string> {
    const key = this.getRequiredKey();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.fromBase64(iv) as any },
      key,
      this.fromBase64(encText) as unknown as Uint8Array<ArrayBuffer>
    );
    return new TextDecoder().decode(plain);
  }

  /**
   * Support for Registration: Generates everything needed including a Recovery Key.
   */
  async setupRegistrationKeys(password: string): Promise<{
    encryptedDek: string;
    iv: string;
    salt: string;
    recoveryKey: string;
    recoveryEncryptedDek: string;
    recoveryDekIv: string;
  }> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const dek = await this.generateDEK();
    
    // 1. Password-based KEK
    const kek = await this.deriveKEK(password, salt);
    const { encryptedDek, iv } = await this.encryptDEK(dek, kek);
    
    // 2. Recovery Key-based KEK
    const recoveryKey = this.generateRecoveryKeyString();
    const emergencyKek = await this.deriveKEK(recoveryKey, salt); // same salt for simplicity
    const { encryptedDek: recoveryEncDek, iv: recoveryIv } = await this.encryptDEK(dek, emergencyKek);

    this.currentDek = dek;
    
    return {
      encryptedDek,
      iv,
      salt: this.toBase64(salt),
      recoveryKey,
      recoveryEncryptedDek: recoveryEncDek,
      recoveryDekIv: recoveryIv
    };
  }

  /**
   * Support for Login: Decrypts the DEK using the password.
   */
  async setupLoginKeys(password: string, encryptedDek: string, iv: string, salt: string): Promise<void> {
    const saltBytes = this.fromBase64(salt);
    const kek = await this.deriveKEK(password, saltBytes);
    this.currentDek = await this.decryptDEK(encryptedDek, iv, kek);
  }

  /**
   * Support for Reset/Recovery: Decrypts the DEK using the Recovery Key and re-encrypts with new password.
   */
  async setupRecoveryKeys(recoveryKey: string, recoveryEncryptedDek: string, recoveryDekIv: string, salt: string, newPassword: string): Promise<{
    newEncryptedDek: string;
    newDekIv: string;
  }> {
    const saltBytes = this.fromBase64(salt);
    
    // 1. Decrypt original DEK with Recovery Key
    const emergencyKek = await this.deriveKEK(recoveryKey, saltBytes);
    const dek = await this.decryptDEK(recoveryEncryptedDek, recoveryDekIv, emergencyKek);
    
    // 2. Re-encrypt original DEK with New Password
    const newKek = await this.deriveKEK(newPassword, saltBytes);
    const { encryptedDek: newEncDek, iv: newIv } = await this.encryptDEK(dek, newKek);
    
    this.currentDek = dek;
    return {
      newEncryptedDek: newEncDek,
      newDekIv: newIv
    };
  }

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
      true, // must be extractable for wrap/unwrap
      ['encrypt', 'decrypt']
    );
  }

  private async deriveKEK(secret: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(secret);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as any,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
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
      this.fromBase64(encryptedDek) as any,
      kek,
      { name: 'AES-GCM', iv: this.fromBase64(iv) as any },
      { name: 'AES-GCM', length: 256 },
      true, // extractable = true for public link sharing
      ['encrypt', 'decrypt']
    );
  }

  async getRawDek(): Promise<string> {
    const key = this.getRequiredKey();
    const raw = await crypto.subtle.exportKey('raw', key);
    return this.toBase64(new Uint8Array(raw));
  }

  async importRawDek(b64Key: string): Promise<CryptoKey> {
    const rawBytes = this.fromBase64(b64Key);
    return crypto.subtle.importKey(
      'raw',
      rawBytes,
      'AES-GCM',
      false,
      ['decrypt']
    );
  }

  async decryptWithKey(cipher: ArrayBuffer, iv: string, key: CryptoKey): Promise<ArrayBuffer> {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.fromBase64(iv) as any }, key, cipher);
  }

  async decryptTextWithKey(encText: string, iv: string, key: CryptoKey): Promise<string> {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.fromBase64(iv) as any },
      key,
      this.fromBase64(encText) as unknown as Uint8Array<ArrayBuffer>
    );
    return new TextDecoder().decode(plain);
  }

  private generateRecoveryKeyString(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    let key = 'SV-';
    for (let i = 0; i < bytes.length; i++) {
      if (i > 0 && i % 4 === 0) key += '-';
      key += alphabet[bytes[i] % alphabet.length];
    }
    return key;
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
