# SecureVault — Security & Key-Management Design

This document explains how SecureVault encrypts user data, how keys are derived and stored,
and how the password-reset flow is handled. The guiding principle is simple:

> **The server must never be able to read a user's files or file/folder names.**
> It only ever stores ciphertext and opaque key material it cannot unwrap.

---

## 1. Threat model

We protect confidentiality of file **contents** and **names** against:

- An attacker with full read access to the database and the blob storage on disk.
- A curious or compromised server operator.
- Passive network observers (TLS is assumed in production).

Out of scope: a compromised browser/endpoint (malware, malicious extension), and metadata such
as file sizes, counts, and timestamps, which the server necessarily sees.

---

## 2. Cryptographic primitives

All cryptography runs in the browser via the **Web Crypto API** (`crypto.subtle`). No keys or
plaintext are ever sent to the server.

| Purpose | Algorithm | Parameters |
|---------|-----------|------------|
| File & name encryption | **AES-GCM** | 256-bit key, random 96-bit IV per operation |
| Key derivation (KEK) | **PBKDF2** | SHA-256, 100,000 iterations, random 128-bit salt |
| Password hashing (server) | **BCrypt** | cost factor 12 |

AES-GCM is authenticated encryption, so tampering with ciphertext is detected on decryption.
We never reuse an IV: a fresh random IV is generated for every file and every name.

---

## 3. Envelope encryption (KEK / DEK)

We use the standard **two-key envelope** scheme so that the user's password can change without
re-encrypting any files.

```
password ──PBKDF2(salt,100k)──▶ KEK ──AES-GCM-wrap──▶ encrypts/decrypts the DEK
                                                         │
                                          random 256-bit DEK
                                                         │
                                          AES-GCM ──▶ encrypts/decrypts files & names
```

- **DEK (Data Encryption Key)** — a random AES-256 key generated once at sign-up. It encrypts
  every file's contents and every file/folder name.
- **KEK (Key Encryption Key)** — derived from the user's password with PBKDF2 + a per-user salt.
  It is used only to *wrap* (encrypt) the DEK.
- The server stores **only the wrapped DEK** (`encryptedDek`), its IV (`dekIv`), and the
  PBKDF2 salt (`keySalt`). None of these reveal the DEK without the password.

### Sign-up (`CryptoService.setupRegistrationKeys`)
1. Generate a random salt and a random DEK.
2. Derive the KEK from the password + salt.
3. Wrap the DEK with the KEK (AES-GCM) → `encryptedDek` + `dekIv`.
4. Send `encryptedDek`, `dekIv`, `keySalt` to the server alongside the registration. The DEK
   itself stays in browser memory; the server never sees it.

### Login (`CryptoService.setupLoginKeys`)
1. The server returns `encryptedDek`, `dekIv`, `keySalt` after verifying the password hash.
2. The browser re-derives the KEK from the typed password + salt.
3. The KEK unwraps the DEK, which is held **in memory only** for the session.

### Logout / reload
The DEK lives only in memory (`CryptoService.currentDek`) and is wiped on logout. After a full
page reload there is no DEK, so the vault shows a **locked** state and asks the user to log in
again. This is a deliberate trade-off favouring security over convenience — the plaintext DEK is
never written to `localStorage`, `sessionStorage`, or anywhere the server or an XSS payload could
trivially exfiltrate it across reloads.

---

## 4. What the server stores

| Data | Stored as |
|------|-----------|
| File contents | AES-GCM ciphertext blob on disk (random UUID filename) |
| File / folder names | AES-GCM ciphertext (`encName`, IV embedded as `iv:ciphertext`) |
| Per-file content IV | `iv` column (needed to decrypt, useless without the DEK) |
| Wrapped DEK + IV + salt | `encryptedDek`, `dekIv`, `keySalt` on the user row |
| Password | BCrypt hash (used only for authentication, not for file keys) |

The server can list, move, rename, and delete *ciphertext* objects, but it can never recover a
plaintext file or name.

---

## 5. Password reset — the hard part

If the encryption key were derived directly from the password, changing the password would make
every existing file permanently unreadable. The envelope scheme is designed to avoid that:

- **Change password while logged in (ideal):** the browser still holds the DEK, so it derives a
  new KEK from the new password, re-wraps the *same* DEK, and uploads the new `encryptedDek`.
  Files remain accessible. *(Planned enhancement — see "What's partial".)*

- **Forgot password (email reset, current implementation):** the user has lost their password and
  therefore cannot unwrap the old DEK — by design, **no one can**, including the server. On reset
  the browser generates a **brand-new DEK and salt** under the new password and stores them. The
  account is recovered and usable immediately, but **files uploaded before the reset become
  unrecoverable**. This is the honest consequence of real end-to-end encryption: a server that
  could restore your files after a password loss would be a server that could read them.

The reset email link (valid 15 minutes) points at the frontend, which performs the client-side
key regeneration and sends only the new wrapped material to the server.

---

## 6. Transport & application security

- **JWT** bearer auth (stateless), attached by an HTTP interceptor; expiry checked client-side.
- Every file/folder operation re-checks ownership server-side against the authenticated user.
- **CORS** is restricted to the known frontend origins; only `x-iv` / `x-enc-name` response
  headers are exposed.
- Transactional emails (verification, reset, security alerts) are sent over **SMTP**; links point
  at the frontend. A security alert email is sent whenever the password changes.
- Secrets (JWT secret, DB and SMTP credentials) are provided via environment variables and never
  committed.

---

## 7. What's done / partial / future

**Done**
- Real client-side E2EE (AES-GCM) for file contents and names.
- PBKDF2 envelope encryption with server-blind wrapped DEK.
- Email verification, SMTP password reset with key regeneration, password-changed alerts.
- Folders (nested), breadcrumbs, move/rename/delete for files and folders.

**Partial**
- Forgot-password sacrifices pre-reset files (documented trade-off). A logged-in
  "change password" that preserves files via DEK re-wrap is the next step.
- DEK is session-memory only: a reload requires re-login (secure but less convenient).

**Future**
- Multi-device recovery (e.g. a recovery key or per-device wrapped DEK).
- File sharing with per-recipient DEK wrapping.
- In-browser previews of decrypted images/text.
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
