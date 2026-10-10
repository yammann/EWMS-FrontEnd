import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SelectValue } from './select-value';

@Component({
  standalone: true, imports: [SelectValue],
  template: `<select [appSelectValue]="value()">@for (o of options(); track o) { <option [value]="o">{{ o }}</option> }</select>`
})
class Host { value = signal<number | null>(2026); options = signal([2025, 2026, 2027]); }

describe('SelectValue', () => {
  const tick = () => new Promise<void>(r => setTimeout(r, 0));

  it('shows the bound value even though options render after the select (the [value] bug)', async () => {
    const f = TestBed.createComponent(Host);
    await f.whenStable(); await tick();
    expect((f.nativeElement.querySelector('select') as HTMLSelectElement).value).toBe('2026');
  });

  it('follows value changes and options that arrive later', async () => {
    const f = TestBed.createComponent(Host);
    f.componentInstance.options.set([]);
    f.componentInstance.value.set(2028);
    await f.whenStable(); await tick();
    f.componentInstance.options.set([2027, 2028]);
    await f.whenStable(); await tick();
    const select = f.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('2028');
    f.componentInstance.value.set(2027);
    await f.whenStable(); await tick();
    expect(select.value).toBe('2027');
  });
});
