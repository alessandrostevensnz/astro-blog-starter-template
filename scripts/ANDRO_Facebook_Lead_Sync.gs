/**
 * ANDRO / Meta Facebook Instant Form -> Google Sheets -> ANDRO D1
 * Prepared in SAFE MODE. Never send entrants until rules and privacy are approved.
 * Paste into the Code.gs file that is bound to ANDRO GIVEAWAY spreadsheet.
 *
 * Google Apps Script Project Settings > Script properties (not source code):
 *   ANDRO_SYNC_ENABLED = false
 *   ANDRO_SYNC_SECRET = (long random secret; MATCH Cloudflare secret)
 *   ANDRO_TERMS_COLUMN = (exact Meta-generated column heading with affirmative agreement)
 *   ANDRO_MARKETING_COLUMN = (optional separate Meta-generated marketing checkbox column)
 *   ANDRO_TEST_LEAD_ID = (exact ID of the owner's manually submitted test; never import it)
 *
 * In Cloudflare the matching secret is WIN_META_SHEETS_SYNC_SECRET.
 * ANDRO sync remains disabled separately on Cloudflare until legal approval.
 *
 * Do NOT use onEdit() or "On form submit" triggers. Meta adds rows through an
 * external integration. A 5-minute time-driven trigger is the reliable choice.
 */
const ANDRO_SYNC = Object.freeze({
  sheetName: 'Sheet1',
  logName: 'ANDRO Sync Log',
  url: 'https://andro.co.nz/api/win/meta/sheets',
  maxRowsPerRun: 50
});

function androPreview() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ANDRO_SYNC.sheetName);
  if (!sheet) throw new Error('Expected sheet tab "Sheet1" not found.');
  const rows = sheet.getDataRange().getDisplayValues();
  const headers = rows[0] || [];
  const normalized = headers.map(androNormalize_);
  const required = ['id', 'created_time', 'form_id', 'email', 'full_name', 'phone_number'];
  const missing = required.filter(h => !normalized.includes(h));
  const props = PropertiesService.getScriptProperties();
  const terms = androNormalize_(props.getProperty('ANDRO_TERMS_COLUMN') || '');
  const hasTerms = Boolean(terms && normalized.includes(terms));
  const testRows = rows.slice(1).filter(row => {
    const index = normalized.indexOf('email');
    return index !== -1 && /^test@meta\.com$/i.test(String(row[index]).trim());
  }).length;
  Logger.log('ANDRO PREVIEW: records=%s, Meta test rows=%s', Math.max(0, rows.length - 1), testRows);
  Logger.log('Required Meta columns present: %s', missing.length === 0 ? 'yes' : 'NO: ' + missing.join(', '));
  Logger.log('Verified consent column configured and present: %s', hasTerms ? 'yes' : 'NO');
  Logger.log('Sync enabled: %s (must remain false until entry-method approval)',
    props.getProperty('ANDRO_SYNC_ENABLED') === 'true' ? 'YES' : 'no');
  Logger.log('No leads have been sent by this preview. Never add a consent column manually to pretend an entrant agreed.');
}

