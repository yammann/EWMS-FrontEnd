import { Component, input } from '@angular/core';
import { ActionIcon } from './action-icon';

/** Content inside a native delete button. Only the confirmed request starts the letter animation. */
@Component({
  selector: 'app-delete-action-content',
  imports: [ActionIcon],
  host: { dir: 'rtl', '[class.collecting]': 'busy()' },
  template: `
    <app-action-icon kind="delete" [busy]="busy()" />
    <span class="word">
      <span class="label">حذف</span>
      @if (busy()) {
        <span class="piece first" aria-hidden="true">حذف</span>
        <span class="piece second" aria-hidden="true">حذف</span>
        <span class="piece third" aria-hidden="true">حذف</span>
      }
    </span>`,
  styleUrl: './delete-action-content.scss'
})
export class DeleteActionContent {
  busy = input(false);
}
