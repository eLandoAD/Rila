import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * encryption AES-GCM client-side. La dek viene derivata dalla password dell'utente
 * o da una recovery key e viene salvata in memoria solo durante la sessione
 */
@Injectable({ providedIn: 'root' })
export class CryptoService {
  // verifico sia un browser
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  
  // dek, tenuto in memoria solo durante la sessione
  private currentDek: CryptoKey | null = null;

  /**
   * dek persistente (raw, base64) così la sessione sopravvive ai ricaricamenti della pagina
   * o a problemi vari, come riavvi del server.
   * sta in sessionStorage, vive con la scheda, e non viene mai inviata al backend
   */
  private readonly DEK_STORAGE_KEY = 'sv_dek';

  /**
   * encripta dei dati usando la chiave dek
   */
  async encrypt(data: ArrayBuffer): Promise<{ cipher: ArrayBuffer; iv: string }> {
    // uso il metodo wrapper per prendermi la dek attuale
    const key = this.getRequiredKey();
    // genero l'iv casuale
    const ivBytes = crypto.getRandomValues(new Uint8Array(12));
    // applico cifratura
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, key, data);
    // ritorno cipher, iv + dek che ce l'ho sempre
    return { cipher, iv: this.toBase64(ivBytes) };
  }

  /**
   * encripta una piccola stringa usando dek, utile per il filename
   */
  async encryptText(text: string, iv: string): Promise<string> {
    // mi prendo la dek
    const key = this.getRequiredKey();
    // rispetto all'altro prendo l'iv come parametro
    // quindi genero direttamente cripto
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: this.fromBase64(iv) as any },
      key,
      new TextEncoder().encode(text)
    );
    // qua ritorno solo stringa, tanto ho gia l'iv
    return this.toBase64(new Uint8Array(cipher));
  }

  /**
   * decripta un file usando la dek
   */
  async decrypt(cipher: ArrayBuffer, iv: string): Promise<ArrayBuffer> {
    // prende la dek attuale
    const key = this.getRequiredKey();
    // ritorna il risultato decriptato, passando anche la dek e il testo
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.fromBase64(iv) as any }, key, cipher);
  }

  /**
   * decripta una piccola stringa (filename) usando la dek
   */
  async decryptText(encText: string, iv: string): Promise<string> {
    // solito 
    const key = this.getRequiredKey();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.fromBase64(iv) as any },
      key,
      this.fromBase64(encText) as unknown as Uint8Array<ArrayBuffer>
    );
    return new TextDecoder().decode(plain);
  }

  /**
   * supporto per la registrazione: genera tutto il necessario, compresa la recovery key everything 
   * ritorna una promise ocntenente le varie chiavi + iv
   */
  async setupRegistrationKeys(password: string): Promise<{
    encryptedDek: string;
    iv: string;
    salt: string;
    recoveryKey: string;
    recoveryEncryptedDek: string;
    recoveryDekIv: string;
  }> {
    // genero salt casuale, che viene poi mixato con la password
    const salt = crypto.getRandomValues(new Uint8Array(16));
    // genero un dek casuale
    const dek = await this.generateDEK();
    
    // kek, derivata da password e salt
    // obiettivo salt --> aumentare casualità
    // password + saltA -> key a
    // password + saltB -> key b
    const kek = await this.deriveKEK(password, salt);
    // mi prendo pure iv e dek criptato
    const { encryptedDek, iv } = await this.encryptDEK(dek, kek);
    
    // preparo la recovery key, basata sulla kek
    const recoveryKey = this.generateRecoveryKeyString();
    // uso lo stesso salt per semplicità
    const emergencyKek = await this.deriveKEK(recoveryKey, salt); 
    const { encryptedDek: recoveryEncDek, iv: recoveryIv } = await this.encryptDEK(dek, emergencyKek);

    this.currentDek = dek;
    await this.persistDek();

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
    await this.persistDek();
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
    await this.persistDek();
    return {
      newEncryptedDek: newEncDek,
      newDekIv: newIv
    };
  }

  clearSession(): void {
    this.currentDek = null;
    if (this.isBrowser) {
      sessionStorage.removeItem(this.DEK_STORAGE_KEY);
    }
  }

  /**
   * Persists the in-memory DEK (raw) to sessionStorage so a page reload or dev
   * server restart does not lose the ability to decrypt.
   */
  private async persistDek(): Promise<void> {
    if (!this.isBrowser || !this.currentDek) {
      return;
    }
    try {
      const raw = await crypto.subtle.exportKey('raw', this.currentDek);
      sessionStorage.setItem(this.DEK_STORAGE_KEY, this.toBase64(new Uint8Array(raw)));
    } catch {
      // exportKey may fail if the key is not extractable; ignore silently.
    }
  }

  /**
   * Restores the DEK from sessionStorage after a reload. Returns true if a usable
   * key is now in memory. Used by the auth guard to avoid the "logged in but cannot
   * decrypt" state.
   */
  async restoreSession(): Promise<boolean> {
    if (this.currentDek) {
      return true;
    }
    if (!this.isBrowser) {
      return false;
    }
    const stored = sessionStorage.getItem(this.DEK_STORAGE_KEY);
    if (!stored) {
      return false;
    }
    try {
      this.currentDek = await crypto.subtle.importKey(
        'raw',
        this.fromBase64(stored) as any,
        'AES-GCM',
        true,
        ['encrypt', 'decrypt']
      );
      return true;
    } catch {
      sessionStorage.removeItem(this.DEK_STORAGE_KEY);
      return false;
    }
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

  /**
   * Metodo wrapper di supporto
   * @returns la chiave dek
   */
  private getRequiredKey(): CryptoKey {
    // controlla che la dek ci sia, e che quindi l'user sia loggato
    if (!this.currentDek) {
      throw new Error('Encryption key not initialized. Please log in.');
    }
    // ritorna la dek 
    return this.currentDek;
  }

  /**
   * 
   */
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
