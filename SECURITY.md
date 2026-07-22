# SecureVault — Security & Key-Management Design

How SecureVault encrypts user data, how keys are derived and wrapped, and how sharing and
password reset work without ever exposing plaintext to the server. Guiding principle:

> **The server can never read a user's files or file/folder names.**
> It only ever stores ciphertext and opaque key material it cannot unwrap.

All cryptography runs in the browser via the **Web Crypto API** (`crypto.subtle`). No key or
plaintext ever leaves the device.

---

## 1. Threat model

We protect the confidentiality of file **contents** and **names** against:

- An attacker with full read access to the database and the on-disk blob storage.
- A curious or compromised server operator.
- Passive network observers (TLS assumed in production).

**Out of scope:** a compromised browser/endpoint (malware, malicious extension, XSS at unlock
time), and metadata the server necessarily sees — file sizes, counts, timestamps, and the
folder tree structure.

---

## 2. Primitives

| Purpose | Algorithm | Parameters |
|---------|-----------|------------|
| File & name encryption | **AES-GCM** | 256-bit key, fresh random 96-bit IV per operation |
| Key derivation (KEK) | **PBKDF2-HMAC-SHA-256** | **600 000** iterations, per-user 128-bit salt |
| DEK / key wrapping | **AES-GCM** | authenticated wrap of every key at rest |
| Sharing keypair | **RSA-OAEP** | 2048-bit modulus, SHA-256 |
| Password hashing (server) | **BCrypt** | cost factor 12 — authentication only, unrelated to E2EE |

AES-GCM is authenticated encryption: any tampering with ciphertext is detected on decryption.
A fresh random IV is used for every operation; IVs are never reused.

PBKDF2 is used (rather than Argon2) because it is natively available in the Web Crypto API with
no third-party dependency — a fully browser-audited path. Migrating to Argon2 (via WASM) is a
documented future improvement.

---

## 3. Key hierarchy (three tiers)

SecureVault uses nested envelope encryption so that the password can change, files can be shared,
and accounts can be recovered — all without ever re-encrypting file contents.

```
                 ┌── PBKDF2(password, salt, 600k) ──▶ password-KEK ──┐
                 │                                                     ├─ AES-GCM wrap ─▶ master DEK   (stored wrapped ×2)
                 └── PBKDF2(recovery key, salt, 600k) ▶ recovery-KEK ─┘
                                                                          │
   master DEK (random AES-256)  ── AES-GCM wrap ─▶  per-file DEK          │ (one per file)
   master DEK                   ── AES-GCM wrap ─▶  RSA private key       │
                                                                          │
   per-file DEK (random AES-256) ── AES-GCM ─▶  file bytes + file name
```

- **Master DEK** — a random AES-256 key generated once at sign-up. It never touches file bytes
  directly; it only *wraps* other keys. It is stored wrapped **twice**: once under the
  password-KEK, once under the recovery-KEK.
- **Per-file DEK** — every file gets its own random AES-256 key that encrypts that file's bytes
  and its name. The per-file DEK is stored wrapped by the master DEK.
- **RSA-OAEP 2048 keypair** — generated per user for sharing. The **public** key is stored in the
  clear; the **private** key is stored wrapped by the master DEK.
- All of master DEK, per-file DEKs and the RSA private key live **in browser memory only** for the
  session; none are ever written to `localStorage`/`sessionStorage` or sent to the server.

---

## 4. What the server stores

| Data | Column / location |
|------|-------------------|
| File contents | AES-GCM ciphertext blob on disk under a random UUID `storagePath` |
| File / folder names | AES-GCM ciphertext (`encName`) + its IV |
| Per-file content IV | `iv` (needed to decrypt, useless without the per-file DEK) |
| Per-file DEK (wrapped) | `wrappedDek` + `dekIv` on the file row |
| Master DEK (wrapped ×2) | `encryptedDek`/`dekIv` (password) and `recoveryEncryptedDek`/`recoveryDekIv` (recovery) |
| PBKDF2 salt | `keySalt` on the user row |
| RSA public key | `publicKey` (cleartext — public by design) |
| RSA private key (wrapped) | `encryptedPrivateKey` + `privateKeyIv` |
| Password | BCrypt hash — authentication only, never used to derive file keys |

