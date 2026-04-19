'use strict';

const {
  PDF_FIELD_NAMES,
  IMAGE_FIELD_NAMES,
  isPdfField,
  isImageField,
} = require('../../config/recruitmentUploadFields');

describe('recruitmentUploadFields', () => {
  it('marks CV and cover letter fields as PDF', () => {
    expect(isPdfField('cv')).toBe(true);
    expect(isPdfField('file')).toBe(true);
    expect(isPdfField('resume')).toBe(true);
    expect(isPdfField('cover_letter')).toBe(true);
    expect(isPdfField('motivation_letter')).toBe(true);
    expect(isPdfField('letter')).toBe(true);
  });

  it('marks photo aliases as image', () => {
    expect(isImageField('photo')).toBe(true);
    expect(isImageField('profile_photo')).toBe(true);
    expect(isImageField('picture')).toBe(true);
  });

  it('rejects unknown field names for PDF and image helpers', () => {
    expect(isPdfField('photo')).toBe(false);
    expect(isImageField('cv')).toBe(false);
    expect(isPdfField('unknown')).toBe(false);
    expect(isImageField('')).toBe(false);
  });

  it('exports disjoint field name sets', () => {
    for (const name of PDF_FIELD_NAMES) {
      expect(IMAGE_FIELD_NAMES.has(name)).toBe(false);
    }
    for (const name of IMAGE_FIELD_NAMES) {
      expect(PDF_FIELD_NAMES.has(name)).toBe(false);
    }
  });
});
