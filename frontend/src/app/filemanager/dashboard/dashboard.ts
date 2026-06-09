import { Component, computed, signal } from '@angular/core';
import { SideNavbar } from '../side-navbar/side-navbar';
import { DonutChart } from '../charts/donut-chart/donut-chart';
import { BarChart } from '../charts/bar-chart/bar-chart';
import { LineChart } from '../charts/line-chart/line-chart';
import { BarDatum, DonutSegment, LinePoint } from '../charts/chart.types';

@Component({
  selector: 'app-dashboard',
  imports: [SideNavbar, DonutChart, BarChart, LineChart],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  protected readonly usedGb = signal(64);
  protected readonly totalGb = signal(100);
  protected readonly percent = computed(() =>
    Math.round((this.usedGb() / this.totalGb()) * 100),
  );

  protected readonly storageSegments = computed<DonutSegment[]>(() => [
    { label: 'Used', value: this.usedGb(), color: 'var(--color-primary)' },
    { label: 'Free', value: this.totalGb() - this.usedGb(), color: 'var(--color-base-300)' },
  ]);

  protected readonly fileTypes = signal<DonutSegment[]>([
    { label: 'Documents', value: 28, color: 'var(--color-primary)' },
    { label: 'Images', value: 19, color: 'var(--color-secondary)' },
    { label: 'Videos', value: 12, color: 'var(--color-accent)' },
    { label: 'Other', value: 5, color: 'var(--color-info)' },
  ]);

  protected readonly uploadsPerDay = signal<BarDatum[]>([
    { label: 'Mon', value: 12 },
    { label: 'Tue', value: 19 },
    { label: 'Wed', value: 8 },
    { label: 'Thu', value: 24 },
    { label: 'Fri', value: 31 },
    { label: 'Sat', value: 6 },
    { label: 'Sun', value: 4 },
  ]);

  protected readonly storageTrend = signal<LinePoint[]>([
    { label: 'Jan', value: 32 },
    { label: 'Feb', value: 38 },
    { label: 'Mar', value: 41 },
    { label: 'Apr', value: 47 },
    { label: 'May', value: 55 },
    { label: 'Jun', value: 64 },
  ]);
}
