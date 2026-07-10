import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { IRegistrationKeys } from '../interfaces/IRegistrationKeys';
import { IRecoveryResult } from '../interfaces/IRecoveryResult';
import { IEncryptedPrivateKey } from '../interfaces/IEncryptedPrivateKey';
import { IEncryptedDek } from '../interfaces/IEncryptedDek';
import { IWrappedFileKey } from '../interfaces/IWrappedFileKey';
import { IEncryptedData } from '../interfaces/IEncryptedData';

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

  // chiave RSA privata, tenuta in memoria come la currentDek
  private currentPrivateKey: CryptoKey | null = null;

  // privata (già cifrata) + iv
  private readonly PRIVKEY_STORAGE_KEY = 'sv_epk';
  private readonly PRIVKEY_IV_STORAGE_KEY = 'sv_epk_iv';

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
    // ritorno cipher + iv (la dek la tengo in memoria, non serve ritornarla)
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
   * supporto per la registrazione: genera tutto il necessario, compresa la recovery key
   * ritorna una promise contenente le varie chiavi + iv
   */
  async setupRegistrationKeys(password: string): Promise<IRegistrationKeys> {
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

    // rsa x sharing
    const keyPair = await this.generateKeyPair();
    const publicKey = this.toBase64(new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey)))
    const { encryptedPrivateKey, iv: privateKeyIv } = await this.wrapPrivateKey(keyPair.privateKey, dek)
    this.currentPrivateKey = keyPair.privateKey;

    // salvo la dek nel sessionStorage
    this.currentDek = dek;
    await this.persistDek();

    // aggiungo anche chiave privata + iv
    if (this.isBrowser) {
      sessionStorage.setItem(this.PRIVKEY_STORAGE_KEY, encryptedPrivateKey)
      sessionStorage.setItem(this.PRIVKEY_IV_STORAGE_KEY, privateKeyIv)
    }

    // ritorno ogni oggetto dell'interfaccia IRegistrationKeys
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
   * per il login: decripta la dek per la password
   */
  async setupLoginKeys(password: string, encryptedDek: string, iv: string, salt: string, encryptedPrivateKey?: string, privateKeyIv?: string): Promise<void> {
    // ottengo la kek
    const saltBytes = this.fromBase64(salt);
    const kek = await this.deriveKEK(password, saltBytes);
    // decripto la dek e la salvo nel sessionStorage
    this.currentDek = await this.decryptDEK(encryptedDek, iv, kek);
    await this.persistDek();

    // carico la rsa se il backend ce l'ha già pronta
    if (encryptedPrivateKey && privateKeyIv) {
      this.currentPrivateKey = await this.unwrapPrivateKey(encryptedPrivateKey, privateKeyIv, this.currentDek);
      // salvo nel sessionStorage
      if (this.isBrowser) {
        sessionStorage.setItem(this.PRIVKEY_STORAGE_KEY, encryptedPrivateKey);
        sessionStorage.setItem(this.PRIVKEY_IV_STORAGE_KEY, privateKeyIv);
      }
    }
  }

  /**
   * per reset/recovery: decripta la dek usando la recovery key, e la reincripta
   * con la nuova password creata
   */
  async setupRecoveryKeys(recoveryKey: string, recoveryEncryptedDek: string, recoveryDekIv: string, salt: string, newPassword: string): Promise<IRecoveryResult> {
    const saltBytes = this.fromBase64(salt);

    // decripto la dek originale con la recovery key
    const emergencyKek = await this.deriveKEK(recoveryKey, saltBytes);
    const dek = await this.decryptDEK(recoveryEncryptedDek, recoveryDekIv, emergencyKek);

    // encripto nuovamente con la nuova password
    const newKek = await this.deriveKEK(newPassword, saltBytes);
    const { encryptedDek: newEncDek, iv: newIv } = await this.encryptDEK(dek, newKek);

    // aggiorno il dek nel sessionStorage
    this.currentDek = dek;
    await this.persistDek();
    return {
      newEncryptedDek: newEncDek,
      newDekIv: newIv
    };
  }

  // svuoto tutto della sessione
  clearSession(): void {
    this.currentDek = null;
    this.currentPrivateKey = null;
    if (this.isBrowser) {
      sessionStorage.removeItem(this.DEK_STORAGE_KEY);
      sessionStorage.removeItem(this.PRIVKEY_STORAGE_KEY)
      sessionStorage.removeItem(this.PRIVKEY_IV_STORAGE_KEY)
    }
  }

  /**
   * Dek viene salvata in memoria nello sessionStorage, così se la pagina si ricarica
   * o in generale qualcosa si ricarica, non si perde la capacità
   * di decriptare i file
   */
  private async persistDek(): Promise<void> {
    // se non mi trovo sul browser e se la dek è diversa
    if (!this.isBrowser || !this.currentDek) {
      return;
    }
    // prendo la dek e la salvo dentro il sessionStorage
    try {
      const raw = await crypto.subtle.exportKey('raw', this.currentDek);
      sessionStorage.setItem(this.DEK_STORAGE_KEY, this.toBase64(new Uint8Array(raw)));
    } catch {
      // ignoro
    }
  }

  /**
   * recupera la dek dal sessionStorage dopo un reload.
   * @returns true se c'è una chiave utilizzabile in memoria
   * La usa la auth guard per evitare di essere loggati, ma non poter decriptare i file/cartelle
   */
  async restoreSession(): Promise<boolean> {
    // chiave trovata
    if (this.currentDek) {
      return true;
    }
    if (!this.isBrowser) {
      return false;
    }
    // chiave non trovata
    const stored = sessionStorage.getItem(this.DEK_STORAGE_KEY);
    if (!stored) {
      return false;
    }
    try {
      // prende la chiave dal session storage e la passa al current dek
      this.currentDek = await crypto.subtle.importKey(
        'raw',
        this.fromBase64(stored) as any,
        'AES-GCM',
        true,
        ['encrypt', 'decrypt']
      );

      const epk = sessionStorage.getItem(this.PRIVKEY_STORAGE_KEY)
      const epkIv = sessionStorage.getItem(this.PRIVKEY_IV_STORAGE_KEY)

      if (epk && epkIv && this.currentDek) {
        try {
          this.currentPrivateKey = await this.unwrapPrivateKey(epk, epkIv, this.currentDek);
        } catch {
          // privata, non ripristinabile. Gli share non funzioneranno se non si rifà il login
        }
      }
      return true;
    } catch {
      sessionStorage.removeItem(this.DEK_STORAGE_KEY);
      return false;
    }
  }

  /**
   * metodo per verificare se c'è una dek in memoria o meno
   */
  hasSession(): boolean {
    return this.currentDek !== null;
  }

  /**
   * Cripta il nome di un file/cartella
   * L'iv per-file è incorporato nella stringa che si ritorna,
   */
  async encryptName(name: string): Promise<string> {
    // contenuto + cipher e iv
    const data = new TextEncoder().encode(name);
    const { cipher, iv } = await this.encrypt(data.buffer as ArrayBuffer);
    // ritorno iv:cipher
    return `${iv}:${this.toBase64(new Uint8Array(cipher))}`;
  }

  /**
   * Decripta un nome prodotto da {@link encryptName}
   */
  async decryptName(encName: string): Promise<string> {
    // indice separatore :
    const sep = encName.indexOf(':');
    // vuol dire che non c'è nulla
    if (sep === -1) {
      return encName;
    }

    // taglio iv
    const iv = encName.slice(0, sep);
    // e cipher
    const cipher = this.fromBase64(encName.slice(sep + 1));
    // ottengo testo
    const plain = await this.decrypt(cipher.buffer as ArrayBuffer, iv);
    // ritorno il testo decriptato
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
   * helper per generare la dek
   */
  private async generateDEK(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // estraibile per  wrap/unwrap
      ['encrypt', 'decrypt']
    );
  }

  // coppia RSA-OAEP 2048 per lo sharing dei file
  private async generateKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, // estraibile
      ['encrypt', 'decrypt']
    );
  }

  // avvolge la privata PKCS8 con la master dek
  private async wrapPrivateKey(privateKey: CryptoKey, masterDek: CryptoKey): Promise<IEncryptedPrivateKey> {
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
    // iv e cipher
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterDek, pkcs8);
    // ritorna chiave privata + iv
    return { encryptedPrivateKey: this.toBase64(new Uint8Array(cipher)), iv: this.toBase64(iv) };
  }

  // sblocco la privata con la master dek e la importa
  private async unwrapPrivateKey(encryptedPrivateKey: string, iv: string, masterDek: CryptoKey): Promise<CryptoKey> {
    const pkcs8 = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.fromBase64(iv) as any },
      masterDek,
      this.fromBase64(encryptedPrivateKey) as any
    );
    return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  }

  // prende la kek, partendo dalla secret e da un salt
  private async deriveKEK(secret: string, salt: Uint8Array): Promise<CryptoKey> {
    // encoder + secret bytes
    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(secret);

    // importo la chiave
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // derivo la chiave usando il salt e la ritorno
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

  // cripta la dek
  private async encryptDEK(dek: CryptoKey, kek: CryptoKey): Promise<IEncryptedDek> {
    // genero un iv casuale
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const wrappedDek = await crypto.subtle.wrapKey(
      'raw',
      dek,
      kek,
      { name: 'AES-GCM', iv }
    );

    // ritorno dek criptata + iv
    return {
      encryptedDek: this.toBase64(new Uint8Array(wrappedDek)),
      iv: this.toBase64(iv),
    };
  }

  // metodo inverso al precedente
  private async decryptDEK(encryptedDek: string, iv: string, kek: CryptoKey): Promise<CryptoKey> {
    // estraggo il dek
    return crypto.subtle.unwrapKey(
      'raw',
      this.fromBase64(encryptedDek) as any,
      kek,
      { name: 'AES-GCM', iv: this.fromBase64(iv) as any },
      { name: 'AES-GCM', length: 256 },
      true, // si può estrarre, per i link di sharing
      ['encrypt', 'decrypt']
    );
  }

  // ottengo il raw dek
  async getRawDek(): Promise<string> {
    // ottengo la chiave
    const key = this.getRequiredKey();
    // prendo il dek raw
    const raw = await crypto.subtle.exportKey('raw', key);
    // ritorno
    return this.toBase64(new Uint8Array(raw));
  }

  // importo il raw dek
  async importRawDek(b64Key: string): Promise<CryptoKey> {
    // raw bytes
    const rawBytes = this.fromBase64(b64Key);
    // processo inverso al metodo precedente
    return crypto.subtle.importKey(
      'raw',
      rawBytes,
      'AES-GCM',
      false,
      ['decrypt']
    );
  }

  // metodo per decriptare una volta che si ha la chiave
  async decryptWithKey(cipher: ArrayBuffer, iv: string, key: CryptoKey): Promise<ArrayBuffer> {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.fromBase64(iv) as any }, key, cipher);
  }

  /**
   * dek per file
   * Ogni file ha la sua chiave, avvolta poi dalla master dek
   * Quando si condivide un file, si condivide solo la chiave, non la master
   * @returns crypto key aes-gcm
   */
  async generateFileKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }

  // avvolge una dek con la master dek -> per salvare lato server
  async wrapFileKey(fileKey: CryptoKey): Promise<IWrappedFileKey> {
    // otengo la master + la raw
    const master = this.getRequiredKey();
    const raw = await crypto.subtle.exportKey('raw', fileKey)
    // genero iv casuale + ottengo il cipher
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, master, raw);
    // ritorno dek wrappata + dekIv
    return { wrappedDek: this.toBase64(new Uint8Array(cipher)), dekIv: this.toBase64(iv) }
  }

  // sblocco un dek di file con la master dek
  async unwrapFileKey(wrappedDek: string, dekIv: string): Promise<CryptoKey> {
    // ottengo la master e in seguito la raw
    const master = this.getRequiredKey()
    const raw = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.fromBase64(dekIv) as any },
      master,
      this.fromBase64(wrappedDek) as any
    )
    // estraibile, in fase di condivisione bisogna esportare il raw per poi cirfarlo con RSA
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt'])
  }

  // cifra dati con un chiave, iv casuale
  async encryptWithKey(data: ArrayBuffer, key: CryptoKey): Promise<IEncryptedData> {
    // genero iv in bytes
    const ivBytes = crypto.getRandomValues(new Uint8Array(12))
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, key, data);
    return { cipher, iv: this.toBase64(ivBytes) }
  }

  // cifra un nome con una chiave data sempre iv casuale
  async encryptNameWithKey(name: string, key: CryptoKey): Promise<string> {
    const data = new TextEncoder().encode(name);
    // iv dedicato al nome
    const { cipher, iv } = await this.encryptWithKey(data.buffer as ArrayBuffer, key);
    return `${iv}:${this.toBase64(new Uint8Array(cipher))}`;
  }

  // decifra un nome prodotto da encryptNameWithKey con iv incorporato
  async decryptNameWithKey(encName: string, key: CryptoKey): Promise<string> {
    // indice separatore
    const sep = encName.indexOf(':')

    if (sep === -1) return encName;

    // ottengo iv + cipher
    const iv = encName.slice(0, sep)
    const cipher = this.fromBase64(encName.slice(sep + 1))
    // con l'iv ottengo il testo plain
    const plain = await this.decryptWithKey(cipher.buffer as ArrayBuffer, iv, key)
    // ritorno il testo normale
    return new TextDecoder().decode(plain);
  }

  // decripta il testo partendo con iv e chiave
  async decryptTextWithKey(encText: string, iv: string, key: CryptoKey): Promise<string> {
    // ottengo prima il plain
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.fromBase64(iv) as any },
      key,
      this.fromBase64(encText) as unknown as Uint8Array<ArrayBuffer>
    );
    return new TextDecoder().decode(plain);
  }

  // genera la recovery key per la password
  private generateRecoveryKeyString(): string {
    // alfabeto di partenza
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    // 20 bytes casuali
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    // si parte con SV-
    let key = 'SV-';
    // per ogni quattro aggiungo un - per comodità
    for (let i = 0; i < bytes.length; i++) {
      if (i > 0 && i % 4 === 0) key += '-';
      key += alphabet[bytes[i] % alphabet.length];
    }
    return key;
  }

  // metodo che prende dei bytes e li porta in base 64
  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // metodo inverso al precedente
  private fromBase64(b64: string): Uint8Array<ArrayBuffer> {
    const binary = atob(b64);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // cifra la chiave di un file con la pubblica del destinatario
  async encryptKeyForRecipient(fileKey: CryptoKey, recipientPubliKeySpki: string): Promise<string> {
    const raw = await crypto.subtle.exportKey('raw', fileKey);
    const pub = await crypto.subtle.importKey('spki', this.fromBase64(recipientPubliKeySpki) as any, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
    const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, raw);
    return this.toBase64(new Uint8Array(cipher))
  }

  // decifra la chiave di un file condiviso con la mia privata, e la importa come chiave AES
  async decryptSharedKey(ciphertext: string): Promise<CryptoKey> {
    if (!this.currentPrivateKey) throw new Error('Private key not loaded, login again');
    const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, this.currentPrivateKey, this.fromBase64(ciphertext) as any)
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  }

  // esporta la dek di un file in base64
  async getFileKeyBase64(wrappedDek: string, dekIv: string): Promise<string> {
    const fileKey = await this.unwrapFileKey(wrappedDek, dekIv);
    const raw = await crypto.subtle.exportKey('raw', fileKey)
    return this.toBase64(new Uint8Array(raw))
  }

}
