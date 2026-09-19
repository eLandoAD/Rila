import { Component, computed, inject, signal } from '@angular/core';
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

  // avatar rendered locally: sending the username to an avatar CDN would leak
  // it to a third party on every page load, and the enforced CSP blocks it anyway
  protected readonly initials = computed(() => {
    const name = this.username()?.trim();
    if (!name) return '?';
    return name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  });

  toggle(): void {
    this.collapsed.update((v) => !v);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

}
