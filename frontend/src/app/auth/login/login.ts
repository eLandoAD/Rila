import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { CryptoService } from '../../core/crypto/crypto.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly crypto = inject(CryptoService);

  usernameOrEmail = '';
  password = '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly infoMessage = signal<string | null>(
    this.route.snapshot.queryParamMap.get('registered') === 'true'
      ? 'Registration successful! Please check your email to verify your account before logging in.'
      : null
  );

  submit(): void {
    if (this.loading()) {
      return;
    }
    this.error.set(null);
    this.loading.set(true);

    this.auth
      .login({ usernameOrEmail: this.usernameOrEmail, password: this.password })
      .subscribe({
        next: async (res) => {
          if (res.encryptedDek && res.dekIv && res.keySalt) {
            await this.crypto.setupLoginKeys(this.password, res.encryptedDek, res.dekIv, res.keySalt);
          }
          this.loading.set(false);
          const redirect =
            this.route.snapshot.queryParamMap.get('redirect') ?? '/filemanager/dashboard';
          this.router.navigateByUrl(redirect);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(
            err.error?.message ?? 'Login failed. Please check your credentials.',
          );
        },
      });
  }
}
