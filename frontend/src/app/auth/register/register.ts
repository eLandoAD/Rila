import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';

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

  username = '';
  email = '';
  password = '';
  confirmPassword = '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    if (this.loading()) {
      return;
    }
    this.error.set(null);

    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);

    this.auth.register(this.username, this.email, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        // l'account va verificato via email prima di poter accedere
        this.router.navigate(['/verify-email'], { queryParams: { email: this.email } });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? 'Registration failed. Please try again.');
      },
    });
  }
}
