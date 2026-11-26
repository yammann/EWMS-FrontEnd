import { Component, computed, input } from '@angular/core';
import { ActionIcon, ActionKind } from './action-icon';

/**
 * زر عملية تنتظر الخادم — النمط الموحّد في الواجهة كلها: أيقونة العملية تتحرك أثناء الانتظار، والنص يتبدّل،
 * والزر يتعطّل ويعلن انشغاله لقارئات الشاشة (aria-busy). يبقى `<button>` أصلياً بأصنافه ونوعه وأحداثه:
 *
 *   <button type="button" class="btn btn-ghost" appAction="download" [busy]="exporting()" busyLabel="جارٍ التصدير…"
 *           [disabled]="!total()" (click)="export()">تصدير Excel</button>
 *
 * - `[disabled]` يُربط بهذا المكوّن (لا بالعنصر مباشرة) ويُدمج مع الانشغال.
 * - أزرار نافذة النموذج («إلغاء» + إرسال): `<app-form-actions>` (النمط نفسه). زر نصه «حذف» وحده: `<app-delete-action-content>`.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- عمداً: يبقى <button> أصلياً (النوع، الأصناف، التركيز، الإرسال)
  selector: 'button[appAction]',
  imports: [ActionIcon],
  template: `
    <app-action-icon [kind]="appAction()" [busy]="busy()" [size]="iconSize()" />
    <span class="action-label" [class.hidden]="swapLabel()"><ng-content /></span>
    @if (swapLabel()) { <span class="action-label">{{ busyLabel() }}</span> }`,
  styles: [`.hidden { display: none; }`],
  host: { '[disabled]': 'busy() || disabled()', '[attr.aria-busy]': 'busy()' }
})
export class ActionButton {
  /** نوع العملية: يحدد الأيقونة وحركتها */
  readonly appAction = input.required<ActionKind>();
  readonly busy = input(false);
  /** تعطيل لسبب غير الانشغال (نموذج غير صالح، لا بيانات…) */
  readonly disabled = input(false);
  /** النص أثناء الانتظار («جارٍ التصدير…»)؛ فارغ = يبقى النص كما هو */
  readonly busyLabel = input('');
  readonly iconSize = input(18);
  protected readonly swapLabel = computed(() => this.busy() && !!this.busyLabel());
}
