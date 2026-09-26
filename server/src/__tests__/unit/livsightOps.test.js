'use strict';

const {
  fetchRevenueReport,
  fetchExpenseReport,
  LivsightOpsError,
} = require('../../lib/livsightOps');

describe('livsightOps client', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.LIVSIGHT_API_BASE_URL = 'http://ops.test:8085/';
    process.env.LIVSIGHT_API_KEY = 'secret-key';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.LIVSIGHT_API_BASE_URL;
    delete process.env.LIVSIGHT_API_KEY;
    delete process.env.LIVSIGHT_HR_API_KEY;
  });

  function mockJson(status, body) {
    global.fetch.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    });
  }

  it('sends X-Api-Key and date params to the revenue endpoint', async () => {
    mockJson(200, { net_revenue: 8700 });
    const report = await fetchRevenueReport('2026-07-01', '2026-07-31');
    expect(report.net_revenue).toBe(8700);

    const [url, opts] = global.fetch.mock.calls[0];
    expect(String(url)).toBe(
      'http://ops.test:8085/api/integrations/hr/reports/revenue?start_date=2026-07-01&end_date=2026-07-31'
    );
    expect(opts.headers['X-Api-Key']).toBe('secret-key');
  });

  it('passes optional personId/chargeTypeId filters to the expenses endpoint', async () => {
    mockJson(200, { total_amount: 4000 });
    await fetchExpenseReport('2026-07-01', '2026-07-31', 7, 3);

    const [url] = global.fetch.mock.calls[0];
    expect(String(url)).toContain('/api/integrations/hr/reports/expenses?');
    expect(String(url)).toContain('personId=7');
    expect(String(url)).toContain('chargeTypeId=3');
  });

  it('omits date params when not provided (LivSight defaults to today)', async () => {
    mockJson(200, {});
    await fetchRevenueReport();
    const [url] = global.fetch.mock.calls[0];
    expect(String(url)).toBe(
      'http://ops.test:8085/api/integrations/hr/reports/revenue'
    );
  });

  it('rejects malformed dates before making a request', async () => {
    await expect(fetchRevenueReport('07/01/2026')).rejects.toMatchObject({
      name: 'LivsightOpsError',
      code: 'bad_request',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws a config error when the API key is missing', async () => {
    delete process.env.LIVSIGHT_API_KEY;
    delete process.env.LIVSIGHT_HR_API_KEY;
    await expect(fetchRevenueReport()).rejects.toMatchObject({
      code: 'config',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to LIVSIGHT_HR_API_KEY when LIVSIGHT_API_KEY is unset', async () => {
    delete process.env.LIVSIGHT_API_KEY;
    process.env.LIVSIGHT_HR_API_KEY = 'hr-fallback-key';
    mockJson(200, {});
    await fetchRevenueReport();
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers['X-Api-Key']).toBe('hr-fallback-key');
  });

  it('maps 401 to an unauthorized error', async () => {
    mockJson(401, { error: 'invalid key' });
    await expect(fetchRevenueReport()).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
  });

  it('maps 400 to a bad_request error with the server message', async () => {
    mockJson(400, { error: 'start_date after end_date' });
    await expect(
      fetchRevenueReport('2026-07-31', '2026-07-01')
    ).rejects.toThrow('start_date after end_date');
  });

  it('maps fetch failures to a network error', async () => {
    global.fetch.mockRejectedValue(new TypeError('fetch failed'));
    await expect(fetchRevenueReport()).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('exposes LivsightOpsError for instanceof checks', async () => {
    mockJson(500, undefined);
    await expect(fetchRevenueReport()).rejects.toBeInstanceOf(
      LivsightOpsError
    );
  });
});
