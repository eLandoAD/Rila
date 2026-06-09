import { Component, computed, input } from '@angular/core';
import { LinePoint } from '../chart.types';

const VIEW_W = 100;
const VIEW_H = 40;
const PAD_Y = 4;

let instanceId = 0;

@Component({
  selector: 'app-line-chart',
  templateUrl: './line-chart.html',
  styleUrl: './line-chart.css',
})
export class LineChart {
  readonly data = input.required<LinePoint[]>();
  readonly color = input<string>('var(--color-primary)');
  readonly unit = input<string>('');

  protected readonly viewW = VIEW_W;
  protected readonly viewH = VIEW_H;
  protected readonly gradientId = `line-gradient-${instanceId++}`;

  private readonly coords = computed(() => {
    const points = this.data();
    if (points.length === 0) return [] as { x: number; y: number }[];

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stepX = points.length > 1 ? VIEW_W / (points.length - 1) : 0;
    const usableH = VIEW_H - PAD_Y * 2;

    return points.map((p, i) => ({
      x: i * stepX,
      y: PAD_Y + (1 - (p.value - min) / span) * usableH,
    }));
  });

  protected readonly linePath = computed(() => {
    const c = this.coords();
    if (c.length === 0) return '';
    return c.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  });

  protected readonly areaPath = computed(() => {
    const c = this.coords();
    if (c.length === 0) return '';
    const line = c.map((p) => `L${p.x},${p.y}`).join(' ');
    return `M0,${VIEW_H} ${line} L${VIEW_W},${VIEW_H} Z`;
  });
}
