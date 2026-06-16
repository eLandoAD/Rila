import { Component, computed, signal, OnInit, inject } from '@angular/core';
import { SideNavbar } from '../side-navbar/side-navbar';
import { DonutChart } from '../charts/donut-chart/donut-chart';
import { BarChart } from '../charts/bar-chart/bar-chart';
import { LineChart } from '../charts/line-chart/line-chart';
import { BarDatum, DonutSegment, LinePoint } from '../charts/chart.types';
import { FileService } from '../../core/files/file.service';
import { StoredFileMeta } from '../../core/files/file.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [SideNavbar, DonutChart, BarChart, LineChart],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private readonly fileService = inject(FileService);

  protected readonly usedGb = signal(0);
  protected readonly totalGb = signal(1.0); // 1.0 GB total quota for demo
  protected readonly percent = computed(() => {
    if (this.totalGb() === 0) return 0;
    return Math.round((this.usedGb() / this.totalGb()) * 100);
  });

  protected readonly storageSegments = computed<DonutSegment[]>(() => [
    { label: 'Used', value: this.usedGb(), color: 'var(--color-primary)' },
    { label: 'Free', value: Math.max(0, this.totalGb() - this.usedGb()), color: 'var(--color-base-300)' },
  ]);

  protected readonly fileTypes = signal<DonutSegment[]>([
    { label: 'Documents', value: 0, color: 'var(--color-primary)' },
    { label: 'Images', value: 0, color: 'var(--color-secondary)' },
    { label: 'Videos', value: 0, color: 'var(--color-accent)' },
    { label: 'Other', value: 0, color: 'var(--color-info)' },
  ]);

  protected readonly uploadsPerDay = signal<BarDatum[]>([
    { label: 'Mon', value: 0 },
    { label: 'Tue', value: 0 },
    { label: 'Wed', value: 0 },
    { label: 'Thu', value: 0 },
    { label: 'Fri', value: 0 },
    { label: 'Sat', value: 0 },
    { label: 'Sun', value: 0 },
  ]);

  protected readonly storageTrend = signal<LinePoint[]>([
    { label: 'Jan', value: 0 },
    { label: 'Feb', value: 0 },
    { label: 'Mar', value: 0 },
    { label: 'Apr', value: 0 },
    { label: 'May', value: 0 },
    { label: 'Jun', value: 0 },
  ]);

  async ngOnInit(): Promise<void> {
    try {
      const files = await this.fileService.getAllFiles();
      this.calculateStats(files);
    } catch (err) {
      console.error('Failed to load dashboard statistics', err);
    }
  }

  private calculateStats(files: StoredFileMeta[]): void {
    // 1. Storage Used
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    const gbValue = totalBytes / (1024 * 1024 * 1024);
    // Round to 3 decimal places (e.g., 0.005 GB)
    this.usedGb.set(Math.round(gbValue * 1000) / 1000);

    // 2. File Categories Count
    let docs = 0;
    let images = 0;
    let videos = 0;
    let other = 0;

    files.forEach((f) => {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      if (['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.ppt', '.pptx', '.md', '.json'].includes(ext)) {
        docs++;
      } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
        images++;
      } else if (['.mp4', '.mov', '.avi', '.mkv', '.mp3', '.wav'].includes(ext)) {
        videos++;
      } else {
        other++;
      }
    });

    this.fileTypes.set([
      { label: 'Documents', value: docs, color: 'var(--color-primary)' },
      { label: 'Images', value: images, color: 'var(--color-secondary)' },
      { label: 'Videos', value: videos, color: 'var(--color-accent)' },
      { label: 'Other', value: other, color: 'var(--color-info)' },
    ]);

    // 3. Uploads in the last 7 days
    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7Days: { label: string; dateStr: string; count: number }[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push({
        label: weekdayLabels[d.getDay()],
        dateStr: d.toDateString(),
        count: 0
      });
    }

    files.forEach((f) => {
      const uploadDateStr = new Date(f.uploadedAt).toDateString();
      const match = last7Days.find((day) => day.dateStr === uploadDateStr);
      if (match) {
        match.count++;
      }
    });

    this.uploadsPerDay.set(
      last7Days.map((day) => ({ label: day.label, value: day.count }))
    );

    // 4. Storage growth trend by month (last 6 months)
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trend: { label: string; monthIndex: number; year: number; bytes: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      trend.push({
        label: monthLabels[d.getMonth()],
        monthIndex: d.getMonth(),
        year: d.getFullYear(),
        bytes: 0
      });
    }

    // Calculate cumulative storage up to each month
    trend.forEach((t) => {
      // Find all files uploaded before or during this month
      const sizeUpToMonth = files
        .filter((f) => {
          const fDate = new Date(f.uploadedAt);
          return fDate.getFullYear() < t.year || 
                 (fDate.getFullYear() === t.year && fDate.getMonth() <= t.monthIndex);
        })
        .reduce((sum, f) => sum + f.size, 0);

      t.bytes = sizeUpToMonth;
    });

    this.storageTrend.set(
      trend.map((t) => {
        const gb = t.bytes / (1024 * 1024 * 1024);
        return {
          label: t.label,
          value: Math.round(gb * 1000) / 1000
        };
      })
    );
  }
}
