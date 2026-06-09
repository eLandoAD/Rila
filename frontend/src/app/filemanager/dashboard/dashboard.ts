import { Component, computed, signal } from '@angular/core';
import { SideNavbar } from '../side-navbar/side-navbar';

@Component({
  selector: 'app-dashboard',
  imports: [SideNavbar],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  protected readonly usedGb = signal(64);
  protected readonly totalGb = signal(100);
  protected readonly percent = computed(() =>
    Math.round((this.usedGb() / this.totalGb()) * 100),
  );
}
