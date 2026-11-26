import { Component, input } from '@angular/core';
import { ICON_SPRITE } from './icon-names';

export type ActionKind = 'delete' | 'edit' | 'save' | 'send' | 'upload' | 'reactivate' | 'download' | 'search' | 'login' | 'refresh' | 'cancel';

/** Decorative feedback inside a native button. The caller owns pending and successful outcomes. */
@Component({
  selector: 'app-action-icon',
  templateUrl: './action-icon.html',
  styleUrl: './action-icon.scss',
  host: {
    'aria-hidden': 'true',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[class.pending]': 'busy() && !complete()',
    '[class.complete]': 'complete()'
  }
})
export class ActionIcon {
  readonly kind = input.required<ActionKind>();
  readonly size = input(18);
  readonly busy = input(false);
  readonly complete = input(false);
  protected readonly sprite = ICON_SPRITE + '#';
}
