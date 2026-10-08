import { Component, computed, inject, output, signal } from '@angular/core';
import { PlacesService } from '@core/services/places.service';
import { PLACES_ATTRIBUTION, PLACE_TYPE_LABEL, Place, PlaceIndex } from '@core/utils/places';
import { governorateName } from '@core/constants/governorates';

/**
 * بحث بأسماء الأماكن السورية (بدون إنترنت): اكتب «المزة» أو «حلب» فتظهر قائمة نتائج مرتبة،
 * واختيار نتيجة يُرسل مكانها ليقفز إليه المُحدِّد على الخريطة ثم تضبط النقطة بالنقر.
 * الملف يُحمَّل عند أول بحث فقط.
 */
@Component({
  selector: 'app-place-search', standalone: true,
  template: `
    <div class="place-search">
      <label class="form-label" [attr.for]="inputId">ابحث عن مكان <small class="hint">(مدينة، بلدة، قرية، حي)</small></label>
      <div class="box">
        <input [id]="inputId" type="search" role="combobox" autocomplete="off" placeholder="مثال: المزة، حلب، جرمانا…"
               [value]="query()" aria-autocomplete="list" [attr.aria-expanded]="open()" [attr.aria-controls]="inputId + '-list'"
               [attr.aria-activedescendant]="active() >= 0 ? inputId + '-opt-' + active() : null"
               (input)="onInput($any($event.target).value)" (focus)="onFocus()" (keydown)="onKey($event)" (blur)="close()">
        @if (open()) {
          <ul class="results" role="listbox" [id]="inputId + '-list'">
            @if (loading()) { <li class="note" role="status">جارٍ تحميل أسماء الأماكن…</li> }
            @else if (error()) { <li class="note error" role="alert">{{ error() }}</li> }
            @else if (!results().length) { <li class="note">لا توجد نتائج لـ «{{ query() }}»</li> }
            @else {
              @for (p of results(); track $index) {
                <li role="option" [id]="inputId + '-opt-' + $index" [class.on]="$index === active()" [attr.aria-selected]="$index === active()"
                    (mousedown)="$event.preventDefault(); choose(p)" (mouseenter)="active.set($index)">
                  <span class="name">{{ p.nameAr || p.nameEn }}@if (p.nameAr && p.nameEn) { <small dir="ltr">{{ p.nameEn }}</small> }</span>
                  <span class="meta">{{ typeLabel[p.type] }} · {{ governorateName(p.governorate) }}</span>
                </li>
              }
            }
          </ul>
        }
      </div>
      <small class="credit">{{ attribution }}</small>
    </div>`,
  styles: [`
    .place-search { display: grid; gap: 6px; }
    .box { position: relative; }
    .box input { width: 100%; }
    .hint { color: var(--ink-400); font-weight: 400; }
    .results { position: absolute; inset-inline: 0; top: calc(100% + 4px); z-index: 20; margin: 0; padding: 4px; list-style: none;
      max-height: 280px; overflow-y: auto; border: 1px solid var(--border-strong); border-radius: var(--radius-md);
      background: var(--surface); box-shadow: var(--shadow-md, 0 8px 24px rgb(0 0 0 / .12)); }
    .results li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer; }
    .results li.on { background: var(--fill); }
    .results .name { font-weight: 700; color: var(--ink-900); }
    .results .name small { margin-inline-start: 8px; font-weight: 400; color: var(--ink-400); }
    .results .meta { flex: none; font-size: 12px; color: var(--ink-500); }
    .results .note { cursor: default; color: var(--ink-500); font-size: 13px; }
    .results .note.error { color: var(--danger-600); }
    .credit { font-size: 11px; color: var(--ink-400); }
  `]
})
export class PlaceSearch {
  private places = inject(PlacesService);
  private static next = 0;

  selected = output<Place>();

  inputId = 'place-search-' + PlaceSearch.next++;
  attribution = PLACES_ATTRIBUTION;
  typeLabel = PLACE_TYPE_LABEL;
  governorateName = governorateName;

  query = signal('');
  open = signal(false);
  loading = signal(false);
  error = signal('');
  active = signal(-1);
  private index = signal<PlaceIndex | null>(null);

  results = computed(() => {
    const index = this.index();
    return index && this.query().trim() ? index.search(this.query(), 8) : [];
  });

  onFocus() { this.ensureLoaded(); if (this.query().trim()) this.open.set(true); }

  onInput(value: string) {
    this.query.set(value);
    this.active.set(-1);
    this.open.set(!!value.trim());
    if (value.trim()) this.ensureLoaded();
  }

  private ensureLoaded() {
    if (this.index() || this.loading()) return;
    this.loading.set(true); this.error.set('');
    this.places.index().subscribe({
      next: index => { this.index.set(index); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('تعذّر تحميل أسماء الأماكن — تحقق من الاتصال وحاول مجدداً'); }
    });
  }

  onKey(event: KeyboardEvent) {
    const count = this.results().length;
    if (event.key === 'ArrowDown' && count) { event.preventDefault(); this.open.set(true); this.active.set((this.active() + 1) % count); }
    else if (event.key === 'ArrowUp' && count) { event.preventDefault(); this.active.set((this.active() - 1 + count) % count); }
    else if (event.key === 'Enter') {
      event.preventDefault(); // لا يُرسل Enter النموذج من حقل البحث
      if (this.open() && count) this.choose(this.results()[this.active() >= 0 ? this.active() : 0]);
    }
    else if (event.key === 'Escape' && this.open()) { event.stopPropagation(); this.close(); }
  }

  close() { this.open.set(false); this.active.set(-1); }

  choose(place: Place) {
    this.query.set(place.nameAr || place.nameEn);
    this.close();
    this.selected.emit(place);
  }
}
