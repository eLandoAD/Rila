import { Component, computed, input } from '@angular/core';
import { BarDatum } from '../chart.types';

interface RenderedBar {
  datum: BarDatum;
  heightPercent: number;
  color: string;
}

@Component({
  selector: 'app-bar-chart',
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.css',
})
export class BarChart {
  readonly data = input.required<BarDatum[]>();
  readonly unit = input<string>('');

  protected readonly max = computed(() =>
    Math.max(1, ...this.data().map((d) => d.value)),
  );

  protected readonly bars = computed<RenderedBar[]>(() => {
    const max = this.max();
    return this.data().map((datum) => ({
      datum,
      heightPercent: (datum.value / max) * 100,
      color: datum.color ?? 'var(--color-primary)',
    }));
  });
}
