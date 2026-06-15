# SECURITY.md — SecureVault key management & E2EE design

This document describes how SecureVault encrypts user files end-to-end, how keys are
derived and stored, and how password reset is handled without losing access to data.

## 1. Goals

- The server stores **only ciphertext**: encrypted file blobs, encrypted file/folder names,
  and an encrypted Data Encryption Key (DEK). It never sees plaintext file content, plaintext
  filenames, the user password, or any password-derived key.
- All encryption and decryption happen **client-side**, in the browser, via the Web Crypto API.

## 2. Primitives

| Purpose | Algorithm | Notes |
|---------|-----------|-------|
| File & name encryption | **AES-GCM, 256-bit** | Authenticated encryption, random 96-bit IV per operation |
| Key derivation (KEK) | **PBKDF2-HMAC-SHA-256, 100 000 iterations** | 128-bit random salt per user |
| DEK wrapping | **AES-GCM** (`wrapKey`/`unwrapKey`) | DEK is wrapped by the KEK, never stored in plaintext |
| Password hashing (server) | **BCrypt** (Spring Security) | Server-side, only for authentication — independent from E2EE |

We use PBKDF2 rather than Argon2 because it is natively available in the Web Crypto API with
no third-party dependency, giving a fully audited, browser-native crypto path. Argon2 would be
a stronger KDF; migrating to it (via WASM) is a documented future improvement. 100 000
iterations is the configured work factor.

## 3. Key hierarchy

```
password ──PBKDF2(salt)──▶ KEK ──AES-GCM wrap──▶ encrypted DEK  (stored on server)
recoveryKey ──PBKDF2(salt)──▶ recovery KEK ──AES-GCM wrap──▶ recovery encrypted DEK  (stored on server)
DEK (random 256-bit) ──AES-GCM──▶ file bytes, file names, folder names
```

- The **DEK** is a random 256-bit AES key generated at sign-up. It is the only key that ever
  touches file content. It lives in browser memory only for the duration of the session.
- The **KEK** is derived from the password on every login and used to unwrap the DEK. It is
  never sent to or stored by the server.
- The **recovery key** is a random human-readable string (`SV-XXXX-...`) shown to the user once
  at registration. It wraps an independent copy of the same DEK, enabling password reset
  without data loss (see §6).

## 4. What the server stores

Per user (`users` table): `encryptedDek`, `dekIv`, `keySalt`, `recoveryEncryptedDek`,
`recoveryDekIv`. Per file/folder: `encName`, `iv`, and (files only) the encrypted blob on disk
under a random UUID storage path. No plaintext names, no plaintext content, no keys.

## 5. Data flows

- **Sign-up**: browser generates salt + DEK + recovery key, derives KEK (password) and recovery
  KEK, wraps the DEK under both, and sends only the wrapped DEKs, IVs and salt to the server.
- **Login**: server returns `encryptedDek`, `dekIv`, `keySalt`; browser derives the KEK from the
  typed password and unwraps the DEK into memory.
- **Upload**: file bytes are AES-GCM encrypted with the DEK (fresh IV); the filename is encrypted
  with the same IV. Only ciphertext + IV + encrypted name leave the browser.
- **Download**: browser fetches the ciphertext and decrypts it with the in-memory DEK.
- **Folders**: folder names are encrypted exactly like filenames; the server only manipulates the
  tree structure and ciphertext.

## 6. Password reset (the trap)

Naively re-deriving the key from a new password would orphan every existing file. We avoid this:

1. The DEK is wrapped under **two** independent KEKs at sign-up — one from the password, one from
   the recovery key.
2. On reset, the user supplies the **recovery key**. The browser unwraps the DEK via the recovery
   KEK, then **re-wraps the same DEK** under a KEK derived from the new password.
3. The server receives the new password hash and the new `encryptedDek` + `dekIv`, and updates
   only those fields. **Files are never re-encrypted** — only the small wrapped DEK changes, so all
   existing data stays decryptable.

## 7. Trade-offs & future work

- **PBKDF2 → Argon2** for stronger resistance to GPU cracking.
- The recovery key reuses the user salt for simplicity; a distinct salt would be marginally
  stronger.
- File **sharing** under E2EE (wrapping the DEK/per-file key to a recipient's public key) is a
  planned stretch goal, not yet implemented.
- A compromised browser at unlock time can read the in-memory DEK — this is inherent to any
  browser-based E2EE and outside the server threat model.
