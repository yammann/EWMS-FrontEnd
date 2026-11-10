import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SiteStudiesPanel } from './site-studies-panel';

const project = (id: number, over: object = {}) => ({
  id, code: `ST-26-${String(id).padStart(3, '0')}`, name: `مشروع ${id}`, status: 1, statusName: 'جارٍ', progress: 40,
  plannedStartDate: '2026-11-08T00:00:00', plannedEndDate: '2027-03-31T00:00:00', ...over
});
const page = (items: object[], total = items.length) => ({ items, totalCount: total, page: 1, pageSize: 8, totalPages: Math.ceil(total / 8) });

function open(siteId = 7) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(SiteStudiesPanel);
  fixture.componentRef.setInput('siteId', siteId);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController), root: fixture.nativeElement as HTMLElement };
}

describe('SiteStudiesPanel', () => {
  it('asks the server for the projects of this site only and lists them as links', () => {
    const { fixture, http, root } = open();
    http.expectOne(r => r.url.includes('/StudyProjects/GetAll') && r.url.includes('siteId=7') && r.url.includes('pageSize=8'))
      .flush(page([project(1), project(2, { status: 3, statusName: 'مكتمل', progress: 100 })]));
    fixture.detectChanges();
    expect(Array.from(root.querySelectorAll('li a.row .code')).map(c => c.textContent?.trim())).toEqual(['ST-26-001', 'ST-26-002']);
    expect(Array.from(root.querySelectorAll('li a.row')).map(a => a.getAttribute('href'))).toEqual(['/studies/projects/1', '/studies/projects/2']);
    expect(root.querySelector('h2')?.textContent).toContain('(2)');
  });

  it('says so when the site has no projects', () => {
    const { fixture, http, root } = open();
    http.expectOne(r => r.url.includes('siteId=7')).flush(page([]));
    fixture.detectChanges();
    expect(root.textContent).toContain('لا مشاريع دراسات في هذا الموقع');
  });

  it('starts again from the first page when the site changes', () => {
    const { fixture, http } = open(7);
    http.expectOne(r => r.url.includes('siteId=7')).flush(page([project(1)], 20));
    fixture.componentInstance.goTo(2);
    http.expectOne(r => r.url.includes('siteId=7') && r.url.includes('page=2')).flush(page([project(9)], 20));
    fixture.componentRef.setInput('siteId', 8);
    fixture.detectChanges();
    http.expectOne(r => r.url.includes('siteId=8') && r.url.includes('page=1')).flush(page([]));
  });
});
