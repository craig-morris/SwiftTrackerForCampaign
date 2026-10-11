// GET /api/domain/current
// Public endpoint your email sender calls to get the active tracking domain.
// Returns { domain, domainId } — build your tracking URLs against this.
import { getActiveDomain } from '../../_utils/domains.js';
import { jsonResponse } from '../../_utils/auth.js';

export async function onRequestGet(context) {
  const { env } = context;
  const active = await getActiveDomain(env);

  if (!active) {
    return jsonResponse({ error: 'No active tracking domain configured' }, 503);
  }

  return jsonResponse({
    domain: active.domain,
    domainId: active.id,
    status: active.status
  });
}