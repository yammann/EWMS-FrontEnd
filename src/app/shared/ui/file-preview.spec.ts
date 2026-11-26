import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { FilePreview, PreviewFile, isPreviewable } from './file-preview';

@Component({
  imports: [FilePreview],
  template: `<app-file-preview [file]="file()" [load]="load" [save]="save()" (closed)="closed()" />`
})
class Host {
  file = signal<PreviewFile | null>(null);
  save = signal<(() => void) | null>(null);
  closed = vi.fn();
  load: (id: number) => Observable<Blob> = () => of(new Blob(['x']));
}

const image: PreviewFile = { id: 1, fileName: 'صورة.png', contentType: 'image/png' };
const pdf: PreviewFile = { id: 2, fileName: 'مستند.pdf', contentType: 'application/pdf' };

describe('FilePreview', () => {
  let created: string[];
  let revoked: string[];
  const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };

  beforeEach(() => {
    created = []; revoked = [];
    let n = 0;
    URL.createObjectURL = () => { const url = `blob:test/${++n}`; created.push(url); return url; };
    URL.revokeObjectURL = url => { revoked.push(url); };
  });
  afterEach(() => { URL.createObjectURL = original.create; URL.revokeObjectURL = original.revoke; });

  const setup = async () => {
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    const root = () => f.nativeElement as HTMLElement;
    return { f, host: f.componentInstance, root };
  };

  it('isPreviewable accepts PDF and images only', () => {
    expect(isPreviewable('application/pdf')).toBe(true);
    expect(isPreviewable('image/jpeg')).toBe(true);
    expect(isPreviewable('application/vnd.ms-excel')).toBe(false);
    expect(isPreviewable('text/html')).toBe(false);
  });

  it('stays closed without a file, then loads by id and shows an image', async () => {
    const { f, host, root } = await setup();
    expect(root().querySelector('.viewer')).toBeNull();

    const pending = new Subject<Blob>();
    const load = vi.fn(() => pending.asObservable());
    host.load = load;
    host.file.set(image);
    await f.whenStable();
    expect(load).toHaveBeenCalledWith(1);
    expect(root().querySelector('[role=status]')?.textContent).toContain('جارٍ التحميل');
    expect((root().querySelector('.modal-actions button:not(.ghost)') as HTMLButtonElement).disabled).toBe(true);

    pending.next(new Blob(['png'])); pending.complete();
    await f.whenStable();
    const img = root().querySelector('.viewer img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('blob:test/1');
    expect(img.alt).toBe('صورة.png');
    expect(root().querySelector('iframe')).toBeNull();
  });

  it('shows a PDF in an iframe and frees the old link when the file changes or closes', async () => {
    const { f, host, root } = await setup();
    host.file.set(image);
    await f.whenStable();
    host.file.set(pdf);
    await f.whenStable();
    expect(revoked).toEqual(['blob:test/1']);
    expect(root().querySelector('.viewer iframe')?.getAttribute('src')).toBe('blob:test/2');

    host.file.set(null);
    await f.whenStable();
    expect(revoked).toEqual(['blob:test/1', 'blob:test/2']);
    expect(root().querySelector('.viewer')).toBeNull();
  });

  it('shows the server message when loading fails', async () => {
    const { f, host, root } = await setup();
    host.load = () => throwError(() => ({ status: 403, message: 'لا تملك صلاحية عرض الملف' }));
    host.file.set(image);
    await f.whenStable();
    expect(root().querySelector('.viewer .alert-error')?.textContent).toContain('لا تملك صلاحية عرض الملف');
  });

  it('downloads the shown content, or hands over to a custom save', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { f, host, root } = await setup();
    host.file.set(image);
    await f.whenStable();
    const download = () => root().querySelector('.modal-actions button:not(.ghost)') as HTMLButtonElement;
    download().click();
    expect(click).toHaveBeenCalledTimes(1);
    expect(created.length).toBe(2);                     // رابط المعاينة + رابط التنزيل

    const save = vi.fn();
    host.save.set(save);
    await f.whenStable();
    download().click();
    expect(save).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('emits closed from the close button', async () => {
    const { f, host, root } = await setup();
    host.file.set(image);
    await f.whenStable();
    (root().querySelector('.modal-actions .ghost') as HTMLButtonElement).click();
    expect(host.closed).toHaveBeenCalledTimes(1);
  });
});
