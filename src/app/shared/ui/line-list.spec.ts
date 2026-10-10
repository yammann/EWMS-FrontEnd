import { TestBed } from '@angular/core/testing';
import { LineList, cleanLines } from './line-list';

describe('LineList (بنود بنمط وينبوكس)', () => {
  const create = (values: string[], max = 30) => {
    const fixture = TestBed.createComponent(LineList);
    fixture.componentRef.setInput('values', values);
    fixture.componentRef.setInput('max', max);
    fixture.detectChanges();
    return fixture;
  };
  const inputs = (f: ReturnType<typeof create>) => [...(f.nativeElement as HTMLElement).querySelectorAll('input')] as HTMLInputElement[];

  it('always shows at least one empty row', () => {
    const f = create([]);
    expect(inputs(f).length).toBe(1);
  });

  it('▼ adds an empty row after the current one, ▲ removes it', () => {
    const f = create(['أ', 'ج']);
    f.componentInstance.addAfter(0);
    expect(f.componentInstance.values()).toEqual(['أ', '', 'ج']);
    f.componentInstance.remove(1);
    expect(f.componentInstance.values()).toEqual(['أ', 'ج']);
  });

  it('removing the only row clears it instead', () => {
    const f = create(['وحيد']);
    f.componentInstance.remove(0);
    expect(f.componentInstance.values()).toEqual(['']);
  });

  it('does not exceed the maximum number of rows', () => {
    const f = create(['1', '2'], 2);
    f.componentInstance.addAfter(1);
    expect(f.componentInstance.values()).toEqual(['1', '2']);
    expect(f.componentInstance.full()).toBe(true);
  });

  it('pasting several lines spreads them over rows within the limit', () => {
    const f = create(['أول', ''], 4);
    const field = inputs(f)[1];
    const event = { clipboardData: { getData: () => 'ب\r\n\r\nج\nد\nه' }, preventDefault: () => { /* */ } } as unknown as ClipboardEvent;
    f.componentInstance.paste(event, 1, field);
    expect(f.componentInstance.values()).toEqual(['أول', 'ب', 'ج', 'د']);
  });

  it('cleanLines keeps only trimmed non-empty values', () => {
    expect(cleanLines([' أ ', '', '  ', 'ب'])).toEqual(['أ', 'ب']);
  });
});
