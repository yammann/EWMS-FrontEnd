import { TestBed } from '@angular/core/testing';
import { ActionIcon, ActionKind } from './action-icon';
import { ICON_SPRITE } from './icon-names';

describe('ActionIcon', () => {
  it.each([
    ['delete', '.bin-fill'],
    ['save', '.result'],
    ['upload', '.result'],
    ['send', '.result'],
    ['edit', '.result'],
    ['reactivate', '.restart']
  ] as const)('reserves the %s completion graphic for confirmed success', async (kind: ActionKind, result: string) => {
    const fixture = TestBed.createComponent(ActionIcon);
    const element: HTMLElement = fixture.nativeElement;
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();
    expect(element.matches('.pending[aria-hidden="true"]')).toBe(true);
    expect(element.querySelector(result)).toBeNull();

    // Both a failure and a cancelled request can end a pending state.
    fixture.componentRef.setInput('busy', false);
    await fixture.whenStable();
    expect(element.querySelector(result)).toBeNull();

    fixture.componentRef.setInput('complete', true);
    await fixture.whenStable();
    expect(element.matches('.complete:not(.pending)')).toBe(true);
    expect(element.querySelector(result)?.getAttribute('href')).toContain(ICON_SPRITE + '#');
  });
});
