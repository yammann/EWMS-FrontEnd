import { Component, input } from '@angular/core';
import { Stamp } from '@shared/ui/stamp';

/** حلقة كنتورية متموّجة حول المركز (خطوط ارتفاع كالخرائط الطبوغرافية) — مسار ثابت يُحسب مرة واحدة */
function contour(r: number, seed: number): string {
  const points = 72;
  let d = '';
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const wobble = 1 + .07 * Math.sin(a * 3 + seed) + .045 * Math.sin(a * 5 - seed * 1.7) + .03 * Math.sin(a * 9 + seed * .6);
    const x = 500 + Math.cos(a) * r * 1.45 * wobble;
    const y = 330 + Math.sin(a) * r * wobble;
    d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
  }
  return d + 'Z';
}

const RINGS = [70, 120, 170, 225, 285, 350, 420].map((r, i) => ({ d: contour(r, i * 1.3 + .4), w: i % 3 === 0 ? 1.4 : .9 }));

/** طوابع منثورة عند الأطراف: الموضع، الميل، العرض، ومدة الطفو */
const STAMPS = [
  { code: 'SY02', x: '4%', y: '8%', r: '-9deg', w: '108px', d: '17s' },
  { code: 'SY06', x: '84%', y: '6%', r: '7deg', w: '96px', d: '21s' },
  { code: 'SY04', x: '90%', y: '52%', r: '-5deg', w: '104px', d: '19s' },
  { code: 'SY13', x: '3%', y: '62%', r: '6deg', w: '100px', d: '23s' },
  { code: 'SY09', x: '72%', y: '80%', r: '-4deg', w: '88px', d: '18s' },
  { code: 'SY01', x: '18%', y: '84%', r: '5deg', w: '84px', d: '20s' }
];

/**
 * خلفية الخريطة ثلاثية الأبعاد (2026-10-13، اقتراح للمستخدم): هالة بلون الهوية، شبكة نقطية تتلاشى نحو الأطراف،
 * خطوط كنتورية تدور ببطء شديد، نبضة رادار من مركز الخريطة، وطوابع المحافظات باهتة تطفو عند الأطراف
 * (تختفي عند فتح محافظة ليبقى طابعها وحده). CSS فقط — ألوان الثيم، والحركة تتوقف مع «تقليل الحركة».
 */
@Component({
  selector: 'app-map-backdrop', standalone: true, imports: [Stamp],
  template: `
    <div class="glow"></div>
    <div class="dots"></div>
    <svg class="contours" viewBox="0 0 1000 660" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g class="spin">
        @for (ring of rings; track $index) { <path [attr.d]="ring.d" [attr.stroke-width]="ring.w" /> }
      </g>
      <ellipse class="ping" cx="500" cy="330" rx="145" ry="100" />
      <ellipse class="ping late" cx="500" cy="330" rx="145" ry="100" />
    </svg>
    <div class="stamps" [class.away]="focused()">
      @for (s of stamps; track s.code) {
        <app-stamp class="float" [code]="s.code" variant="plain" [style.--x]="s.x" [style.--y]="s.y" [style.--r]="s.r" [style.--w]="s.w" [style.--d]="s.d" />
      }
    </div>`,
  styleUrl: './map-backdrop.scss',
  host: { 'aria-hidden': 'true' }
})
export class MapBackdrop {
  /** محافظة مفتوحة: تختفي الطوابع المنثورة */
  focused = input(false);
  protected rings = RINGS;
  protected stamps = STAMPS;
}
