import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SideNavbar } from '../side-navbar/side-navbar';
import { AuthService } from '../../core/auth/auth.service';
import { FileService } from '../../core/files/file.service';

@Component({
  selector: 'app-settings',
  imports: [SideNavbar, RouterLink],
  templateUrl: './settings.html',
})
export class Settings implements OnInit {
  // services
  private readonly auth = inject(AuthService);
  private readonly fileService = inject(FileService);
  private readonly router = inject(Router);

  // data
  readonly username = this.auth.username;
  readonly usedGb = signal(0);
  readonly totalGb = signal(10);

  readonly initials = computed(() => {
    // clean up the string
    const u = (this.username() ?? 'User').trim()
    const parts = u.split(/\s+/)
    const raw = parts.length > 1 ? parts[0][0] + parts[1][0] : u.slice(0, 2);
    return raw.toUpperCase()
  })

  async ngOnInit(): Promise<void> {
    try {
      const files = await this.fileService.getAllFiles()
      // sum all bytes, then convert to gb
      const bytes = files.reduce((s, f) => s + f.size, 0);

      // convert to GB rounded to 2 decimals (*100 -> round -> /100)
      this.usedGb.set(Math.round(bytes / (1024**3) * 100) / 100);
    } catch {
      // no backend in dev: leave at 0
    }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  readonly deleting = signal(false);

  async deleteAccount(): Promise<void> {
    const ok = confirm('Delete your account and ALL your files permanently? This cannot be undone.');
    if (!ok) return;

    this.deleting.set(true);
    try {
      await firstValueFrom(this.auth.deleteAccount());
      // account deleted: clear the session and go back to login
      this.auth.logout();
      this.router.navigateByUrl('/login');
    } catch {
      alert('Failed to delete account. Please try again.');
      this.deleting.set(false);
    }
  }
}
