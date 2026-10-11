// Core domain resolution + rotation logic (D1-driven)
//
// Design:
//   - Active domain lives in D1 as tracking_domains.active = 1
//   - Every request reads it (single indexed row, cheap)
//   - Rotation flips the flag in D1 — takes effect immediately
//   - Spam / down domains are skipped during rotation
//   - Falls back to env.TRACKING_BASE_URL if D1 is empty

export async function getActiveDomain(env) {
  const row = await env.DB.prepare(
    `SELECT id, domain, status FROM tracking_domains
     WHERE active = 1 AND status IN ('healthy','spam','down')
     LIMIT 1`
  ).first();

  if (row) return row;

  // Bootstrap fallback
  const fallback = env.TRACKING_BASE_URL || env.FALLBACK_DOMAIN || null;
  return fallback ? { id: null, domain: fallback, status: 'unknown' } : null;
}

export async function getNextHealthyDomain(env, currentId) {
  return await env.DB.prepare(
    `SELECT id, domain FROM tracking_domains
     WHERE active = 0
       AND status = 'healthy'
       AND id != COALESCE(?, -1)
     ORDER BY priority ASC, id ASC
     LIMIT 1`
  ).bind(currentId ?? null).first();
}

export async function rotateDomain(env, reason = 'auto') {
  const current = await env.DB.prepare(
    `SELECT id, domain FROM tracking_domains WHERE active = 1 LIMIT 1`
  ).first();

  const next = await getNextHealthyDomain(env, current?.id);

  if (!next) {
    return {
      rotated: false,
      error: 'No healthy fallback domain available',
      current: current?.domain || null
    };
  }

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE tracking_domains SET active = 0 WHERE id = ?`
    ).bind(current?.id ?? -1),
    env.DB.prepare(
      `UPDATE tracking_domains SET active = 1 WHERE id = ?`
    ).bind(next.id),
    env.DB.prepare(
      `INSERT INTO domain_rotations (old_domain, new_domain, reason)
       VALUES (?, ?, ?)`
    ).bind(current?.domain || 'unknown', next.domain, reason)
  ]);

  return {
    rotated: true,
    oldDomain: current?.domain || 'unknown',
    newDomain: next.domain,
    newDomainId: next.id,
    reason
  };
}

export async function markDomainStatus(env, domainId, status) {
  await env.DB.prepare(
    `UPDATE tracking_domains
     SET status = ?, last_checked = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(status, domainId).run();
}

export async function markDomainSpam(env, domainId) {
  await env.DB.prepare(
    `UPDATE tracking_domains
     SET status = 'spam', last_spam_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(domainId).run();
}

// Recover domains that have been in spam cool-down > recoveryHours
export async function recoverStaleSpamDomains(env, recoveryHours = 24) {
  const result = await env.DB.prepare(
    `UPDATE tracking_domains
     SET status = 'healthy'
     WHERE status = 'spam'
       AND last_spam_at < datetime('now', ?)`
  ).bind(`-${recoveryHours} hours`).run();

  return result.meta?.changes || 0;
}

// Resolve which domain_id an incoming request came from, based on Host header
export async function resolveDomainIdFromHost(env, host) {
  if (!host) return null;
  const baseUrl = `https://${host}`;
  const row = await env.DB.prepare(
    `SELECT id FROM tracking_domains WHERE domain = ? LIMIT 1`
  ).bind(baseUrl).first();
  return row?.id || null;
}