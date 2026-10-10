import { Component, booleanAttribute, input } from '@angular/core';

/** حالة فارغة/«جارٍ التحميل» موحّدة. `panel` يضيف إطار اللوحة. المحتوى نص أو عناصر. */
@Component({
  selector: 'app-empty-state', standalone: true,
  template: `<div class="empty-state" [class.panel]="panel()" role="status"><ng-content /></div>`,
  styles: [`:host { display: contents; }`]
})
export class EmptyState {
  panel = input(false, { transform: booleanAttribute });
}
