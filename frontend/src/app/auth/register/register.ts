import { Component, inject, signal } from '@angular/core';
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
  styleUrl: './register.css',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly crypto = inject(CryptoService);

  username = '';
  email = '';
  password = '';
  confirmPassword = '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly recoveryKey = signal<string | null>(null);

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
          recoveryDekIv: keys.recoveryDekIv
        })
        .subscribe({
          next: () => {
            this.loading.set(false);
            // Instead of redirecting immediately, show the recovery key
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

  finish(): void {
    this.router.navigateByUrl('/filemanager/files');
  }
}
