import { TestBed } from '@angular/core/testing';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CryptoService);
  });

  it('has no active session before login/registration', () => {
    expect(service.hasSession()).toBe(false);
    expect(() => (service as any).getRequiredKey()).toThrow();
  });

  it('encrypt/decrypt roundtrips file bytes after registration', async () => {
    await service.setupRegistrationKeys('correct horse battery staple');
    expect(service.hasSession()).toBe(true);

    const plaintext = new TextEncoder().encode('hello securevault').buffer as ArrayBuffer;
    const { cipher, iv } = await service.encrypt(plaintext);
    const decrypted = await service.decrypt(cipher, iv);

    expect(new TextDecoder().decode(decrypted)).toBe('hello securevault');
  });

  it('encryptName/decryptName roundtrips file/folder names', async () => {
    await service.setupRegistrationKeys('correct horse battery staple');

    const encName = await service.encryptName('my-secret-file.txt');
    expect(encName).toContain(':');
    expect(encName).not.toContain('my-secret-file.txt');

    const decName = await service.decryptName(encName);
    expect(decName).toBe('my-secret-file.txt');
  });

  it('login re-derives the same DEK from the wrapped material produced at registration', async () => {
    const password = 'correct horse battery staple';
    const registration = await service.setupRegistrationKeys(password);

    const encName = await service.encryptName('roundtrip-check');

    // simulate a fresh session (e.g. after logout) restoring keys via login
    const fresh = TestBed.inject(CryptoService);
    await fresh.setupLoginKeys(
      password,
      registration.encryptedDek,
      registration.iv,
      registration.salt,
      registration.encryptedPrivateKey,
      registration.privateKeyIv,
    );

    expect(await fresh.decryptName(encName)).toBe('roundtrip-check');
  });

  it('login fails to produce a usable key with the wrong password', async () => {
    const registration = await service.setupRegistrationKeys('correct horse battery staple');

    const other = TestBed.inject(CryptoService);
    await expect(
      other.setupLoginKeys('totally wrong password', registration.encryptedDek, registration.iv, registration.salt),
    ).rejects.toThrow();
  });

  it('recovery key restores the same master DEK and re-wraps it under a new password', async () => {
    const registration = await service.setupRegistrationKeys('original-password');
    const encName = await service.encryptName('recoverable-file');

    const recovered = await service.setupRecoveryKeys(
      registration.recoveryKey,
      registration.recoveryEncryptedDek,
      registration.recoveryDekIv,
      registration.salt,
      'brand-new-password',
    );

    // the recovered DEK must still decrypt data encrypted before the reset
    expect(await service.decryptName(encName)).toBe('recoverable-file');

    // and the newly wrapped DEK must be unlockable with the new password
    const relogged = TestBed.inject(CryptoService);
    await relogged.setupLoginKeys('brand-new-password', recovered.newEncryptedDek, recovered.newDekIv, registration.salt);
    expect(await relogged.decryptName(encName)).toBe('recoverable-file');
  });

  it('per-file keys are independent from the master DEK and can be wrapped/unwrapped', async () => {
    await service.setupRegistrationKeys('correct horse battery staple');

    const fileKey = await service.generateFileKey();
    const { wrappedDek, dekIv } = await service.wrapFileKey(fileKey);
    const unwrapped = await service.unwrapFileKey(wrappedDek, dekIv);

    const encName = await service.encryptNameWithKey('shared-doc.pdf', fileKey);
    expect(await service.decryptNameWithKey(encName, unwrapped)).toBe('shared-doc.pdf');
  });

  it('sharing wraps a file key to a recipient RSA public key and only their private key can unwrap it', async () => {
    const sender = TestBed.inject(CryptoService);
    await sender.setupRegistrationKeys('sender-password');

    const recipient = TestBed.inject(CryptoService);
    const recipientReg = await recipient.setupRegistrationKeys('recipient-password');

    const fileKey = await sender.generateFileKey();
    const sharedCipher = await sender.encryptKeyForRecipient(fileKey, recipientReg.publicKey);

    const unwrappedByRecipient = await recipient.decryptSharedKey(sharedCipher);
    const encName = await sender.encryptNameWithKey('shared-with-bob.txt', fileKey);
    expect(await recipient.decryptNameWithKey(encName, unwrappedByRecipient)).toBe('shared-with-bob.txt');
  });

  it('clearSession wipes in-memory keys and nothing is left in sessionStorage/localStorage', async () => {
    await service.setupRegistrationKeys('correct horse battery staple');
    expect(service.hasSession()).toBe(true);

    service.clearSession();

    expect(service.hasSession()).toBe(false);
    expect(() => (service as any).getRequiredKey()).toThrow();
    // the master DEK must never be persisted (see SECURITY.md, section 8): nothing to leak on reload
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });
});
