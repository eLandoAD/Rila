import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { IResetInfoResponse } from '../../core/interfaces/IResetInfoResponse';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.html',
})
export class ResetPassword implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly crypto = inject(CryptoService);
  private readonly platformId = inject(PLATFORM_ID);

  recoveryKey = '';
  newPassword = '';
  confirmPassword = '';

  readonly loading = signal(false);
  readonly done = signal(false);
  readonly error = signal<string | null>(null);
  
  private resetInfo: IResetInfoResponse | null = null;
  private token = '';

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.error.set('Invalid or missing reset token.');
      return;
    }

    // Fetch E2EE metadata needed for recovery
    this.auth.getResetInfo(this.token).subscribe({
      next: (info) => {
        this.resetInfo = info;
      },
      error: () => {
        this.error.set('Invalid token or user data not found.');
      }
    });
  }

  async submit(): Promise<void> {
    if (this.loading() || !this.resetInfo) return;
    this.error.set(null);

    if (this.newPassword !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);

    try {
      // PERFORM THE RE-ENCRYPTION DANCE
      const result = await this.crypto.setupRecoveryKeys(
        this.recoveryKey,
        this.resetInfo.recoveryEncryptedDek,
        this.resetInfo.recoveryDekIv,
        this.resetInfo.keySalt,
        this.newPassword
      );

      this.auth.resetPassword({
        token: this.token,
        newPassword: this.newPassword,
        newEncryptedDek: result.newEncryptedDek,
        newDekIv: result.newDekIv
      }).subscribe({
        next: () => {
          this.loading.set(false);
          this.done.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(err.error?.message ?? 'Could not reset password.');
        },
      });
    } catch (err) {
      this.loading.set(false);
      this.error.set('Invalid Recovery Key. We could not decrypt your master key.');
    }
  }
}
