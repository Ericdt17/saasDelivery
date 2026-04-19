'use strict';

/**
 * Real-database tests for recruitment INSERT (including photo columns).
 * Run via: npm run test:db:integration (CI backend-ci job).
 */

const HAS_DB = !!process.env.DATABASE_URL;
const describeWithDb = HAS_DB ? describe : describe.skip;

let pool;
let queries;

if (HAS_DB) {
  const { createPostgresPool } = require('../../db/postgres');
  const createPostgresQueries = require('../../db/postgres-queries');
  pool = createPostgresPool();
  queries = createPostgresQueries(pool);
}

const OFFER_TITLE = 'JEST_RECR_TestOffer_photo';
const TEST_PHONE = 'JEST_RECR_PH9001';

async function cleanRecruitmentJestRows() {
  await queries.query(
    `DELETE FROM job_answers WHERE application_id IN (
       SELECT ja.id FROM job_applications ja
       INNER JOIN job_offers jo ON jo.id = ja.job_offer_id
       WHERE jo.title = $1
     )`,
    [OFFER_TITLE]
  );
  await queries.query(
    `DELETE FROM job_applications WHERE job_offer_id IN (
       SELECT id FROM job_offers WHERE title = $1
     )`,
    [OFFER_TITLE]
  );
  await queries.query(
    `DELETE FROM job_questions WHERE job_offer_id IN (
       SELECT id FROM job_offers WHERE title = $1
     )`,
    [OFFER_TITLE]
  );
  await queries.query(`DELETE FROM job_offers WHERE title = $1`, [OFFER_TITLE]);
}

describeWithDb('PostgreSQL — recruitment applications (real DB)', () => {
  beforeAll(async () => {
    await cleanRecruitmentJestRows();
  });

  afterAll(async () => {
    await cleanRecruitmentJestRows();
    await pool.end();
  });

  it('recruitmentCreateApplicationWithAnswers persists photo_url and photo_original_name', async () => {
    const offer = await queries.recruitmentCreateJobOffer({
      title: OFFER_TITLE,
      type: 'JEST_RECR_TYPE',
      description: null,
      location: 'JEST_RECR_Loc',
      slots: 1,
      is_open: true,
    });
    expect(offer).not.toBeNull();
    const jobOfferId = offer.id;

    const photoUrl = 'https://example.test/candidate-photo.jpg';
    const photoName = 'candidate-photo.jpg';

    const created = await queries.recruitmentCreateApplicationWithAnswers({
      job_offer_id: jobOfferId,
      full_name: 'JEST_RECR_Candidate',
      phone: TEST_PHONE,
      quartier: null,
      transport: null,
      availability: null,
      photo_url: photoUrl,
      photo_original_name: photoName,
      cv_url: null,
      cv_original_name: null,
      cover_letter_url: null,
      cover_letter_original_name: null,
      answers: [],
    });

    expect(created.id).toBeDefined();
    expect(created.error).toBeUndefined();

    const detail = await queries.recruitmentGetApplicationDetail(created.id);
    expect(detail).not.toBeNull();
    expect(detail.application.photo_url).toBe(photoUrl);
    expect(detail.application.photo_original_name).toBe(photoName);
    expect(detail.application.full_name).toBe('JEST_RECR_Candidate');
    expect(detail.application.phone).toBe(TEST_PHONE);
  });
});
