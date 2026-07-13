import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.html',
})
export class Navbar {
  // servizi per autenticazione e routing delle pagine
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // riuso i computed
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly username = this.auth.username;

  // metodo per uscire
  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  isLogin(): boolean {
    return this.router.url === '/login';
  }

  toLogin(): void {
    this.router.navigateByUrl('/login')
  }

  // brand SecureVault -> home
  toHome(): void {
    this.router.navigateByUrl('/')
  }
}
