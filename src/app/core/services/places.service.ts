import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { PLACES_URL, PlaceIndex, PlacesFile } from '@core/utils/places';

/** فهرس أسماء الأماكن السورية — يُحمَّل مرة واحدة عند أول بحث فقط (لا يؤثر على فتح أي صفحة) */
@Injectable({ providedIn: 'root' })
export class PlacesService {
  private http = inject(HttpClient);
  private index$?: Observable<PlaceIndex>;

  index(): Observable<PlaceIndex> {
    this.index$ ??= this.http.get<PlacesFile>(PLACES_URL).pipe(
      map(file => new PlaceIndex(file.places)),
      shareReplay(1)
    );
    return this.index$;
  }
}
