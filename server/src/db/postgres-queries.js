const config = require("../config");
const logger = require("../logger");

const RETRYABLE_ERRORS = [
  "Connection terminated unexpectedly",
  "Connection terminated due to connection timeout",
  "connection timeout",
  "ECONNRESET",
  "EPIPE",
];

const isRetryable = (err) =>
  RETRYABLE_ERRORS.some((msg) => err?.message?.includes(msg));

function createPostgresQueries(pool) {
  const TIME_ZONE = config.TIME_ZONE || "UTC";

  const convertPlaceholders = (sql, params) => {
    if (!sql.includes("?")) {
      return { sql, params };
    }
    let index = 0;
    const convertedSql = sql.replace(/\?/g, () => `$${++index}`);
    return { sql: convertedSql, params };
  };

  const normalizeDateFunctions = (sql) => {
    let converted = sql;
    converted = converted.replace(
      /DATE\(created_at,\s*'localtime'\)/gi,
      `(created_at AT TIME ZONE '${TIME_ZONE}')::date`
    );
    converted = converted.replace(
      /DATE\('now',\s*'localtime'\)/gi,
      "CURRENT_DATE"
    );
    converted = converted.replace(/DATE\(created_at\)/gi, "created_at::date");
    return converted;
  };

  const query = async (sql, params = [], { retries = 3 } = {}) => {
    const convertedSql = normalizeDateFunctions(sql);
    const { sql: finalSql, params: finalParams } = convertPlaceholders(
      convertedSql,
      params
    );

    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await pool.query(finalSql, finalParams);

        if (finalSql.trim().toUpperCase().startsWith("SELECT")) {
          if (finalSql.toUpperCase().includes("LIMIT 1")) {
            return result.rows[0] || null;
          }
          return result.rows;
        }

        if (result.rows && result.rows.length && result.rows[0].id) {
          return {
            id: result.rows[0].id,
            lastInsertRowid: result.rows[0].id,
            changes: result.rowCount || 0,
          };
        }

        return {
          lastInsertRowid: null,
          changes: result.rowCount || 0,
        };
      } catch (err) {
        lastErr = err;
        if (attempt < retries && isRetryable(err)) {
          logger.warn(
            { err, attempt, sql: finalSql.slice(0, 120) },
            "Transient DB connection error — retrying"
          );
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  };


  // Agency Queries
  // ============================================

  async function createAgency({
    name,
    email,
    password_hash,
    role = "agency",
    is_active = true,
    agency_code = null,
    group_id = null,
    parent_agency_id = null,
  }) {
    // Normalize agency_code: trim and uppercase if provided
    const normalizedCode = agency_code ? agency_code.trim().toUpperCase() : null;

    const result = await query(
      `INSERT INTO agencies (name, email, password_hash, role, is_active, agency_code, group_id, parent_agency_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name, email, password_hash, role, is_active, normalizedCode, group_id, parent_agency_id]
    );
    return result.id || result[0]?.id;
  }

  async function getAgencyById(id) {
    const result = await query(
      `SELECT id, name, email, agency_code, role, is_active, address, phone, logo_base64,
              fonction, signature_base64, stamp_base64,
              group_id, parent_agency_id, created_at, updated_at
       FROM agencies
       WHERE id = $1 LIMIT 1`,
      [id]
    );
    // query() with LIMIT 1 already returns object or null
    return result || null;
  }

  async function getAgencyByEmail(email) {
    const result = await query(
      `SELECT id, name, email, password_hash, role, is_active, created_at, updated_at 
       FROM agencies 
       WHERE email = $1 LIMIT 1`,
      [email]
    );
    // query() already returns result.rows[0] || null for LIMIT 1 queries
    return result;
  }

  async function findAgencyByCode(code) {
    // Case-insensitive search for agency code
    // Normalize code: trim and uppercase
    const normalizedCode = (code || "").trim().toUpperCase();
    
    if (!normalizedCode || normalizedCode.length < 4) {
      return null;
    }

    const result = await query(
      `SELECT id, name, email, agency_code, role, is_active, created_at, updated_at 
       FROM agencies 
       WHERE UPPER(TRIM(agency_code)) = $1 AND is_active = true 
       LIMIT 1`,
      [normalizedCode]
    );
    
    // query() with LIMIT 1 already returns object or null
    return result || null;
  }

  async function getAllAgencies() {
    // Only return active agencies (is_active = true)
    return await query(
      `SELECT id, name, email, agency_code, role, is_active, created_at, updated_at 
       FROM agencies 
       WHERE is_active = true
       ORDER BY created_at DESC`
    );
  }

  async function updateAgency(
    id,
    {
      name,
      email,
      password_hash,
      role,
      is_active,
      agency_code,
      group_id,
      parent_agency_id,
      fonction,
      signature_base64,
      stamp_base64,
    }
  ) {
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email);
    }
    if (password_hash !== undefined) {
      updates.push(`password_hash = $${paramIndex++}`);
      params.push(password_hash);
    }
    if (role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      params.push(role);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }
    if (agency_code !== undefined) {
      const normalizedCode = agency_code && typeof agency_code === 'string' && agency_code.trim()
        ? agency_code.trim().toUpperCase()
        : null;
      updates.push(`agency_code = $${paramIndex++}`);
      params.push(normalizedCode);
    }
    if (group_id !== undefined) {
      updates.push(`group_id = $${paramIndex++}`);
      params.push(group_id !== null ? parseInt(group_id) : null);
    }
    if (parent_agency_id !== undefined) {
      updates.push(`parent_agency_id = $${paramIndex++}`);
      params.push(parent_agency_id !== null ? parseInt(parent_agency_id) : null);
    }
    if (fonction !== undefined) {
      updates.push(`fonction = $${paramIndex++}`);
      params.push(fonction);
    }
    if (signature_base64 !== undefined) {
      updates.push(`signature_base64 = $${paramIndex++}`);
      params.push(signature_base64);
    }
    if (stamp_base64 !== undefined) {
      updates.push(`stamp_base64 = $${paramIndex++}`);
      params.push(stamp_base64);
    }

    if (updates.length === 0) {
      return { changes: 0 };
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const sql = `UPDATE agencies SET ${updates.join(", ")} WHERE id = $${paramIndex}`;
    const result = await query(sql, params);
    return { changes: result.changes || 0 };
  }

  /**
   * Update personal profile fields and return the agency row.
   */
  async function updateAgencyProfile(id, { name, fonction, signature_base64, stamp_base64 }) {
    await updateAgency(id, { name, fonction, signature_base64, stamp_base64 });
    return getAgencyById(id);
  }

  async function deleteAgency(id) {
    // Soft delete: set is_active = false
    return await updateAgency(id, { is_active: false });
  }

  // ============================================

  // Landing waitlist (public signups)
  // ============================================

  async function getWaitlistEntries({ page = 1, limit = 50 } = {}) {
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const rawLimit = parseInt(limit, 10);
    const safeLimit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 50));
    const offset = (safePage - 1) * safeLimit;

    const countRows = await query(
      "SELECT COUNT(*)::bigint AS total FROM waitlist_entries"
    );
    const countList = Array.isArray(countRows) ? countRows : countRows ? [countRows] : [];
    const total = Number(countList[0]?.total ?? 0) || 0;

    const rows = await query(
      `SELECT id, email, phone, created_at FROM waitlist_entries ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [safeLimit, offset]
    );
    const entries = Array.isArray(rows) ? rows : rows ? [rows] : [];
    const totalPages = safeLimit > 0 ? Math.ceil(total / safeLimit) : 0;

    return {
      entries,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    };
  }

  async function insertWaitlistEntry({ email, phone }) {
    const res = await query(
      `INSERT INTO waitlist_entries (email, phone) VALUES ($1, $2) RETURNING id, created_at`,
      [email, phone]
    );
    return res;
  }

  // ============================================
  // Recruitment (job offers, questions, applications)
  // ============================================

  async function recruitmentListOpenJobs() {
    const rows = await query(
      `SELECT id, title, type, description, location, slots
       FROM job_offers
       WHERE is_open = true
       ORDER BY created_at DESC`
    );
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }

  async function recruitmentGetJobOfferById(id) {
    const row = await query(
      `SELECT * FROM job_offers WHERE id = $1 LIMIT 1`,
      [id]
    );
    return row || null;
  }

  async function recruitmentGetOpenJobOfferById(id) {
    const row = await query(
      `SELECT * FROM job_offers WHERE id = $1 AND is_open = true LIMIT 1`,
      [id]
    );
    return row || null;
  }

  async function recruitmentListQuestionsForJobOffer(jobOfferId) {
    const rows = await query(
      `SELECT id, job_offer_id, question_text, question_type, options, is_required, order_index, created_at
       FROM job_questions
       WHERE job_offer_id = $1
       ORDER BY order_index ASC, id ASC`,
      [jobOfferId]
    );
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }

  async function recruitmentListAdminJobsWithCounts() {
    const rows = await query(
      `SELECT jo.*,
              (SELECT COUNT(*)::int FROM job_applications ja WHERE ja.job_offer_id = jo.id) AS application_count
       FROM job_offers jo
       ORDER BY jo.created_at DESC`
    );
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }

  async function recruitmentCreateJobOffer({
    title,
    type,
    description = null,
    location = "Hippodrome, Yaoundé",
    slots = 1,
    is_open = true,
  }) {
    const result = await pool.query(
      `INSERT INTO job_offers (title, type, description, location, slots, is_open)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, type, description, location, slots, is_open]
    );
    return result.rows[0] || null;
  }

  async function recruitmentUpdateJobOffer(id, updates = {}) {
    const allowed = [
      "title",
      "type",
      "description",
      "location",
      "slots",
      "is_open",
    ];
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;
      if (value === undefined) continue;
      fields.push(`${key} = $${i++}`);
      values.push(value);
    }
    if (!fields.length) {
      return recruitmentGetJobOfferById(id);
    }
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE job_offers SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async function recruitmentCountApplicationsForJob(jobOfferId) {
    const row = await query(
      `SELECT COUNT(*)::int AS c FROM job_applications WHERE job_offer_id = $1`,
      [jobOfferId]
    );
    return row?.c ?? 0;
  }

  async function recruitmentDeleteJobOffer(id) {
    const count = await recruitmentCountApplicationsForJob(id);
    if (count > 0) {
      return { deleted: false, reason: "has_applications" };
    }
    const res = await query(`DELETE FROM job_offers WHERE id = $1 RETURNING id`, [id]);
    if (!res || !res.id) {
      return { deleted: false, reason: "not_found" };
    }
    return { deleted: true, id: res.id };
  }

  async function recruitmentCreateJobQuestion({
    job_offer_id,
    question_text,
    question_type,
    options = null,
    is_required = true,
    order_index = 0,
  }) {
    const result = await pool.query(
      `INSERT INTO job_questions (job_offer_id, question_text, question_type, options, is_required, order_index)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        job_offer_id,
        question_text,
        question_type,
        options === undefined ? null : options,
        is_required,
        order_index,
      ]
    );
    return result.rows[0] || null;
  }

  async function recruitmentUpdateJobQuestion(questionId, updates = {}) {
    const allowed = ["question_text", "question_type", "options", "is_required", "order_index"];
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;
      if (value === undefined) continue;
      if (key === "options") {
        fields.push(`options = $${i++}`);
        values.push(value === undefined ? null : value);
      } else {
        fields.push(`${key} = $${i++}`);
        values.push(value);
      }
    }
    if (!fields.length) {
      const row = await query(
        `SELECT * FROM job_questions WHERE id = $1 LIMIT 1`,
        [questionId]
      );
      return row || null;
    }
    values.push(questionId);
    const result = await pool.query(
      `UPDATE job_questions SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async function recruitmentDeleteJobQuestion(questionId) {
    const res = await query(`DELETE FROM job_questions WHERE id = $1 RETURNING id`, [
      questionId,
    ]);
    return { deleted: !!(res && res.id), id: res?.id };
  }

  async function recruitmentGetQuestionById(questionId) {
    const row = await query(
      `SELECT * FROM job_questions WHERE id = $1 LIMIT 1`,
      [questionId]
    );
    return row || null;
  }

  async function recruitmentListAdminApplications(filters = {}) {
    const { job_offer_id, status, funnel_step } = filters;
    const conditions = [];
    const params = [];
    let i = 1;
    if (job_offer_id != null && job_offer_id !== "") {
      conditions.push(`ja.job_offer_id = $${i++}`);
      params.push(Number(job_offer_id));
    }
    if (status != null && status !== "") {
      conditions.push(`ja.status = $${i++}`);
      params.push(status);
    }
    if (funnel_step != null && funnel_step !== "") {
      conditions.push(`ja.funnel_step = $${i++}`);
      params.push(Number(funnel_step));
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await query(
      `SELECT ja.*, jo.title AS job_title
       FROM job_applications ja
       INNER JOIN job_offers jo ON jo.id = ja.job_offer_id
       ${where}
       ORDER BY ja.created_at DESC`,
      params
    );
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }

  async function recruitmentGetApplicationDetail(applicationId) {
    const app = await query(
      `SELECT ja.*, jo.title AS job_title, jo.type AS job_type, jo.description AS job_description
       FROM job_applications ja
       INNER JOIN job_offers jo ON jo.id = ja.job_offer_id
       WHERE ja.id = $1
       LIMIT 1`,
      [applicationId]
    );
    if (!app) return null;
    const answers = await query(
      `SELECT ja.id, ja.question_id, ja.answer_text, ja.created_at,
              jq.question_text, jq.question_type, jq.order_index
       FROM job_answers ja
       INNER JOIN job_questions jq ON jq.id = ja.question_id
       WHERE ja.application_id = $1
       ORDER BY jq.order_index ASC, jq.id ASC`,
      [applicationId]
    );
    const list = Array.isArray(answers) ? answers : answers ? [answers] : [];
    return { application: app, answers: list };
  }

  async function recruitmentUpdateApplication(id, updates = {}) {
    const allowed = ["status", "funnel_step", "score", "notes"];
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;
      if (value === undefined) continue;
      fields.push(`${key} = $${i++}`);
      values.push(value);
    }
    if (!fields.length) {
      const row = await query(
        `SELECT * FROM job_applications WHERE id = $1 LIMIT 1`,
        [id]
      );
      return row || null;
    }
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE job_applications SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async function recruitmentDeleteApplication(id) {
    const result = await pool.query(
      `DELETE FROM job_applications WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rows[0]) {
      return { deleted: false, reason: "not_found" };
    }
    return { deleted: true, id: result.rows[0].id };
  }

  async function recruitmentCreateApplicationWithAnswers({
    job_offer_id,
    full_name,
    phone,
    email = null,
    quartier = null,
    education_level = null,
    field_of_study = null,
    school_name = null,
    languages = null,
    currently_employed = null,
    in_other_company = null,
    transport = null,
    availability = null,
    photo_url = null,
    photo_original_name = null,
    cv_url = null,
    cv_original_name = null,
    cover_letter_url = null,
    cover_letter_original_name = null,
    answers = [],
  }) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const offerRes = await client.query(
        `SELECT id, is_open FROM job_offers WHERE id = $1 FOR UPDATE`,
        [job_offer_id]
      );
      if (!offerRes.rows.length) {
        await client.query("ROLLBACK");
        return { error: "offer_not_found" };
      }
      if (!offerRes.rows[0].is_open) {
        await client.query("ROLLBACK");
        return { error: "offer_closed" };
      }

      const ins = await client.query(
        `INSERT INTO job_applications (
          job_offer_id, full_name, phone, email, quartier,
          education_level, field_of_study, school_name, languages,
          currently_employed, in_other_company,
          transport, availability,
          photo_url, photo_original_name,
          cv_url, cv_original_name, cover_letter_url, cover_letter_original_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING id`,
        [
          job_offer_id,
          full_name,
          phone,
          email,
          quartier,
          education_level,
          field_of_study,
          school_name,
          languages,
          currently_employed,
          in_other_company,
          transport,
          availability,
          photo_url,
          photo_original_name,
          cv_url,
          cv_original_name,
          cover_letter_url,
          cover_letter_original_name,
        ]
      );
      const applicationId = ins.rows[0].id;

      for (const a of answers) {
        await client.query(
          `INSERT INTO job_answers (application_id, question_id, answer_text)
           VALUES ($1, $2, $3)`,
          [applicationId, a.question_id, a.answer_text ?? null]
        );
      }

      await client.query("COMMIT");
      return { id: applicationId };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async function listMerchantTerms() {
    const rows = await query(
      `SELECT id, title, content, is_active, created_at, updated_at
       FROM merchant_terms
       ORDER BY created_at DESC`
    );
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }

  async function getMerchantTermsById(id) {
    const row = await query(
      `SELECT id, title, content, is_active, created_at, updated_at
       FROM merchant_terms
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return row || null;
  }

  async function createMerchantTerms({
    title,
    content = null,
    is_active = true,
  }) {
    const result = await pool.query(
      `INSERT INTO merchant_terms (title, content, is_active)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [title, content, is_active]
    );
    return result.rows[0] || null;
  }

  async function updateMerchantTerms(id, updates = {}) {
    const allowed = ["title", "content", "is_active"];
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;
      if (value === undefined) continue;
      fields.push(`${key} = $${i++}`);
      values.push(value);
    }
    if (!fields.length) {
      return getMerchantTermsById(id);
    }
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE merchant_terms SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async function deleteMerchantTerms(id) {
    const res = await query(
      `DELETE FROM merchant_terms WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!res || !res.id) {
      return { deleted: false, reason: "not_found" };
    }
    return { deleted: true, id: res.id };
  }

  const EMPLOYEE_PUBLIC_COLUMNS = `
    id, application_id, job_offer_id, full_name, phone, email, personal_email, photo_url,
    gender, quartier, job_title, job_type, education_level, field_of_study,
    school_name, transport, availability, status, hired_at, notes, salary,
    poste, salary_base, payroll_eligible_from, is_active, enrolled_at,
    employee_type, date_of_birth, place_of_birth, nationality, national_id, address,
    workplace_id,
    (SELECT w.name FROM hr_workplaces w WHERE w.id = employees.workplace_id) AS workplace_name,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
    work_schedule,
    contract_kind, contract_start_date, contract_end_date,
    trial_period_days, mission_description,
    created_at, updated_at,
    (enrolled_at IS NOT NULL) AS is_enrolled
  `;

  /**
   * @param {object|null} row
   * @param {{ year?: number, month?: number }} [opts]
   */
  async function attachSalaryMeta(row, opts = {}) {
    if (!row) return null;
    const history = await listEmployeeSalaryHistory(row.id);
    const { resolveSalaryForMonth, findScheduledSalary } = require("../lib/hrSalary");
    const {
      currentYearMonthDouala,
    } = require("../lib/hrPayrollEligibility");
    const { year: cy, month: cm } = currentYearMonthDouala();
    const year = Number.isFinite(opts.year) ? opts.year : cy;
    const month = Number.isFinite(opts.month) ? opts.month : cm;
    const resolved = resolveSalaryForMonth(
      history,
      year,
      month,
      row.salary_base ?? null
    );
    const scheduled = findScheduledSalary(history);
    return {
      ...row,
      salary_base: resolved,
      salary_scheduled: scheduled,
    };
  }

  async function listEmployeeSalaryHistory(employeeId) {
    const rows = await query(
      `SELECT amount, effective_from, created_at
       FROM employee_salary_history
       WHERE employee_id = $1
       ORDER BY effective_from ASC`,
      [employeeId]
    );
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }

  /**
   * Replace timeline from effective_from forward, then insert the new amount.
   * If this is the first known amount and it changes, keep the old value on the
   * previous month so payslips can show augmentation / baisse.
   * @param {{ employee_id: number, amount: number|null, effective_from: string }} input
   */
  async function replaceSalaryFrom(input) {
    const { previousYearMonth, normalizeEffectiveFrom } = require("../lib/hrSalary");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const effectiveFrom = normalizeEffectiveFrom(input.effective_from);
      if (!effectiveFrom) {
        throw new Error("Invalid salary effective_from");
      }

      const priorRes = await client.query(
        `SELECT amount, effective_from
         FROM employee_salary_history
         WHERE employee_id = $1 AND effective_from < $2::date
         ORDER BY effective_from DESC
         LIMIT 1`,
        [input.employee_id, effectiveFrom]
      );
      const coveringRes = await client.query(
        `SELECT amount
         FROM employee_salary_history
         WHERE employee_id = $1 AND effective_from <= $2::date
         ORDER BY effective_from DESC
         LIMIT 1`,
        [input.employee_id, effectiveFrom]
      );

      if (!priorRes.rows.length && coveringRes.rows.length) {
        const y = Number(effectiveFrom.slice(0, 4));
        const m = Number(effectiveFrom.slice(5, 7));
        const prev = previousYearMonth(y, m);
        const prevFrom = `${prev.year}-${String(prev.month).padStart(2, "0")}-01`;
        await client.query(
          `INSERT INTO employee_salary_history (employee_id, amount, effective_from)
           VALUES ($1, $2, $3::date)
           ON CONFLICT (employee_id, effective_from) DO NOTHING`,
          [input.employee_id, coveringRes.rows[0].amount, prevFrom]
        );
      }

      await client.query(
        `DELETE FROM employee_salary_history
         WHERE employee_id = $1 AND effective_from >= $2::date`,
        [input.employee_id, effectiveFrom]
      );
      await client.query(
        `INSERT INTO employee_salary_history (employee_id, amount, effective_from)
         VALUES ($1, $2, $3::date)`,
        [input.employee_id, input.amount ?? null, effectiveFrom]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * @param {{ year?: number, month?: number }} [opts]
   */
  async function listEmployees(opts = {}) {
    // Latest work-contract / NDA status per employee (for roster filters).
    // pool.query directly: the query() helper treats ANY sql containing
    // "LIMIT 1" (here: inside the subselects) as single-row and would
    // silently drop every employee but the first.
    const result = await pool.query(
      `SELECT ${EMPLOYEE_PUBLIC_COLUMNS},
              (SELECT hc.status FROM hr_contracts hc
                WHERE hc.employee_id = employees.id
                  AND hc.template_key = 'contrat_travail_v1'
                ORDER BY hc.created_at DESC LIMIT 1) AS contract_status,
              (SELECT hc.status FROM hr_contracts hc
                WHERE hc.employee_id = employees.id
                  AND hc.template_key = 'nda_v1'
                ORDER BY hc.created_at DESC LIMIT 1) AS nda_status
       FROM employees
       ORDER BY created_at DESC`
    );
    return Promise.all(result.rows.map((row) => attachSalaryMeta(row, opts)));
  }

  async function getEmployeeById(id, opts = {}) {
    const row = await query(
      `SELECT ${EMPLOYEE_PUBLIC_COLUMNS}
       FROM employees
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return attachSalaryMeta(row || null, opts);
  }

  async function getEmployeeByIdWithDescriptor(id) {
    const row = await query(
      `SELECT ${EMPLOYEE_PUBLIC_COLUMNS}, face_descriptor
       FROM employees
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return attachSalaryMeta(row || null);
  }

  async function createEmployee({
    full_name,
    email,
    personal_email = null,
    phone = null,
    poste = null,
    salary_base = null,
    payroll_eligible_from = null,
    employee_type = null,
    date_of_birth = null,
    place_of_birth = null,
    gender = null,
    nationality = null,
    national_id = null,
    address = null,
    workplace_id = null,
    emergency_contact_name = null,
    emergency_contact_phone = null,
    emergency_contact_relation = null,
    work_schedule = null,
    contract_kind = null,
    contract_start_date = null,
    contract_end_date = null,
    trial_period_days = null,
    mission_description = null,
  }) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPersonalEmail =
      personal_email == null || personal_email === ""
        ? null
        : String(personal_email).trim().toLowerCase();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO employees (
           full_name, email, personal_email, phone, poste, salary_base, payroll_eligible_from,
           employee_type, date_of_birth, place_of_birth, gender, nationality, national_id, address,
           workplace_id, emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
           work_schedule,
           contract_kind, contract_start_date, contract_end_date,
           trial_period_days, mission_description, application_id
         )
         VALUES (
           $1, $2, $3, $4, $5, $6,
           COALESCE($7::date, (date_trunc('month', timezone('Africa/Douala', NOW())))::date),
           $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, NULL
         )
         RETURNING ${EMPLOYEE_PUBLIC_COLUMNS}`,
        [
          full_name,
          normalizedEmail,
          normalizedPersonalEmail,
          phone ?? null,
          poste ?? null,
          salary_base ?? null,
          payroll_eligible_from ?? null,
          employee_type ?? null,
          date_of_birth ?? null,
          place_of_birth ?? null,
          gender ?? null,
          nationality ?? null,
          national_id ?? null,
          address ?? null,
          workplace_id ?? null,
          emergency_contact_name ?? null,
          emergency_contact_phone ?? null,
          emergency_contact_relation ?? null,
          work_schedule ?? null,
          contract_kind ?? null,
          contract_start_date ?? null,
          contract_end_date ?? null,
          trial_period_days ?? null,
          mission_description ?? null,
        ]
      );
      const row = result.rows[0] || null;
      if (row) {
        const effectiveFrom =
          payroll_eligible_from ||
          row.payroll_eligible_from ||
          null;
        await client.query(
          `INSERT INTO employee_salary_history (employee_id, amount, effective_from)
           VALUES ($1, $2, COALESCE($3::date, (date_trunc('month', timezone('Africa/Douala', NOW())))::date))
           ON CONFLICT (employee_id, effective_from) DO UPDATE
           SET amount = EXCLUDED.amount`,
          [row.id, salary_base ?? null, effectiveFrom]
        );
      }
      await client.query("COMMIT");
      return row ? attachSalaryMeta(row) : null;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async function updateEmployee(id, updates = {}) {
    const allowed = [
      "full_name",
      "email",
      "personal_email",
      "phone",
      "poste",
      "salary_base",
      "payroll_eligible_from",
      "is_active",
      "employee_type",
      "date_of_birth",
      "place_of_birth",
      "gender",
      "nationality",
      "national_id",
      "address",
      "workplace_id",
      "emergency_contact_name",
      "emergency_contact_phone",
      "emergency_contact_relation",
      "work_schedule",
      "contract_kind",
      "contract_start_date",
      "contract_end_date",
      "trial_period_days",
      "mission_description",
    ];
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;
      if (value === undefined) continue;
      let nextValue = value;
      if ((key === "email" || key === "personal_email") && value != null) {
        nextValue = String(value).trim().toLowerCase();
      }
      fields.push(`${key} = $${i++}`);
      values.push(nextValue);
    }
    if (!fields.length) {
      return getEmployeeById(id);
    }
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE employees SET ${fields.join(", ")} WHERE id = $${i}
       RETURNING ${EMPLOYEE_PUBLIC_COLUMNS}`,
      values
    );
    return attachSalaryMeta(result.rows[0] || null);
  }

  async function deleteEmployee(id) {
    // Soft delete: keep attendance history, block check-in
    return await updateEmployee(id, { is_active: false });
  }

  async function enrollEmployeeFace(id, faceDescriptor) {
    const result = await pool.query(
      `UPDATE employees
       SET face_descriptor = $1::jsonb,
           enrolled_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING ${EMPLOYEE_PUBLIC_COLUMNS}`,
      [JSON.stringify(faceDescriptor), id]
    );
    return attachSalaryMeta(result.rows[0] || null);
  }

  async function getEmployeeByEmailWithDescriptor(email) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const row = await query(
      `SELECT ${EMPLOYEE_PUBLIC_COLUMNS}, face_descriptor
       FROM employees
       WHERE lower(email) = $1
       LIMIT 1`,
      [normalizedEmail]
    );
    return attachSalaryMeta(row || null);
  }

  async function getAttendanceByEmployeeAndDate(employeeId, date) {
    const row = await query(
      `SELECT id, employee_id, date, check_in_time, status,
              face_verified, gps_verified, latitude, longitude, created_at
       FROM attendances
       WHERE employee_id = $1 AND date = $2::date
       LIMIT 1`,
      [employeeId, date]
    );
    return row || null;
  }

  async function createAttendance({
    employee_id,
    date,
    check_in_time,
    status,
    face_verified = false,
    gps_verified = false,
    latitude = null,
    longitude = null,
  }) {
    const result = await pool.query(
      `INSERT INTO attendances (
         employee_id, date, check_in_time, status,
         face_verified, gps_verified, latitude, longitude
       ) VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8)
       RETURNING id, employee_id, date, check_in_time, status,
                 face_verified, gps_verified, latitude, longitude, created_at`,
      [
        employee_id,
        date,
        check_in_time,
        status,
        face_verified,
        gps_verified,
        latitude,
        longitude,
      ]
    );
    return result.rows[0] || null;
  }

  /**
   * Insert or update attendance for (employee_id, date).
   * On conflict: refresh status, check_in_time, and verification flags.
   * Returns the row joined with employee name/email/poste (admin list shape).
   */
  async function upsertAttendance({
    employee_id,
    date,
    check_in_time,
    status,
    face_verified = false,
    gps_verified = false,
    latitude = null,
    longitude = null,
  }) {
    const result = await pool.query(
      `INSERT INTO attendances (
         employee_id, date, check_in_time, status,
         face_verified, gps_verified, latitude, longitude
       ) VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (employee_id, date) DO UPDATE SET
         check_in_time = EXCLUDED.check_in_time,
         status = EXCLUDED.status,
         face_verified = EXCLUDED.face_verified,
         gps_verified = EXCLUDED.gps_verified,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude
       RETURNING id, employee_id, date, check_in_time, status,
                 face_verified, gps_verified, latitude, longitude, created_at`,
      [
        employee_id,
        date,
        check_in_time,
        status,
        face_verified,
        gps_verified,
        latitude,
        longitude,
      ]
    );
    const row = result.rows[0] || null;
    if (!row) return null;
    const employee = await getEmployeeById(employee_id);
    return {
      ...row,
      full_name: employee?.full_name ?? null,
      email: employee?.email ?? null,
      poste: employee?.poste ?? null,
    };
  }

  async function listAttendances({
    employee_id = null,
    date = null,
    month = null,
    year = null,
  } = {}) {
    const conditions = [];
    const params = [];
    let i = 1;

    if (employee_id != null) {
      conditions.push(`a.employee_id = $${i++}`);
      params.push(employee_id);
    }
    if (date) {
      conditions.push(`a.date = $${i++}::date`);
      params.push(date);
    }
    if (month != null && year != null) {
      conditions.push(
        `EXTRACT(MONTH FROM a.date) = $${i++} AND EXTRACT(YEAR FROM a.date) = $${i++}`
      );
      params.push(month, year);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await query(
      `SELECT a.id, a.employee_id, a.date, a.check_in_time, a.status,
              a.face_verified, a.gps_verified, a.latitude, a.longitude, a.created_at,
              e.full_name, e.email, e.poste
       FROM attendances a
       INNER JOIN employees e ON e.id = a.employee_id
       ${where}
       ORDER BY a.date DESC, a.check_in_time DESC NULLS LAST`,
      params
    );
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }

  async function summarizeAttendances({ month, year }) {
    const rows = await query(
      `SELECT e.id AS employee_id,
              e.full_name,
              e.email,
              e.poste,
              COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0)::int AS days_present,
              COALESCE(SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END), 0)::int AS days_late
       FROM employees e
       LEFT JOIN attendances a
         ON a.employee_id = e.id
        AND EXTRACT(MONTH FROM a.date) = $1
        AND EXTRACT(YEAR FROM a.date) = $2
       WHERE e.is_active = true
       GROUP BY e.id, e.full_name, e.email, e.poste
       ORDER BY e.full_name ASC`,
      [month, year]
    );
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }

  async function getCompanySettings() {
    const rows = await query(
      `SELECT id, company_name, legal_name, tax_id, trade_register, address, phone, email,
              accent_color, logo_base64, signature_base64, stamp_base64,
              signer_name, signer_role, updated_at
       FROM company_settings WHERE id = 1`
    );
    const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
    return list[0] || null;
  }

  async function upsertCompanySettings({
    company_name,
    legal_name,
    tax_id,
    trade_register,
    address,
    phone,
    email,
    accent_color,
    logo_base64,
    signature_base64,
    stamp_base64,
    signer_name,
    signer_role,
  }) {
    const rows = await query(
      `INSERT INTO company_settings (
         id, company_name, legal_name, tax_id, trade_register, address, phone, email,
         accent_color, logo_base64, signature_base64, stamp_base64,
         signer_name, signer_role, updated_at
       ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         company_name = EXCLUDED.company_name,
         legal_name = EXCLUDED.legal_name,
         tax_id = EXCLUDED.tax_id,
         trade_register = EXCLUDED.trade_register,
         address = EXCLUDED.address,
         phone = EXCLUDED.phone,
         email = EXCLUDED.email,
         accent_color = EXCLUDED.accent_color,
         logo_base64 = EXCLUDED.logo_base64,
         signature_base64 = EXCLUDED.signature_base64,
         stamp_base64 = EXCLUDED.stamp_base64,
         signer_name = EXCLUDED.signer_name,
         signer_role = EXCLUDED.signer_role,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, company_name, legal_name, tax_id, trade_register, address, phone, email,
                 accent_color, logo_base64, signature_base64, stamp_base64,
                 signer_name, signer_role, updated_at`,
      [
        company_name,
        legal_name ?? null,
        tax_id ?? null,
        trade_register ?? null,
        address ?? null,
        phone ?? null,
        email ?? null,
        accent_color,
        logo_base64 ?? null,
        signature_base64 ?? null,
        stamp_base64 ?? null,
        signer_name ?? null,
        signer_role ?? null,
      ]
    );
    const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
    return list[0] || null;
  }

  async function listWorkplaces({ activeOnly = false } = {}) {
    const rows = await query(
      `SELECT id, name, is_active, created_at, updated_at
       FROM hr_workplaces
       ${activeOnly ? "WHERE is_active = true" : ""}
       ORDER BY name ASC`
    );
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }

  async function getWorkplaceById(id) {
    const row = await query(
      `SELECT id, name, is_active, created_at, updated_at
       FROM hr_workplaces
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return row || null;
  }

  async function createWorkplace({ name, is_active = true }) {
    const result = await pool.query(
      `INSERT INTO hr_workplaces (name, is_active)
       VALUES ($1, $2)
       RETURNING id, name, is_active, created_at, updated_at`,
      [String(name).trim(), is_active !== false]
    );
    return result.rows[0] || null;
  }

  async function updateWorkplace(id, updates = {}) {
    const allowed = ["name", "is_active"];
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key) || value === undefined) continue;
      let next = value;
      if (key === "name" && value != null) next = String(value).trim();
      fields.push(`${key} = $${i++}`);
      values.push(next);
    }
    if (!fields.length) return getWorkplaceById(id);
    fields.push("updated_at = NOW()");
    values.push(id);
    const result = await pool.query(
      `UPDATE hr_workplaces SET ${fields.join(", ")} WHERE id = $${i}
       RETURNING id, name, is_active, created_at, updated_at`,
      values
    );
    return result.rows[0] || null;
  }

  async function deleteWorkplace(id) {
    // Soft-deactivate; keep FK history on employees.
    const result = await pool.query(
      `UPDATE hr_workplaces
       SET is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, is_active, created_at, updated_at`,
      [id]
    );
    return result.rows[0] || null;
  }

  // Metadata only — PDF/HTML blobs and snapshot are fetched explicitly.
  const HR_CONTRACT_META_COLUMNS = `
    id, employee_id, status, template_key, contract_date,
    document_file_name, document_sha256,
    ready_for_signature_at, signature_token, signature_token_expires_at,
    signed_at, signature_consent, signed_document_sha256,
    declined_at, decline_reason, created_at, updated_at
  `;

  async function createHrContract({
    employee_id,
    template_key,
    contract_date,
    snapshot,
    document_html,
    document_pdf,
    document_file_name,
    document_sha256,
  }) {
    const result = await pool.query(
      `INSERT INTO hr_contracts (
         employee_id, status, template_key, contract_date, snapshot,
         document_html, document_pdf, document_file_name, document_sha256
       ) VALUES ($1, 'generated', $2, $3::date, $4::jsonb, $5, $6, $7, $8)
       RETURNING ${HR_CONTRACT_META_COLUMNS}`,
      [
        employee_id,
        template_key,
        contract_date,
        JSON.stringify(snapshot),
        document_html,
        document_pdf,
        document_file_name,
        document_sha256,
      ]
    );
    return result.rows[0] || null;
  }

  async function listHrContractsByEmployee(employeeId) {
    const rows = await query(
      `SELECT ${HR_CONTRACT_META_COLUMNS}
       FROM hr_contracts
       WHERE employee_id = $1
       ORDER BY created_at DESC`,
      [employeeId]
    );
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }

  async function getHrContractById(id, { withDocuments = false } = {}) {
    const extra = withDocuments
      ? ", snapshot, document_html, document_pdf, signed_pdf, signature_image_base64"
      : ", snapshot";
    const row = await query(
      `SELECT ${HR_CONTRACT_META_COLUMNS}${extra}
       FROM hr_contracts
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return row || null;
  }

  async function getHrContractByToken(token) {
    const row = await query(
      `SELECT ${HR_CONTRACT_META_COLUMNS}, snapshot, document_html, document_pdf, signed_pdf
       FROM hr_contracts
       WHERE signature_token = $1
       LIMIT 1`,
      [token]
    );
    return row || null;
  }

  async function updateHrContract(id, updates = {}) {
    const allowed = [
      "status",
      "ready_for_signature_at",
      "signature_token",
      "signature_token_expires_at",
      "signed_at",
      "signature_consent",
      "signature_ip",
      "signature_user_agent",
      "signature_image_base64",
      "signed_pdf",
      "signed_document_sha256",
      "declined_at",
      "decline_reason",
    ];
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key) || value === undefined) continue;
      fields.push(`${key} = $${i++}`);
      values.push(value);
    }
    if (!fields.length) return getHrContractById(id);
    fields.push("updated_at = NOW()");
    values.push(id);
    const result = await pool.query(
      `UPDATE hr_contracts SET ${fields.join(", ")} WHERE id = $${i}
       RETURNING ${HR_CONTRACT_META_COLUMNS}`,
      values
    );
    return result.rows[0] || null;
  }

  // -------------------------------------------------------------------------
  // Company documents (règlement intérieur) — versions + acknowledgements
  // -------------------------------------------------------------------------

  const COMPANY_DOC_COLUMNS = `
    d.id, d.doc_type, d.title, d.slug, d.description, d.status,
    d.current_version_id, d.created_by, d.created_at, d.updated_at
  `;
  const DOC_VERSION_META_COLUMNS = `
    v.id, v.document_id, v.version_number, v.status,
    v.created_by, v.published_by, v.published_at, v.created_at, v.updated_at
  `;

  async function listCompanyDocuments({ docType = null } = {}) {
    const params = [];
    let where = "";
    if (docType) {
      params.push(docType);
      where = "WHERE d.doc_type = $1";
    }
    const rows = await query(
      `SELECT ${COMPANY_DOC_COLUMNS},
              cv.version_number AS current_version_number,
              cv.published_at AS current_version_published_at
       FROM hr_company_documents d
       LEFT JOIN hr_company_document_versions cv ON cv.id = d.current_version_id
       ${where}
       ORDER BY d.created_at ASC`,
      params
    );
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }

  async function getCompanyDocumentById(id) {
    const row = await query(
      `SELECT ${COMPANY_DOC_COLUMNS},
              cv.version_number AS current_version_number,
              cv.published_at AS current_version_published_at
       FROM hr_company_documents d
       LEFT JOIN hr_company_document_versions cv ON cv.id = d.current_version_id
       WHERE d.id = $1
       LIMIT 1`,
      [id]
    );
    return row || null;
  }

  async function createCompanyDocument({
    doc_type = "internal_regulation",
    title,
    slug,
    description = null,
    created_by = null,
  }) {
    const result = await pool.query(
      `INSERT INTO hr_company_documents (doc_type, title, slug, description, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, doc_type, title, slug, description, status,
                 current_version_id, created_by, created_at, updated_at`,
      [doc_type, title, slug, description, created_by]
    );
    return result.rows[0] || null;
  }

  async function listCompanyDocumentVersions(documentId) {
    const rows = await query(
      `SELECT ${DOC_VERSION_META_COLUMNS},
              (SELECT COUNT(*)::int FROM hr_company_document_acknowledgements a
                WHERE a.version_id = v.id) AS acknowledgement_count
       FROM hr_company_document_versions v
       WHERE v.document_id = $1
       ORDER BY v.version_number DESC`,
      [documentId]
    );
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }

  async function getCompanyDocumentVersionById(id) {
    const row = await query(
      `SELECT ${DOC_VERSION_META_COLUMNS}, v.content_md
       FROM hr_company_document_versions v
       WHERE v.id = $1
       LIMIT 1`,
      [id]
    );
    return row || null;
  }

  async function createCompanyDocumentVersion({
    document_id,
    content_md = "",
    created_by = null,
  }) {
    const result = await pool.query(
      `INSERT INTO hr_company_document_versions
         (document_id, version_number, content_md, created_by)
       VALUES (
         $1,
         COALESCE((SELECT MAX(version_number) FROM hr_company_document_versions
                   WHERE document_id = $1), 0) + 1,
         $2, $3
       )
       RETURNING id, document_id, version_number, status, content_md,
                 created_by, published_by, published_at, created_at, updated_at`,
      [document_id, content_md, created_by]
    );
    return result.rows[0] || null;
  }

  async function updateCompanyDocumentVersionContent(id, content_md) {
    const result = await pool.query(
      `UPDATE hr_company_document_versions
       SET content_md = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'draft'
       RETURNING id, document_id, version_number, status, content_md,
                 created_by, published_by, published_at, created_at, updated_at`,
      [content_md, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Publish a draft version atomically: the previous published version is
   * archived (kept, never mutated in content), the draft becomes published,
   * and the document points to it as current.
   */
  async function publishCompanyDocumentVersion(id, publishedBy = null) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query(
        `SELECT id, document_id, status FROM hr_company_document_versions
         WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const version = current.rows[0];
      if (!version || version.status !== "draft") {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query(
        `UPDATE hr_company_document_versions
         SET status = 'archived', updated_at = NOW()
         WHERE document_id = $1 AND status = 'published'`,
        [version.document_id]
      );
      const published = await client.query(
        `UPDATE hr_company_document_versions
         SET status = 'published', published_at = NOW(), published_by = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, document_id, version_number, status, content_md,
                   created_by, published_by, published_at, created_at, updated_at`,
        [publishedBy, id]
      );
      await client.query(
        `UPDATE hr_company_documents
         SET current_version_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [id, version.document_id]
      );
      await client.query("COMMIT");
      return published.rows[0] || null;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /** Current published version (with content) for a doc type. */
  async function getCurrentCompanyDocument(docType = "internal_regulation") {
    const row = await query(
      `SELECT ${COMPANY_DOC_COLUMNS},
              v.id AS version_id, v.version_number, v.content_md,
              v.published_at
       FROM hr_company_documents d
       INNER JOIN hr_company_document_versions v ON v.id = d.current_version_id
       WHERE d.doc_type = $1 AND d.status = 'active' AND v.status = 'published'
       ORDER BY d.created_at ASC
       LIMIT 1`,
      [docType]
    );
    return row || null;
  }

  /** Idempotent: returns the existing row when already acknowledged. */
  async function acknowledgeCompanyDocumentVersion({
    version_id,
    employee_id,
    ip_address = null,
    user_agent = null,
  }) {
    const inserted = await pool.query(
      `INSERT INTO hr_company_document_acknowledgements
         (version_id, employee_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (version_id, employee_id) DO NOTHING
       RETURNING id, version_id, employee_id, acknowledged_at, ip_address, user_agent`,
      [version_id, employee_id, ip_address, user_agent]
    );
    if (inserted.rows[0]) {
      return { ...inserted.rows[0], already_acknowledged: false };
    }
    const existing = await query(
      `SELECT id, version_id, employee_id, acknowledged_at, ip_address, user_agent
       FROM hr_company_document_acknowledgements
       WHERE version_id = $1 AND employee_id = $2
       LIMIT 1`,
      [version_id, employee_id]
    );
    return existing ? { ...existing, already_acknowledged: true } : null;
  }

  async function getCompanyDocumentAcknowledgement(versionId, employeeId) {
    const row = await query(
      `SELECT id, version_id, employee_id, acknowledged_at
       FROM hr_company_document_acknowledgements
       WHERE version_id = $1 AND employee_id = $2
       LIMIT 1`,
      [versionId, employeeId]
    );
    return row || null;
  }

  /**
   * Read/unread status of every active employee for a version — one query
   * (LEFT JOIN, no N+1); "not read" = absence of an acknowledgement row.
   */
  async function listCompanyDocumentReadStatus(versionId) {
    const rows = await query(
      `SELECT e.id AS employee_id, e.full_name, e.poste,
              a.acknowledged_at
       FROM employees e
       LEFT JOIN hr_company_document_acknowledgements a
         ON a.employee_id = e.id AND a.version_id = $1
       WHERE e.is_active = true
       ORDER BY e.full_name ASC`,
      [versionId]
    );
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }

  /**
   * Generating a new document supersedes still-open ones of the same
   * template_key for the employee (an open work contract survives
   * generating an NDA, and vice versa).
   */
  async function cancelOpenHrContracts(employeeId, templateKey = null) {
    const params = [employeeId];
    let keyFilter = "";
    if (templateKey != null) {
      params.push(templateKey);
      keyFilter = "AND template_key = $2";
    }
    const result = await pool.query(
      `UPDATE hr_contracts
       SET status = 'cancelled', signature_token = NULL, updated_at = NOW()
       WHERE employee_id = $1
         AND status IN ('generated', 'ready_for_signature')
         ${keyFilter}
       RETURNING id`,
      params
    );
    return result.rows.map((r) => r.id);
  }

  return {
    type: "postgres",
    query,
    // Agency queries
    createAgency,
    getAgencyById,
    getAgencyByEmail,
    findAgencyByCode,
    getAllAgencies,
    updateAgency,
    updateAgencyProfile,
    deleteAgency,
    // Waitlist
    getWaitlistEntries,
    insertWaitlistEntry,
    // Recruitment
    recruitmentListOpenJobs,
    recruitmentGetJobOfferById,
    recruitmentGetOpenJobOfferById,
    recruitmentListQuestionsForJobOffer,
    recruitmentListAdminJobsWithCounts,
    recruitmentCreateJobOffer,
    recruitmentUpdateJobOffer,
    recruitmentDeleteJobOffer,
    recruitmentCountApplicationsForJob,
    recruitmentCreateJobQuestion,
    recruitmentUpdateJobQuestion,
    recruitmentDeleteJobQuestion,
    recruitmentGetQuestionById,
    recruitmentListAdminApplications,
    recruitmentGetApplicationDetail,
    recruitmentUpdateApplication,
    recruitmentDeleteApplication,
    recruitmentCreateApplicationWithAnswers,
    // Merchant terms
    listMerchantTerms,
    getMerchantTermsById,
    createMerchantTerms,
    updateMerchantTerms,
    deleteMerchantTerms,
    // HR employees
    listEmployees,
    getEmployeeById,
    getEmployeeByIdWithDescriptor,
    getEmployeeByEmailWithDescriptor,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    enrollEmployeeFace,
    listEmployeeSalaryHistory,
    replaceSalaryFrom,
    getAttendanceByEmployeeAndDate,
    createAttendance,
    upsertAttendance,
    listAttendances,
    summarizeAttendances,
    getCompanySettings,
    upsertCompanySettings,
    listWorkplaces,
    getWorkplaceById,
    createWorkplace,
    updateWorkplace,
    deleteWorkplace,
    createHrContract,
    listHrContractsByEmployee,
    getHrContractById,
    getHrContractByToken,
    updateHrContract,
    cancelOpenHrContracts,
    listCompanyDocuments,
    getCompanyDocumentById,
    createCompanyDocument,
    listCompanyDocumentVersions,
    getCompanyDocumentVersionById,
    createCompanyDocumentVersion,
    updateCompanyDocumentVersionContent,
    publishCompanyDocumentVersion,
    getCurrentCompanyDocument,
    acknowledgeCompanyDocumentVersion,
    getCompanyDocumentAcknowledgement,
    listCompanyDocumentReadStatus,
    close: async () => pool.end(),
    getRawDb: () => pool,
    TIME_ZONE,
  };
}

module.exports = createPostgresQueries;
