import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './verify-email.html',
})
export class VerifyEmail implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);

  emailInput = this.route.snapshot.queryParamMap.get('email') ?? '';
  private readonly token = this.route.snapshot.queryParamMap.get('token');

  // 'pending' = waiting for the user to click the email link (no token yet)
  readonly state = signal<'pending' | 'verifying' | 'verified' | 'error'>(
    this.token ? 'verifying' : 'pending',
  );
  readonly loading = signal(false);
  readonly resent = signal(false);
  readonly error = signal<string | null>(null);

  // states for automatic verification from the email link
  readonly verifying = signal(false);
  readonly verified = signal(false);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    // if we arrive from the email link (with a token), verify immediately, without user action
    if (this.token) {
      this.verifying.set(true);
      this.auth.verifyEmail(this.token).subscribe({
        next: () => {
          this.verifying.set(false);
          this.verified.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.verifying.set(false);
          this.error.set(err.error?.message ?? 'Invalid or expired verification link.');
        },
      });
    }
  }

  resend(): void {
    const email = this.emailInput.trim();
    if (this.loading() || !email) {
      return;
    }
    this.error.set(null);
    this.loading.set(true);

    this.auth.resendVerification(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.resent.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? 'Could not resend the email. Please try again.');
      },
    });
  }
}
