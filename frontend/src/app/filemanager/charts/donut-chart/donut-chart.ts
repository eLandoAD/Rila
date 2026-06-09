import { Component, computed, input } from '@angular/core';
import { DonutSegment } from '../chart.types';

interface DonutArc {
  segment: DonutSegment;
  dashArray: string;
  dashOffset: number;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

@Component({
  selector: 'app-donut-chart',
  templateUrl: './donut-chart.html',
  styleUrl: './donut-chart.css',
})
export class DonutChart {
  readonly segments = input.required<DonutSegment[]>();
  readonly centerLabel = input<string>('');
  readonly centerValue = input<string>('');
  readonly thickness = input<number>(12);

  protected readonly radius = RADIUS;

  protected readonly total = computed(() =>
    this.segments().reduce((sum, s) => sum + s.value, 0),
  );

  protected readonly arcs = computed<DonutArc[]>(() => {
    const total = this.total();
    if (total <= 0) return [];

    let consumed = 0;
    return this.segments().map((segment) => {
      const fraction = segment.value / total;
      const length = fraction * CIRCUMFERENCE;
      const arc: DonutArc = {
        segment,
        dashArray: `${length} ${CIRCUMFERENCE - length}`,
        dashOffset: -consumed,
      };
      consumed += length;
      return arc;
    });
  });
}
