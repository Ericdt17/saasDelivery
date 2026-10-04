'use strict';

const {
  estimatePayslipAmounts,
  buildPayslipModel,
  payslipFileName,
  formatCurrency,
} = require('../../lib/hrPayslip');

describe('estimatePayslipAmounts', () => {
  it('Eric example: 100k base, 2 absences, 26 workdays', () => {
    const a = estimatePayslipAmounts({
      salaryBase: 100000,
      daysPresent: 6,
      daysLate: 0,
      daysAbsent: 2,
      workdaysInMonth: 26,
    });
    expect(a.costAbsentDay).toBe(3846);
    expect(a.costLateDay).toBe(1923);
    expect(a.penaltyAbsent).toBe(7692);
    expect(a.penaltyLate).toBe(0);
    expect(a.penaltiesTotal).toBe(7692);
    expect(a.netPay).toBe(92308);
  });

  it('applies half-day late penalties on full-month basis', () => {
    const a = estimatePayslipAmounts({
      salaryBase: 300000,
      daysPresent: 12,
      daysLate: 3,
      daysAbsent: 5,
      workdaysInMonth: 20,
    });
    expect(a.penaltyLate).toBe(22500);
    expect(a.penaltyAbsent).toBe(75000);
    expect(a.penaltiesTotal).toBe(97500);
    expect(a.netPay).toBe(202500);
  });

  it('returns nulls when month has no workdays', () => {
    const a = estimatePayslipAmounts({
      salaryBase: 100000,
      daysPresent: 0,
      daysLate: 0,
      daysAbsent: 0,
      workdaysInMonth: 0,
    });
    expect(a.netPay).toBeNull();
    expect(a.penaltiesTotal).toBeNull();
  });
});

