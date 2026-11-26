import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActionButton } from './action-button';
import { ActionIcon, ActionKind } from './action-icon';

@Component({
  imports: [ActionButton],
  template: `<button type="button" class="btn" appAction="download" [busy]="busy()" [busyLabel]="busyLabel()" [disabled]="blocked()"
                     (click)="clicked()">تصدير <b>Excel</b></button>`
})
class Host {
  busy = signal(false);
  busyLabel = signal('جارٍ التصدير…');
  blocked = signal(false);
  clicked = vi.fn();
}

describe('ActionButton (button[appAction])', () => {
  const setup = async () => {
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    const button = f.nativeElement.querySelector('button') as HTMLButtonElement;
    const visibleText = () => [...button.querySelectorAll('.action-label')]
      .filter(s => !s.classList.contains('hidden')).map(s => s.textContent?.trim()).join(' ');
    return { f, host: f.componentInstance, button, visibleText };
  };

  it('keeps the native button and its content, with the action icon before the label', async () => {
    const { button, visibleText } = await setup();
    expect(button.type).toBe('button');
    expect(button.classList.contains('btn')).toBe(true);
    expect(button.firstElementChild?.tagName).toBe('APP-ACTION-ICON');
    expect(visibleText()).toBe('تصدير Excel');
    expect(button.querySelector('b')?.textContent).toBe('Excel');     // المحتوى الممرَّر كما هو
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBe('false');
  });

  it('while busy: disables itself, announces it, animates the icon and swaps the label', async () => {
    const { f, host, button, visibleText } = await setup();
    host.busy.set(true);
    await f.whenStable();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('app-action-icon')?.classList.contains('pending')).toBe(true);
    expect(visibleText()).toBe('جارٍ التصدير…');
    button.click();
    expect(host.clicked).not.toHaveBeenCalled();

    host.busy.set(false);
    await f.whenStable();
    expect(visibleText()).toBe('تصدير Excel');
    button.click();
    expect(host.clicked).toHaveBeenCalledTimes(1);
  });

  it('keeps its own label when no busy label is given, and merges an outside reason to disable', async () => {
    const { f, host, button, visibleText } = await setup();
    host.busyLabel.set('');
    host.busy.set(true);
    await f.whenStable();
    expect(visibleText()).toBe('تصدير Excel');

    host.busy.set(false);
    host.blocked.set(true);
    await f.whenStable();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('false');
  });

  it('draws every action kind', async () => {
    const kinds: ActionKind[] = ['delete', 'edit', 'save', 'send', 'upload', 'reactivate', 'download', 'search', 'login', 'refresh', 'cancel'];
    for (const kind of kinds) {
      const f = TestBed.createComponent(ActionIcon);
      f.componentRef.setInput('kind', kind);
      await f.whenStable();
      const svg = (f.nativeElement as HTMLElement).querySelector('svg');
      expect(svg?.children.length, kind).toBeGreaterThan(0);
    }
  });
});
