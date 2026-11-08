import { EMPTY, Observable, expand, reduce } from 'rxjs';
import { PagedResult } from '@core/models/paged-result.model';

/** أقصى عدد صفحات يُجمع (مئة حدث للصفحة): يكفي سجل أي دراسة، ويمنع حلقة لا تنتهي إن تغيّر الخادم */
export const MAX_PAGES = 10;

/**
 * يجمع صفحات قائمة مقسّمة في قائمة واحدة، ليبقى ما يصفّيه الواجهة كالسجل لمخطط واحد يرى كل الأحداث.
 * الصفحة الأولى دائماً؛ التالية بعد وصول السابقة حتى `totalPages` أو `maxPages`.
 */
export function allPages<T>(fetch: (page: number) => Observable<PagedResult<T>>, maxPages = MAX_PAGES): Observable<T[]> {
  return fetch(1).pipe(
    expand(r => r.page < r.totalPages && r.page < maxPages ? fetch(r.page + 1) : EMPTY),
    reduce((all, r) => all.concat(r.items), [] as T[])
  );
}
