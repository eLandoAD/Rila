import { Injectable } from '@angular/core';
import { IRegistrationKeys } from '../interfaces/IRegistrationKeys';
import { IRecoveryResult } from '../interfaces/IRecoveryResult';
import { IEncryptedPrivateKey } from '../interfaces/IEncryptedPrivateKey';
import { IEncryptedDek } from '../interfaces/IEncryptedDek';
import { IWrappedFileKey } from '../interfaces/IWrappedFileKey';
import { IEncryptedData } from '../interfaces/IEncryptedData';

/**
 * client-side AES-GCM encryption. The dek is derived from the user's password
 * or from a recovery key and is kept in memory only for the duration of the session
 */
@Injectable({ providedIn: 'root' })
export class CryptoService {
  // dek, kept only in memory for the session's duration: never in sessionStorage/localStorage,
  // otherwise an XSS at unlock time could steal it even after a reload (see SECURITY.md §8)
  private currentDek: CryptoKey | null = null;

  // private RSA key, kept in memory like currentDek
  private currentPrivateKey: CryptoKey | null = null;

  /**
   * encrypts data using the dek key
   */
  async encrypt(data: ArrayBuffer): Promise<{ cipher: ArrayBuffer; iv: string }> {
    // use the wrapper method to get the current dek
    const key = this.getRequiredKey();
    // generate a random iv
    const ivBytes = crypto.getRandomValues(new Uint8Array(12));
    // apply encryption
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, key, data);
    // return cipher + iv (the dek is kept in memory, no need to return it)
    return { cipher, iv: this.toBase64(ivBytes) };
  }

  /**
   * encrypts a small string using the dek, useful for the filename
   */
  async encryptText(text: string, iv: string): Promise<string> {
    // get the dek
    const key = this.getRequiredKey();
    // unlike the other method, take the iv as a parameter
    // so encrypt directly
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: this.fromBase64(iv) as any },
      key,
      new TextEncoder().encode(text)
    );
    // return just the string here, since we already have the iv
    return this.toBase64(new Uint8Array(cipher));
  }

  /**
   * decrypts a file using the dek
   */
  async decrypt(cipher: ArrayBuffer, iv: string): Promise<ArrayBuffer> {
    // get the current dek
    const key = this.getRequiredKey();
    // return the decrypted result, passing the dek and the ciphertext too
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.fromBase64(iv) as any }, key, cipher);
  }

  /**
   * decrypts a small string (filename) using the dek
   */
  async decryptText(encText: string, iv: string): Promise<string> {
    // as usual
    const key = this.getRequiredKey();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.fromBase64(iv) as any },
      key,
      this.fromBase64(encText) as unknown as Uint8Array<ArrayBuffer>
    );
    return new TextDecoder().decode(plain);
  }

  /**
   * support for registration: generates everything needed, including the recovery key
   * returns a promise containing the various keys + iv
   */
  async setupRegistrationKeys(password: string): Promise<IRegistrationKeys> {
    // generate a random salt, which is then mixed with the password
    const salt = crypto.getRandomValues(new Uint8Array(16));
    // generate a random dek
    const dek = await this.generateDEK();

    // kek, derived from password and salt
    // salt's purpose --> increase randomness
    // password + saltA -> key a
    // password + saltB -> key b
    const kek = await this.deriveKEK(password, salt);
    // get the iv and the encrypted dek too
    const { encryptedDek, iv } = await this.encryptDEK(dek, kek);

    // prepare the recovery key, based on the kek
    const recoveryKey = this.generateRecoveryKeyString();
    // reuse the same salt for simplicity
    const emergencyKek = await this.deriveKEK(recoveryKey, salt);
    const { encryptedDek: recoveryEncDek, iv: recoveryIv } = await this.encryptDEK(dek, emergencyKek);

    // rsa for sharing
    const keyPair = await this.generateKeyPair();
    const publicKey = this.toBase64(new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey)))
    const { encryptedPrivateKey, iv: privateKeyIv } = await this.wrapPrivateKey(keyPair.privateKey, dek)
    this.currentPrivateKey = keyPair.privateKey;

    // dek and private key stay only in memory for this session
    this.currentDek = dek;

    // return every field of the IRegistrationKeys interface
    return {
      encryptedDek,
      iv,
      salt: this.toBase64(salt),
      recoveryKey,
      recoveryEncryptedDek: recoveryEncDek,
      recoveryDekIv: recoveryIv,
      publicKey,
      encryptedPrivateKey,
      privateKeyIv,
    };
  }

  /**
   * for login: decrypts the dek using the password
   */
  async setupLoginKeys(password: string, encryptedDek: string, iv: string, salt: string, encryptedPrivateKey?: string, privateKeyIv?: string): Promise<void> {
    // get the kek
    const saltBytes = this.fromBase64(salt);
    const kek = await this.deriveKEK(password, saltBytes);
    // decrypt the dek, kept only in memory
    this.currentDek = await this.decryptDEK(encryptedDek, iv, kek);

    // load the rsa key if the backend already has it ready
    if (encryptedPrivateKey && privateKeyIv) {
      this.currentPrivateKey = await this.unwrapPrivateKey(encryptedPrivateKey, privateKeyIv, this.currentDek);
    }
  }

  /**
   * for reset/recovery: decrypts the dek using the recovery key, and re-encrypts it
   * with the newly created password
   */
  async setupRecoveryKeys(recoveryKey: string, recoveryEncryptedDek: string, recoveryDekIv: string, salt: string, newPassword: string): Promise<IRecoveryResult> {
    const saltBytes = this.fromBase64(salt);

    // decrypt the original dek with the recovery key
    const emergencyKek = await this.deriveKEK(recoveryKey, saltBytes);
    const dek = await this.decryptDEK(recoveryEncryptedDek, recoveryDekIv, emergencyKek);

    // re-encrypt with the new password
    const newKek = await this.deriveKEK(newPassword, saltBytes);
    const { encryptedDek: newEncDek, iv: newIv } = await this.encryptDEK(dek, newKek);

    this.currentDek = dek;
    return {
      newEncryptedDek: newEncDek,
      newDekIv: newIv
    };
  }

  // clear the whole session (nothing else to do: dek and private key live only in memory)
  clearSession(): void {
    this.currentDek = null;
    this.currentPrivateKey = null;
  }

  /**
   * method to check whether a dek is present in memory or not
   */
  hasSession(): boolean {
    return this.currentDek !== null;
  }

  /**
   * Encrypts a file/folder name
   * The per-file iv is embedded in the returned string,
   */
  async encryptName(name: string): Promise<string> {
    // content -> cipher and iv
    const data = new TextEncoder().encode(name);
    const { cipher, iv } = await this.encrypt(data.buffer as ArrayBuffer);
    // return iv:cipher
    return `${iv}:${this.toBase64(new Uint8Array(cipher))}`;
  }

  /**
   * Decrypts a name produced by {@link encryptName}
   */
  async decryptName(encName: string): Promise<string> {
    // index of the : separator
    const sep = encName.indexOf(':');
    // means there's nothing there
    if (sep === -1) {
      return encName;
    }

    // slice out the iv
    const iv = encName.slice(0, sep);
    // and the cipher
    const cipher = this.fromBase64(encName.slice(sep + 1));
    // get the plaintext
    const plain = await this.decrypt(cipher.buffer as ArrayBuffer, iv);
    // return the decrypted text
    return new TextDecoder().decode(plain);
  }

  /**
   * Supporting wrapper method
   * @returns the dek key
   */
  private getRequiredKey(): CryptoKey {
    // check that the dek is present, meaning the user is logged in
    if (!this.currentDek) {
      throw new Error('Encryption key not initialized. Please log in.');
    }
    // return the dek
    return this.currentDek;
  }

  /**
   * helper to generate the dek
   */
  private async generateDEK(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // extractable for wrap/unwrap
      ['encrypt', 'decrypt']
    );
  }

  // RSA-OAEP 2048 key pair for file sharing
  private async generateKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  }

  // wraps the PKCS8 private key with the master dek
  private async wrapPrivateKey(privateKey: CryptoKey, masterDek: CryptoKey): Promise<IEncryptedPrivateKey> {
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
    // iv and cipher
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterDek, pkcs8);
    // return private key + iv
    return { encryptedPrivateKey: this.toBase64(new Uint8Array(cipher)), iv: this.toBase64(iv) };
  }

  // unlocks the private key with the master dek and imports it
  private async unwrapPrivateKey(encryptedPrivateKey: string, iv: string, masterDek: CryptoKey): Promise<CryptoKey> {
    const pkcs8 = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.fromBase64(iv) as any },
      masterDek,
      this.fromBase64(encryptedPrivateKey) as any
    );
    return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  }

  // derives the kek, starting from the secret and a salt
  private async deriveKEK(secret: string, salt: Uint8Array): Promise<CryptoKey> {
    // encoder + secret bytes
    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(secret);

    // import the key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // derive the key using the salt and return it
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as any,
        iterations: 600000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['wrapKey', 'unwrapKey']
    );
  }

  // encrypts the dek
  private async encryptDEK(dek: CryptoKey, kek: CryptoKey): Promise<IEncryptedDek> {
    // generate a random iv
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const wrappedDek = await crypto.subtle.wrapKey(
      'raw',
      dek,
      kek,
      { name: 'AES-GCM', iv }
    );

    // return the encrypted dek + iv
    return {
      encryptedDek: this.toBase64(new Uint8Array(wrappedDek)),
      iv: this.toBase64(iv),
    };
  }

  // inverse of the previous method
  private async decryptDEK(encryptedDek: string, iv: string, kek: CryptoKey): Promise<CryptoKey> {
    // extract the dek
    return crypto.subtle.unwrapKey(
      'raw',
      this.fromBase64(encryptedDek) as any,
      kek,
      { name: 'AES-GCM', iv: this.fromBase64(iv) as any },
      { name: 'AES-GCM', length: 256 },
      true, // extractable, for sharing links
      ['encrypt', 'decrypt']
    );
  }

  // get the raw dek
  async getRawDek(): Promise<string> {
    // get the key
    const key = this.getRequiredKey();
    // get the raw dek
    const raw = await crypto.subtle.exportKey('raw', key);
    // return
    return this.toBase64(new Uint8Array(raw));
  }

  // import the raw dek
  async importRawDek(b64Key: string): Promise<CryptoKey> {
    // raw bytes
    const rawBytes = this.fromBase64(b64Key);
    // inverse of the previous method
    return crypto.subtle.importKey(
      'raw',
      rawBytes,
      'AES-GCM',
      false,
      ['decrypt']
    );
  }

  // method to decrypt once you already have the key
  async decryptWithKey(cipher: ArrayBuffer, iv: string, key: CryptoKey): Promise<ArrayBuffer> {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.fromBase64(iv) as any }, key, cipher);
  }

  /**
   * per-file dek
   * Each file has its own key, which is then wrapped by the master dek
   * When sharing a file, only that key is shared, never the master
   * @returns aes-gcm crypto key
   */
  async generateFileKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }

  // wraps a dek with the master dek -> to save server-side
  async wrapFileKey(fileKey: CryptoKey): Promise<IWrappedFileKey> {
    // get the master key + the raw key
    const master = this.getRequiredKey();
    const raw = await crypto.subtle.exportKey('raw', fileKey)
    // generate a random iv + get the cipher
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, master, raw);
    // return the wrapped dek + dekIv
    return { wrappedDek: this.toBase64(new Uint8Array(cipher)), dekIv: this.toBase64(iv) }
  }

  // unlocks a file dek with the master dek
  async unwrapFileKey(wrappedDek: string, dekIv: string): Promise<CryptoKey> {
    // get the master key and then the raw key
    const master = this.getRequiredKey()
    const raw = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.fromBase64(dekIv) as any },
      master,
      this.fromBase64(wrappedDek) as any
    )
    // extractable, since during sharing the raw key must be exported and then encrypted with RSA
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt'])
  }

  // encrypts data with a key, random iv
  async encryptWithKey(data: ArrayBuffer, key: CryptoKey): Promise<IEncryptedData> {
    // generate iv bytes
    const ivBytes = crypto.getRandomValues(new Uint8Array(12))
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, key, data);
    return { cipher, iv: this.toBase64(ivBytes) }
  }

  // encrypts a name with a given key, always a random iv
  async encryptNameWithKey(name: string, key: CryptoKey): Promise<string> {
    const data = new TextEncoder().encode(name);
    // iv dedicated to the name
    const { cipher, iv } = await this.encryptWithKey(data.buffer as ArrayBuffer, key);
    return `${iv}:${this.toBase64(new Uint8Array(cipher))}`;
  }

  // decrypts a name produced by encryptNameWithKey with the embedded iv
  async decryptNameWithKey(encName: string, key: CryptoKey): Promise<string> {
    // separator index
    const sep = encName.indexOf(':')

    if (sep === -1) return encName;

    // get iv + cipher
    const iv = encName.slice(0, sep)
    const cipher = this.fromBase64(encName.slice(sep + 1))
    // use the iv to get the plaintext
    const plain = await this.decryptWithKey(cipher.buffer as ArrayBuffer, iv, key)
    // return the plain text
    return new TextDecoder().decode(plain);
  }

  // decrypts the text starting from iv and key
  async decryptTextWithKey(encText: string, iv: string, key: CryptoKey): Promise<string> {
    // get the plaintext first
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.fromBase64(iv) as any },
      key,
      this.fromBase64(encText) as unknown as Uint8Array<ArrayBuffer>
    );
    return new TextDecoder().decode(plain);
  }

  // generates the recovery key for the password
  private generateRecoveryKeyString(): string {
    // starting alphabet
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    // 20 random bytes
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    // starts with SV-
    let key = 'SV-';
    // add a - every four characters for readability
    for (let i = 0; i < bytes.length; i++) {
      if (i > 0 && i % 4 === 0) key += '-';
      key += alphabet[bytes[i] % alphabet.length];
    }
    return key;
  }

  // method that takes bytes and turns them into base64
  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // inverse of the previous method
  private fromBase64(b64: string): Uint8Array<ArrayBuffer> {
    const binary = atob(b64);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // encrypts a file's key with the recipient's public key
  async encryptKeyForRecipient(fileKey: CryptoKey, recipientPubliKeySpki: string): Promise<string> {
    const raw = await crypto.subtle.exportKey('raw', fileKey);
    const pub = await crypto.subtle.importKey('spki', this.fromBase64(recipientPubliKeySpki) as any, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
    const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, raw);
    return this.toBase64(new Uint8Array(cipher))
  }

  // decrypts a shared file's key with my private key, and imports it as an AES key
  async decryptSharedKey(ciphertext: string): Promise<CryptoKey> {
    if (!this.currentPrivateKey) throw new Error('Private key not loaded, login again');
    const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, this.currentPrivateKey, this.fromBase64(ciphertext) as any)
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  }

  // exports a file's dek in base64
  async getFileKeyBase64(wrappedDek: string, dekIv: string): Promise<string> {
    const fileKey = await this.unwrapFileKey(wrappedDek, dekIv);
    const raw = await crypto.subtle.exportKey('raw', fileKey)
    return this.toBase64(new Uint8Array(raw))
  }

}