function androSyncLeads() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ANDRO_SYNC_ENABLED') !== 'true') {
    Logger.log('SAFE MODE: ANDRO Facebook lead sync is disabled; no rows were sent.');
    return;
  }
  const secret = props.getProperty('ANDRO_SYNC_SECRET');
  if (!secret || secret.length < 32) throw new Error('ANDRO_SYNC_SECRET missing or too short');
  const termsName = androNormalize_(props.getProperty('ANDRO_TERMS_COLUMN') || '');
  if (!termsName) throw new Error('Missing actual Meta-generated consent column; sync refused');
  const testLeadId = String(props.getProperty('ANDRO_TEST_LEAD_ID') || '').trim().replace(/^l:/i, '');
  if (testLeadId && !/^\d{5,25}$/.test(testLeadId)) throw new Error('Invalid ANDRO_TEST_LEAD_ID');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const source = book.getSheetByName(ANDRO_SYNC.sheetName);
    if (!source) throw new Error('Sheet1 not found');
    const grid = source.getDataRange().getDisplayValues();
    if (grid.length <= 1) return;
    const heads = grid[0].map(androNormalize_);
    const idx = key => heads.indexOf(androNormalize_(key));
    for (const col of ['id','created_time','form_id','email','full_name','phone_number']) {
      if (idx(col) < 0) throw new Error('Missing Meta source column: ' + col);
    }
    if (idx(termsName) < 0) throw new Error('Required Meta consent column not found: ' + termsName);
    const marketingName = androNormalize_(props.getProperty('ANDRO_MARKETING_COLUMN') || '');
    // No optional marketing field? Always record "not opted in".
    if (marketingName && idx(marketingName) < 0) throw new Error('Optional marketing column configured but not in Meta source');
    let log = book.getSheetByName(ANDRO_SYNC.logName);
    if (!log) {
      log = book.insertSheet(ANDRO_SYNC.logName);
      log.appendRow(['lead_id', 'status', 'processed_at']); // NEVER copy names/emails/phones into this log
    }
    const history = log.getLastRow() > 1
      ? log.getRange(2, 1, log.getLastRow() - 1, 1).getDisplayValues().flat() : [];
    const seen = new Set(history);
    let complete = 0;
    for (const row of grid.slice(1)) {
      if (complete >= ANDRO_SYNC.maxRowsPerRun) break;
      const get = k => idx(k) >= 0 ? String(row[idx(k)] || '').trim() : '';
      const leadId = get('id').replace(/^l:/i, '');
      if (!/^\d{5,25}$/.test(leadId) || seen.has(leadId)) continue;
      const email = get('email');
      const name = get('full_name');
      // Exclude only the explicitly identified owner-controlled test, never a broad email/name pattern.
      if (testLeadId && leadId === testLeadId) {
        log.appendRow([leadId, 'skipped_owner_test', new Date().toISOString()]);
        seen.add(leadId);
        continue;
      }
      // Do not count Meta's generated sample lead or move test data to the D1 entrants table.
      if (/^test@meta\.com$/i.test(email) || /<test lead:/i.test(name)) {
        log.appendRow([leadId, 'skipped_test', new Date().toISOString()]);
        seen.add(leadId);
        continue;
      }
      if (!androAffirmative_(get(termsName))) {
        // No documented terms agreement => NOT an official entry. Don't send personal data.
        Logger.log('One lead has no affirmative terms agreement; not transferred.');
        continue;
      }
      const data = JSON.stringify({
        source: 'meta_google_sheets',
        sent_at: new Date().toISOString(),
        lead: {
          id: leadId,
          form_id: get('form_id').replace(/^f:/i, ''),
          created_time: get('created_time'),
          full_name: name,
          email: email,
          phone_number: androPhone_(get('phone_number')),
          terms_accepted: true,
          marketing_consent: Boolean(marketingName && androAffirmative_(get(marketingName)))
        }
      });
      const digest = Utilities.computeHmacSha256Signature(data, secret, Utilities.Charset.UTF_8)
        .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
      const reply = UrlFetchApp.fetch(ANDRO_SYNC.url, {
        method: 'post',
        contentType: 'application/json; charset=utf-8',
        headers: { 'X-ANDRO-Sheets-Signature': 'sha256=' + digest },
        payload: data,
        followRedirects: false,
        muteHttpExceptions: true
      });
      const status = reply.getResponseCode();
      if (status !== 200) {
        Logger.log('ANDRO endpoint unavailable or not enabled (HTTP %s). Sync stopped. No entries assumed saved.', status);
        return; // Retry the SAME row later; don't mark as processed.
      }
      const answer = JSON.parse(reply.getContentText());
      if (!['accepted', 'duplicate', 'already_seen'].includes(answer.status))
        throw new Error('Unexpected ANDRO sync acknowledgement');
      log.appendRow([leadId, answer.status, new Date().toISOString()]);
      seen.add(leadId);
      complete++;
    }
    Logger.log('ANDRO lead-sync completed, confirmed rows: %s', complete);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Test the signed production connection without sending names, emails or phones,
 * creating an entry, or enabling scheduled sync. Requires the backend switches
 * to be on, but the Apps Script sync switch to remain OFF.
 * Use only the explicitly identified, manually submitted owner test lead.
 */
