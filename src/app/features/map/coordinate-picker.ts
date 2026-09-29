import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { GovernorateFeature, governorateOf } from '../../core/utils/geo';
import { MapPoint, SyriaSvgMap } from './syria-svg-map';

export interface Coordinates { latitude: number; longitude: number; }

/**
 * اختيار الإحداثيات على خريطة سوريا (بدون إنترنت): اختر المحافظة أولاً ثم انقر على المكان بدقة،
 * أو اكتب الإحداثيات يدوياً. يُستخدم في نماذج المناطق والمواقع.
 */
@Component({
  selector: 'app-coordinate-picker', standalone: true, imports: [SyriaSvgMap],
  template: `
    <div class="picker">
      <div class="hint-bar">
        @if (focus()) {
          <span>انقر داخل <strong>{{ focusName() }}</strong> على المكان بدقة · <em>الزر الأيمن للرجوع إلى كل سوريا</em></span>
        } @else {
          <span>اختر المحافظة أولاً، ثم انقر على المكان بدقة</span>
        }
      </div>
      <app-syria-svg-map [focus]="focus()" [points]="points()" [pickable]="true" height="300px"
                         (governorateSelect)="focus.set($event)" (back)="focus.set(null)" (pick)="picked.emit($event)" (ready)="features.set($event)" />
      <div class="picker-bar">
        <label>خط العرض<input type="number" step="0.00001" dir="ltr" [value]="latitude() ?? ''" (change)="manual('lat', $any($event.target).value)"></label>
        <label>خط الطول<input type="number" step="0.00001" dir="ltr" [value]="longitude() ?? ''" (change)="manual('lng', $any($event.target).value)"></label>
        <span class="gov">{{ governorate() ? '📍 ' + governorate() : (latitude() != null ? 'خارج حدود المحافظات' : 'لم تُحدَّد النقطة بعد') }}</span>
      </div>
    </div>`,
  styles: [`
    .picker { display: grid; gap: 8px; }
    .hint-bar { display: flex; align-items: center; gap: 10px; min-height: 30px; font-size: 12px; color: var(--ink-600); }
    .hint-bar em { font-style: normal; color: var(--ink-400); }
    .picker-bar { display: flex; flex-wrap: wrap; align-items: end; gap: 10px; }
    .picker-bar label { display: grid; gap: 4px; font-size: 12px; font-weight: 700; color: var(--ink-600); flex: 1; min-width: 130px; }
    .gov { font-size: 12px; font-weight: 700; color: var(--brand-700); padding-bottom: 10px; }
  `]
})
export class CoordinatePicker {
  latitude = input<number | null>(null);
  longitude = input<number | null>(null);
  picked = output<Coordinates>();

  features = signal<GovernorateFeature[]>([]);
  focus = signal<string | null>(null);

  private current = computed(() => governorateOf(this.latitude(), this.longitude(), this.features()));
  governorate = computed(() => this.current()?.properties.nameAr ?? '');
  focusName = computed(() => this.features().find(f => f.properties.code === this.focus())?.properties.nameAr ?? '');

  points = computed<MapPoint[]>(() => {
    const [lat, lng] = [this.latitude(), this.longitude()];
    return lat == null || lng == null ? [] : [{ id: 0, latitude: lat, longitude: lng, label: 'النقطة المحددة', selected: true }];
  });

  constructor() {
    // عند فتح نموذج تعديل (أو إدخال يدوي) نعرض محافظة النقطة مباشرة
    effect(() => {
      const code = this.current()?.properties.code;
      if (code) untracked(() => { if (!this.focus()) this.focus.set(code); });
    });
  }

  manual(which: 'lat' | 'lng', raw: string) {
    const value = Number(raw);
    if (!raw || Number.isNaN(value)) return;
    const lat = which === 'lat' ? value : this.latitude();
    const lng = which === 'lng' ? value : this.longitude();
    if (lat != null && lng != null) this.picked.emit({ latitude: lat, longitude: lng });
  }
}
