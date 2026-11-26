import { query } from './query';

describe('query', () => {
  it('drops empty values and keeps zero by default', () => {
    expect(query({ linkedDocument: 0, search: '', branchId: null, kind: undefined, page: 2 })).toBe('?linkedDocument=0&page=2');
    expect(query({})).toBe('');
  });

  it('drops zero too when it means "all" in a filter', () => {
    expect(query({ branchId: 0, status: 3, q: 'مولدة', active: false }, { dropZero: true })).toBe('?status=3&q=%D9%85%D9%88%D9%84%D8%AF%D8%A9&active=false');
    expect(query({ branchId: 0 }, { dropZero: true })).toBe('');
  });
});
