import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.css',
})
export class VerifyEmail implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly email = this.route.snapshot.queryParamMap.get('email');
  private readonly token = this.route.snapshot.queryParamMap.get('token');

  // 'pending' = waiting for the user to click the email link (no token yet)
  readonly state = signal<'pending' | 'verifying' | 'verified' | 'error'>(
    this.token ? 'verifying' : 'pending',
  );
  readonly loading = signal(false);
  readonly resent = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (this.token) {
      this.auth.verifyEmail(this.token).subscribe({
        next: () => this.state.set('verified'),
        error: (err: HttpErrorResponse) => {
          this.state.set('error');
          this.error.set(err.error?.message ?? 'This verification link is invalid or has expired.');
        },
      });
    }
  }

  resend(): void {
    if (this.loading() || !this.email) {
      return;
    }
    this.error.set(null);
    this.loading.set(true);

    this.auth.resendVerification(this.email).subscribe({
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
