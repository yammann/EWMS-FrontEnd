import { Component, computed, inject, output, signal } from '@angular/core';
import { PlacesService } from '../data-access/places.service';
import { PLACES_ATTRIBUTION, PLACE_TYPE_LABEL, Place, PlaceIndex } from '@core/utils/places';
import { governorateName } from '@core/constants/governorates';

/**
 * بحث بأسماء الأماكن السورية (بدون إنترنت): اكتب «المزة» أو «حلب» فتظهر قائمة نتائج مرتبة،
 * واختيار نتيجة يُرسل مكانها ليقفز إليه المُحدِّد على الخريطة ثم تضبط النقطة بالنقر.
 * الملف يُحمَّل عند أول بحث فقط.
 */
@Component({
  selector: 'app-place-search', standalone: true,
  templateUrl: './place-search.html',
  styleUrl: './place-search.scss'
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