function androCheckConnection() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ANDRO_SYNC_ENABLED') !== 'false')
    throw new Error('Keep ANDRO_SYNC_ENABLED explicitly false during this check.');
  const secret = props.getProperty('ANDRO_SYNC_SECRET') || '';
  if (secret.length < 32) throw new Error('ANDRO_SYNC_SECRET missing or too short');
  const testId = String(props.getProperty('ANDRO_TEST_LEAD_ID') || '').trim().replace(/^l:/i, '');
  if (!/^\d{5,25}$/.test(testId)) throw new Error('Set ANDRO_TEST_LEAD_ID to the exact manual test lead ID.');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ANDRO_SYNC.sheetName);
  if (!sheet) throw new Error('Sheet1 not found');
  const grid = sheet.getDataRange().getDisplayValues();
  const heads = grid[0].map(androNormalize_);
  const termsName = androNormalize_(props.getProperty('ANDRO_TERMS_COLUMN') || '');
  if (!termsName || !heads.includes(termsName)) throw new Error('Terms column missing');
  const idx = key => heads.indexOf(androNormalize_(key));
  for (const col of ['id','form_id','created_time','phone_number']) {
    if (idx(col) < 0) throw new Error('Missing Meta source column: ' + col);
  }
  const matches = grid.slice(1).filter(row =>
    String(row[idx('id')] || '').trim().replace(/^l:/i, '') === testId);
  if (matches.length !== 1) throw new Error('The manual test lead ID must match exactly one source row.');
  const row = matches[0];
  const get = key => String(row[idx(key)] || '').trim();
  if (!androAffirmative_(get(termsName))) throw new Error('The owner test did not record a Yes response.');
  const phone = androPhone_(get('phone_number'));
  if (phone.length < 6 || phone.length > 30 || !/^[+()0-9\s.-]+$/.test(phone))
    throw new Error('Phone format still invalid after normalisation.');
  Logger.log('Manual test: Yes response recognised; phone format valid; test lead excluded from normal sync.');
  // Deliberately refuse terms in the PROBE, not in the source sheet.
  // No contact details are sent, and the server must reject this payload before storage.
  const data = JSON.stringify({
    source: 'meta_google_sheets',
    sent_at: new Date().toISOString(),
    lead: {
      id: testId,
      form_id: get('form_id').replace(/^f:/i, ''),
      created_time: get('created_time'),
      terms_accepted: false
    }
  });
  const digest = Utilities.computeHmacSha256Signature(data, secret, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
  const reply = UrlFetchApp.fetch(ANDRO_SYNC.url, {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: { 'X-ANDRO-Sheets-Signature': 'sha256=' + digest },
    payload: data,
    followRedirects: false,
    muteHttpExceptions: true
  });
  const status = reply.getResponseCode();
  let result = {};
  try { result = JSON.parse(reply.getContentText()); } catch (_) {}
  if (status !== 422 || result.error !== 'terms_acknowledgement_not_captured')
    throw new Error('Connection check did not pass (HTTP ' + status + '). Keep sync disabled.');
  Logger.log('SIGNED CONNECTION PASSED: expected HTTP 422; secret, form ID, submission time and database checks passed. No entry created.');
}

function androPhone_(value) {
  return String(value || '').trim().replace(/^p:/i, '').trim();
}

/** Run ONLY after legal review, a real consent column and backend connection. */
function androInstallFiveMinuteTrigger() {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === 'androSyncLeads') ScriptApp.deleteTrigger(trigger);
  }
  ScriptApp.newTrigger('androSyncLeads').timeBased().everyMinutes(5).create();
}

function androNormalize_(value) {
  return String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function androAffirmative_(value) {
  return ['yes', 'true', '1', 'i_agree', 'agreed'].includes(androNormalize_(value));
}
