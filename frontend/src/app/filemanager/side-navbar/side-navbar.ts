import { Component, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-side-navbar',
  imports: [RouterLink, RouterLinkActive, NgClass],
  templateUrl: './side-navbar.html',
})
export class SideNavbar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly collapsed = signal(false);
  protected readonly username = this.auth.username;

  toggle(): void {
    this.collapsed.update((v) => !v);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  toHome(): void {
    this.router.navigateByUrl('/home');
  }
}
