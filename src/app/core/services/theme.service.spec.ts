import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k)
    });
    delete document.documentElement.dataset['theme'];
    delete document.documentElement.dataset['mode'];
  });
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to Forest following the system mode', () => {
    const theme = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(theme.palette()).toBe('forest');
    expect(theme.mode()).toBe('system');
    expect(document.documentElement.dataset['theme']).toBe('forest');
    expect(document.documentElement.dataset['mode']).toBeUndefined();
  });

  it('applies and persists the chosen palette and mode', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setPalette('umber');
    theme.setMode('dark');
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('umber');
    expect(document.documentElement.dataset['mode']).toBe('dark');
    expect(theme.isDark()).toBe(true);
    expect(JSON.parse(store.get('ewms_appearance')!)).toEqual({ palette: 'umber', mode: 'dark' });
  });

  it('restores a saved choice and ignores unknown values', () => {
    store.set('ewms_appearance', JSON.stringify({ palette: 'wheat', mode: 'neon' }));
    const theme = TestBed.inject(ThemeService);
    expect(theme.palette()).toBe('wheat');
    expect(theme.mode()).toBe('system');
  });
});
