import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';

const err = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('toApiError', () => {
  it('keeps Arabic server messages as they are', () => {
    expect(toApiError(err(400, { message: 'الاسم مطلوب' })).message).toBe('الاسم مطلوب');
    expect(toApiError(err(400, { errors: [{ message: 'مساحة الموقع لا تكون سالبة' }] })).message).toBe('مساحة الموقع لا تكون سالبة');
  });

  it('never shows English framework text (model-binding errors, technical exceptions)', () => {
    const framework = { errors: { dto: ['The dto field is required.'], '$.buildings[0].buildingCount': ['The JSON value could not be converted to System.Int32. Path: $.buildings[0].buildingCount | LineNumber: 0'] } };
    expect(toApiError(err(400, framework)).message).toBe('بيانات غير صحيحة — تحقق من الحقول المُدخلة');
    expect(toApiError(err(500, { message: 'Object reference not set to an instance of an object.' })).message).toBe('حدث خطأ في الخادم، يرجى المحاولة لاحقاً');
    expect(toApiError(err(404, { title: 'Not Found' })).message).toBe('العنصر المطلوب غير موجود');
  });
});
