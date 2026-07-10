import { Component, inject, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { CryptoService } from '../../core/crypto/crypto.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly crypto = inject(CryptoService);

  username = '';
  email = '';
  password = '';
  confirmPassword = '';

  readonly loading: WritableSignal<boolean> = signal(false);
  readonly error: WritableSignal<string | null> = signal<string | null>(null);
  readonly recoveryKey: WritableSignal<string | null> = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.loading()) return;
    this.error.set(null);

    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);

    try {
      // Generate all keys including the Recovery Key
      const keys = await this.crypto.setupRegistrationKeys(this.password);
      
      this.auth
        .register({ 
          username: this.username, 
          email: this.email, 
          password: this.password,
          encryptedDek: keys.encryptedDek,
          dekIv: keys.iv,
          keySalt: keys.salt,
          recoveryEncryptedDek: keys.recoveryEncryptedDek,
          recoveryDekIv: keys.recoveryDekIv,
          publicKey: keys.publicKey,
          encryptedPrivateKey: keys.encryptedPrivateKey,
          privateKeyIv: keys.privateKeyIv
        })
        .subscribe({
          next: () => {
            this.loading.set(false);
            // invece di fare il redirect, mostro la recovery key
            this.recoveryKey.set(keys.recoveryKey);
          },
          error: (err: HttpErrorResponse) => {
            this.loading.set(false);
            this.error.set(err.error?.message ?? 'Registration failed.');
          },
        });
    } catch (err) {
      this.loading.set(false);
      this.error.set('Critical error during encryption setup.');
    }
  }

  readonly copied = signal(false);
  readonly downloaded = signal(false);
  readonly acknowledged = signal(false);

  async copyKey(): Promise<void> {
    const key = this.recoveryKey();
    if (key) {
      await navigator.clipboard.writeText(key);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }
  }

  downloadKey(): void {
    const key = this.recoveryKey();
    if (!key) return;

    const content = [
      'SecureVault — Recovery Information',
      '==================================',
      '',
      `Username:      ${this.username}`,
      `Email:         ${this.email}`,
      `Generated:     ${new Date().toLocaleString()}`,
      '',
      'PASSWORD RECOVERY KEY:',
      key,
      '',
      'IMPORTANT',
      '---------',
      '- Keep this file in a safe, private place.',
      '- It is the ONLY way to reset your password without losing your encrypted files.',
      '- SecureVault uses zero-knowledge encryption: this key is NEVER stored on the',
      '  server and cannot be recovered if lost.',
      '- Anyone with this key can reset your password, so do not share it.',
      '',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `securevault-recovery-${this.username || 'account'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.downloaded.set(true);
  }

  // dopo aver salvato la recovery key vado al login; la verifica avviene via email
  finish(): void {
    this.router.navigateByUrl('/login?registered=true');
  }
}
