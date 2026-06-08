# SecureVault — Encrypted File Storage

> **Intern Project Brief.** This is a competitive build. Three teams are building the same
> specification. The strongest implementation wins. Read this entire document before writing
> any code.

---

## 1. What you are building

A web application for **storing files securely with end-to-end encryption (E2EE)**.

The core idea: a user can upload files and organize them into folders, but the server can
**never** read the contents of those files. Files are encrypted *before* they leave the
browser and decrypted *only* after they are downloaded back into the browser. Even someone
with full access to your database and disk should see nothing but ciphertext.

This is a real, non-trivial engineering problem. Getting encryption *subtly* wrong is worse
than not having it, because it creates a false sense of security. A large part of how you
will be judged is whether your encryption is **actually** end-to-end.

---

## 2. Tech stack

| Layer | Technology | Choice |
|-------|-----------|--------|
| Backend | **Java + Spring Boot** | Fixed — required for all teams |
| Frontend | **React or Angular** | Your team's choice |
| Database | Your choice (PostgreSQL, MySQL, H2, etc.) | Your team's choice |
| File blob storage | Local filesystem or object storage | Your team's choice |

The backend is fixed so that all teams can be compared fairly. The frontend is your call —
choose the one your team is strongest in and be ready to justify the decision.

---

## 3. Core requirements

These are the **must-have** features. Aim to have all of them working by the end of the
sprint.

### 3.1 Authentication
- **Email sign-up** with a username/email and password.
- **Email verification** — a new account must confirm via a link or code sent to their email
  before it becomes active. (For local development you may "send" the email by logging the
  link to the console or writing it to a file — but the *flow* must exist.)
- **Login / logout** with proper session handling (JWT or server-side sessions).
- **Password reset** flow. ⚠️ Read section 4 carefully — password reset interacts badly with
  encryption if you are not careful.

### 3.2 File storage
- **Upload** a file.
- **Download** a file (and successfully decrypt it back to its original contents).
- **Rename** a file.
- **Delete** a file.
- The server must store **only ciphertext** — never the original file bytes, never the
  plaintext encryption key.

### 3.3 End-to-end encryption (the heart of the project)
- Encryption and decryption happen **client-side**, in the browser.
- The server stores encrypted blobs and has no ability to decrypt them.
- Your team must **document your key-management design** (see section 4) in a file called
  `SECURITY.md` in your repo. This document is part of your score.

### 3.4 Folders
- **Create, rename, and delete** folders.
- Folders can be **nested** (a folder inside a folder).
- **Move** a file from one folder to another.
- **Breadcrumb navigation** so the user can see and click their way back up the folder path.

### 3.5 Basic UX
- A clear file list or grid view.
- Upload progress feedback.
- Sensible empty states ("This folder is empty").
- Error handling — the app should not crash or hang on a failed upload, wrong password, etc.

---

## 4. The hard part: key management

This is where teams will separate. Read this section slowly.

**The goal:** the server must never be able to decrypt a user's files. That means the
encryption key cannot simply live on the server in plaintext.

**The standard approach** (you are free to improve on it, but understand it first):

1. When a user signs up, derive a **key-encryption key (KEK)** from their password using a
   slow password-hashing function — **Argon2** or **PBKDF2**, never a plain hash like SHA-256.
2. Generate a random **data key (DEK)** for the user. This is the key that actually encrypts
   their files.
3. Encrypt the DEK using the KEK. Store **only the encrypted DEK** on the server.
4. To work with files: the browser takes the password → derives the KEK → decrypts the DEK →
   uses the DEK to encrypt/decrypt files. The server never sees the password-derived KEK or
   the plaintext DEK.
5. Use a well-established symmetric cipher for the files themselves — **AES-GCM** is the
   expected choice. Do not invent your own.

**⚠️ The password-reset trap.** If your encryption key is derived from the password, then
changing the password naively changes the key — and now every previously uploaded file is
**permanently unrecoverable**. This is a real consequence of real E2EE. A strong solution
re-encrypts the stored DEK under the new password (you do *not* re-encrypt every file — only
the small DEK). How you handle this is a key differentiator. Think it through before you
build the reset flow.

**Do not:**
- Send the password or any derived key to the server in a way the server could store or log.
- Encrypt files on the server "for convenience." That defeats the entire project.
- Roll your own cipher. Use vetted libraries (Web Crypto API in the browser is your friend).

You do **not** have to use the exact scheme above. If your team has a better, well-reasoned
design, document it in `SECURITY.md` and defend it. Originality with sound reasoning scores
well.

---

## 5. Suggested build order (milestones)

You have limited time. Build in this order so that you always have something working to demo.

1. **Project skeleton** — Spring Boot backend runs, frontend runs, they talk to each other.
2. **Authentication** — sign-up, email verification, login, logout.
3. **File storage (unencrypted first)** — get upload / download / rename / delete working
   end-to-end. Prove the plumbing works *before* adding encryption.
4. **Encryption** — add client-side encryption/decryption on top of working storage.
5. **Folders** — create/rename/delete/nest, move files, breadcrumbs.
6. **Password reset** — including the key re-encryption handling from section 4.
7. **Polish** — UX, error handling, empty states, progress indicators.
8. **Stretch goals** — only after everything above works.

> **Tip:** Get step 3 fully working before step 4. Debugging a broken upload *and* broken
> encryption at the same time is painful. Add encryption only once plain storage is solid.

---

## 6. Stretch goals (for extra credit)

Attempt these **only after every core requirement works.**

- **True client-side E2EE with device-key recovery** — let a user log in on a second device
  and still decrypt their files.
- **File sharing** — share an encrypted file with another user (this is genuinely hard with
  E2EE — think about how the recipient gets the key).
- **Search** across file and folder names.
- **File previews** (images, text) — decrypted in-browser.
- **Drag-and-drop** uploads and moves.
- **Storage quota** per user.

---

## 7. How you will be judged

| Criterion | Weight | What we look for |
|-----------|--------|------------------|
| **Security correctness** | 35% | Is the E2EE real? Is the server truly blind to plaintext? Sound key derivation? Sensible password-reset handling? |
| **Functionality** | 25% | Do auth, folders, and file operations all work end-to-end? |
| **Code quality** | 15% | Structure, readability, tests, sensible commits, clean Git history. |
| **UX & polish** | 15% | Is it usable? Clean? Does it handle errors gracefully? |
| **Design defense** | 10% | Can your team explain your key-management design and the tradeoffs you made? |

A working app with **real** encryption beats a fancy-looking app with fake encryption. Spend
your effort accordingly.

---

## 8. Working agreement & logistics

- **Daily standup** — 15 minutes each morning. Say what you did, what you're doing, and what's
  blocking you.
- **Git hygiene** — work on branches, open pull requests, review each other's code before
  merging. **No direct commits to `main`** without a review.
- **Ask early** — if you are stuck for more than ~30 minutes, ask your covering mentor. Being
  stuck silently helps no one.
- **Document as you go** — your `README.md` (how to run it) and `SECURITY.md` (how encryption
  works) are part of your deliverable, not an afterthought.

---

## 9. Deliverables

By the end of the sprint, your repo should contain:

1. The working application (backend + frontend).
2. A **`README.md`** with clear setup instructions — how to run the backend, the frontend, and
   any database setup. A reviewer should be able to clone and run it.
3. A **`SECURITY.md`** explaining your encryption and key-management design, and how you handle
   password reset.
4. A short list of what's done, what's partial, and what you'd do with more time.

---

Good luck. Build something you'd trust with your own files.
