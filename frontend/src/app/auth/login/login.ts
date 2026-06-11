import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';

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

  usernameOrEmail = '';
  password = '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    if (this.loading()) {
      return;
    }
    this.error.set(null);
    this.loading.set(true);

    this.auth
      .login({ usernameOrEmail: this.usernameOrEmail, password: this.password })
      .subscribe({
        next: () => {
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
