import { Component, input, output } from '@angular/core';
import { Icon } from './icon';

/**
 * صندوق بحث موحّد فوق القوائم المحمّلة في الواجهة (الموظفون والمكاتب والأقسام…): أيقونة بحث وزر مسح.
 * الصفحة تحتفظ بالنص في signal وتفلتر بـ `searchMatcher` من `@core/utils/text-search`.
 */
@Component({
  selector: 'app-list-search',
  standalone: true,
  imports: [Icon],
  template: `
    <div class="list-search">
      <app-icon name="search" [size]="16" />
      <input #box type="search" [value]="value()" [placeholder]="placeholder()" [attr.aria-label]="label() || placeholder()" autocomplete="off"
             (input)="valueChange.emit(box.value)" (keydown.escape)="clear(box)">
      @if (value()) {
        <button type="button" class="clear" aria-label="مسح البحث" (click)="clear(box)"><app-icon name="xmark" [size]="14" /></button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; margin: 0 0 16px; }
    .list-search { position: relative; display: flex; align-items: center; max-width: 460px; }
    .list-search > app-icon { position: absolute; inset-inline-start: 12px; color: var(--ink-400); pointer-events: none; }
    input { width: 100%; padding-inline-start: 38px; padding-inline-end: 38px; }
    input::-webkit-search-cancel-button { display: none; }
    .clear { position: absolute; inset-inline-end: 6px; display: grid; place-items: center; width: 28px; height: 28px; min-height: 0; padding: 0;
      background: transparent; color: var(--ink-500); box-shadow: none; border-radius: 50%; }
    .clear:hover:not(:disabled) { background: var(--fill); transform: none; box-shadow: none; }
  `]
})
export class ListSearch {
  value = input('');
  placeholder = input('بحث…');
  label = input('');
  valueChange = output<string>();

  clear(box: HTMLInputElement) { box.value = ''; this.valueChange.emit(''); box.focus(); }
}