The server can list, move, rename and delete *ciphertext* objects, but can never recover a
plaintext file, filename, or any usable key.

---

## 5. Data flows

- **Sign-up** — the browser generates: salt, master DEK, RSA keypair, and a human-readable
  recovery key (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` alphabet, shown once). It derives the
  password-KEK and recovery-KEK, wraps the master DEK under both, wraps the RSA private key under
  the master DEK, and sends only the wrapped material + public key + salt to the server.
- **Login** — the server returns the wrapped master DEK, salt and wrapped RSA private key after
  verifying the BCrypt hash. The browser re-derives the password-KEK, unwraps the master DEK into
  memory, and unwraps the RSA private key.
- **Upload** — the browser generates a fresh per-file DEK, encrypts the file bytes and the name
  with it (fresh IVs), wraps the per-file DEK under the master DEK, and uploads only ciphertext +
  IVs + wrapped DEK + encrypted name.
- **Download** — the browser fetches the ciphertext, unwraps the per-file DEK with the master DEK,
  and decrypts locally.
- **Folders** — folder names are encrypted exactly like filenames; the server only manipulates the
  (ciphertext) tree structure.

---

## 6. Sharing

**User → user (`SharedFile`)** — to share a file, the sender unwraps that file's per-file DEK,
then re-encrypts the raw DEK to the **recipient's RSA public key** (RSA-OAEP). The result is stored
as `SharedFile.dek`. The recipient unwraps it with their RSA private key (itself unwrapped by their
master DEK). The server relays an opaque wrapped key it cannot read; it never sees the file DEK.

**Public links** — publishing a file exports its per-file DEK as base64 and places it in the URL
**fragment** (`#…`). Fragments are never sent to the server in an HTTP request, so the key stays
client-side: anyone with the full link can decrypt in-browser, while the server only ever sees the
opaque share token and ciphertext.

---

## 7. Password reset (no data loss)

Naively re-deriving the key from a new password would orphan every existing file. The recovery
key avoids this:

1. At sign-up the master DEK is wrapped under **two** independent KEKs — password and recovery.
2. On reset the user supplies the **recovery key**. The browser derives the recovery-KEK, unwraps
   the master DEK, then re-wraps the **same** master DEK under a KEK derived from the new password.
3. The server receives the new password hash and the new `encryptedDek`/`dekIv` and updates only
   those fields. **No file is ever re-encrypted** — only the small wrapped master DEK changes, so
   all existing data (and shares) remain decryptable.

The reset email link is time-limited and points at the frontend, which performs the client-side
re-wrap and sends only the new wrapped material to the server.

---

## 8. Session model

The master DEK, per-file DEKs and RSA private key exist **only in browser memory** for the
session and are wiped on logout. After a full page reload the vault re-derives them from the
session (or asks the user to log in again). The plaintext keys are never persisted where the
server or an XSS payload could exfiltrate them across reloads — a deliberate trade-off favouring
security over convenience.

---

## 9. Transport & application security

- **JWT** bearer auth (stateless), attached by an HTTP interceptor; expiry checked client-side.
- Every file/folder operation re-checks **ownership server-side** against the authenticated user.
- **CORS** restricted to known frontend origins; only `x-iv` / `x-enc-name` response headers are
  exposed (needed to decrypt downloads).
- Security response headers at the reverse proxy: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a Content-Security-Policy
  (currently **report-only**, to be enforced).
- Transactional emails (verification, password reset, share notifications) are sent over a real
  **SMTP** relay in production; links point at the frontend.
- Secrets (JWT secret, DB and SMTP credentials) are provided via environment variables and are
  never committed.

---

## 10. Trade-offs & future work

- **PBKDF2 → Argon2** (via WASM) for stronger resistance to GPU cracking.
- **Enforce CSP** (currently report-only) once external avatar images are self-hosted.
- The recovery key reuses the user salt for simplicity; a distinct salt would be marginally
  stronger.
- A compromised browser at unlock time can read the in-memory keys — inherent to any browser-based
  E2EE and outside the server threat model.
