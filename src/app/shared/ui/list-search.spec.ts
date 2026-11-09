import { TestBed } from '@angular/core/testing';
import { ListSearch } from './list-search';

describe('ListSearch', () => {
  it('emits typed text, and the clear button empties it', async () => {
    const f = TestBed.createComponent(ListSearch);
    const seen: string[] = [];
    f.componentInstance.valueChange.subscribe(v => seen.push(v));
    f.componentRef.setInput('value', '');
    await f.whenStable();
    expect(f.nativeElement.querySelector('.clear')).toBeNull();

    const input: HTMLInputElement = f.nativeElement.querySelector('input');
    input.value = 'احمد'; input.dispatchEvent(new Event('input'));
    expect(seen).toEqual(['احمد']);

    f.componentRef.setInput('value', 'احمد');
    await f.whenStable();
    f.nativeElement.querySelector('.clear').click();
    expect(seen).toEqual(['احمد', '']);
  });
});