describe('buildPayslipModel / payslipFileName', () => {
  it('builds preformatted labels and bulletin number', () => {
    const model = buildPayslipModel({
      employee: {
        id: 2,
        full_name: 'Djou Tousse Eric',
        email: 'eric@example.com',
        poste: 'CEO',
        salary_base: 100000,
      },
      month: 9,
      year: 2026,
      daysPresent: 6,
      daysLate: 0,
      daysAbsent: 2,
      weekdaysElapsed: 8,
      generatedAt: new Date('2026-09-09T12:00:00.000Z'),
    });
    expect(model.companyName).toBe('LivSight');
    expect(model.bulletinNo).toBe('PAIE-202609-2');
    expect(model.employeeName).toBe('Djou Tousse Eric');
    expect(model.monthLabel).toMatch(/septembre/i);
    expect(model.generatedAtLabel).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(model.generatedAtLabel).not.toMatch(/\d{2}:\d{2}/);
    expect(model.workdaysInMonth).toBe('26');
    expect(model.netPayLabel).toBe(formatCurrency(92308));
    expect(model.penaltiesTotalLabel).toBe(formatCurrency(7692));
    expect(model.salaryChangeRowHtml).toBe('');
    expect(model.salaryChange).toBeNull();
  });

  it('shows an augmentation row when base salary rose vs previous month', () => {
    const model = buildPayslipModel({
      employee: {
        id: 2,
        full_name: 'Jean',
        email: 'j@x.com',
        salary_base: 180000,
      },
      previousSalaryBase: 150000,
      month: 11,
      year: 2026,
      daysPresent: 1,
      daysLate: 0,
      daysAbsent: 0,
    });
    expect(model.salaryChange).toEqual({
      kind: 'raise',
      delta: 30000,
      previous: 150000,
      current: 180000,
      label: 'Augmentation de salaire',
    });
    expect(model.salaryChangeRowHtml).toContain('Salaire du mois précédent');
    expect(model.salaryChangeRowHtml).toContain(formatCurrency(150000));
    expect(model.salaryChangeRowHtml).toContain('Augmentation de salaire');
    expect(model.salaryChangeRowHtml).toContain('+');
    expect(model.salaryChangeRowHtml).toContain(formatCurrency(30000));
    expect(model.salaryBaseLabel).toBe(formatCurrency(180000));
  });

  it('shows a baisse row when base salary dropped vs previous month', () => {
    const model = buildPayslipModel({
      employee: {
        id: 2,
        full_name: 'Jean',
        email: 'j@x.com',
        salary_base: 120000,
      },
      previousSalaryBase: 150000,
      month: 11,
      year: 2026,
      daysPresent: 1,
      daysLate: 0,
      daysAbsent: 0,
    });
    expect(model.salaryChange?.kind).toBe('drop');
    expect(model.salaryChange?.delta).toBe(-30000);
    expect(model.salaryChangeRowHtml).toContain('Baisse de salaire');
    expect(model.salaryChangeRowHtml).toContain('deduct');
    expect(model.salaryChangeRowHtml).toContain(formatCurrency(30000));
  });

  it('omits the change row when previous equals current', () => {
    const model = buildPayslipModel({
      employee: {
        id: 2,
        full_name: 'Jean',
        email: 'j@x.com',
        salary_base: 150000,
      },
      previousSalaryBase: 150000,
      month: 11,
      year: 2026,
      daysPresent: 1,
      daysLate: 0,
      daysAbsent: 0,
    });
    expect(model.salaryChange).toBeNull();
    expect(model.salaryChangeRowHtml).toBe('');
  });

  it('uses company settings branding when provided', () => {
    const model = buildPayslipModel({
      employee: {
        id: 2,
        full_name: 'Jean',
        email: 'j@x.com',
        salary_base: 100000,
      },
      month: 9,
      year: 2026,
      daysPresent: 1,
      daysLate: 0,
      daysAbsent: 0,
      company: {
        company_name: 'Acme RH',
        legal_name: 'Acme SARL',
        tax_id: 'M123',
        trade_register: 'RC/DLA/2020/B/1',
        address: 'Yaoundé',
        phone: '+237 111',
        email: 'rh@acme.com',
        accent_color: '#112233',
      },
    });
    expect(model.companyName).toBe('Acme RH');
    expect(model.legalName).toBe('Acme SARL');
    expect(model.taxId).toBe('M123');
    expect(model.tradeRegister).toBe('RC/DLA/2020/B/1');
    expect(model.legalIdsLine).toBe('NUI: M123 · RCCM: RC/DLA/2020/B/1');
    expect(model.accentColor).toBe('#112233');
    expect(model.address).toBe('Yaoundé');
  });

  it('includes employer signature html when signature_base64 is set', () => {
    const model = buildPayslipModel({
      employee: {
        id: 2,
        full_name: 'Jean',
        email: 'j@x.com',
        salary_base: 100000,
      },
      month: 9,
      year: 2026,
      daysPresent: 1,
      daysLate: 0,
      daysAbsent: 0,
      company: {
        company_name: 'Acme RH',
        signature_base64: 'data:image/png;base64,AAA',
        stamp_base64: 'data:image/png;base64,STAMP',
      },
    });
    expect(model.signatureBase64).toBe('data:image/png;base64,AAA');
    expect(model.signatureHtml).toContain('data:image/png;base64,AAA');
    expect(model.signatureHtml).toContain('signature-img');
    expect(model.stampHtml).toContain('data:image/png;base64,STAMP');
    expect(model.stampHtml).toContain('stamp-img');
  });

  it('includes signer name and role from company settings', () => {
    const model = buildPayslipModel({
      employee: {
        id: 2,
        full_name: 'Jean',
        email: 'j@x.com',
        salary_base: 100000,
      },
      month: 9,
      year: 2026,
      daysPresent: 1,
      daysLate: 0,
      daysAbsent: 0,
      company: {
        company_name: 'Acme RH',
        signer_name: 'Djou Tousse Eric',
        signer_role: 'Directeur Général',
      },
    });
    expect(model.signerName).toBe('Djou Tousse Eric');
    expect(model.signerRole).toBe('Directeur Général');
  });

  it('prefers personal signer profile over company signer fields', () => {
    const model = buildPayslipModel({
      employee: {
        id: 2,
        full_name: 'Jean',
        email: 'j@x.com',
        salary_base: 100000,
      },
      month: 9,
      year: 2026,
      daysPresent: 1,
      daysLate: 0,
      daysAbsent: 0,
      company: {
        company_name: 'Acme RH',
        stamp_base64: 'data:image/png;base64,OLDSTAMP',
        signer_name: 'Old Company Signer',
        signature_base64: 'data:image/png;base64,OLD',
      },
      signer: {
        name: 'Eric Djou',
        fonction: 'Directeur Général',
        signature_base64: 'data:image/png;base64,ME',
        stamp_base64: 'data:image/png;base64,MYSTAMP',
      },
    });
    expect(model.signerName).toBe('Eric Djou');
    expect(model.signerRole).toBe('Directeur Général');
    expect(model.signatureHtml).toContain('data:image/png;base64,ME');
    // Both stamps are rendered: company on the page left, personal next to the signature.
    expect(model.stampHtml).toContain('data:image/png;base64,OLDSTAMP');
    expect(model.profileStampHtml).toContain('data:image/png;base64,MYSTAMP');
  });

  it('builds a safe PDF filename', () => {
    expect(
      payslipFileName(
        { id: 2, full_name: 'Djou Toussé Eric' },
        2026,
        9
      )
    ).toBe('Bulletin-paie-Djou-Tousse-Eric-2026-09.pdf');
  });
});
