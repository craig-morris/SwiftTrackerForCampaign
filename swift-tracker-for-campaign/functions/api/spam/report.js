// Spam report → marks domain spam, counts reports, auto-rotates if threshold exceeded.
import { markDomainSpam, rotateDomain, resolveDomainIdFromHost } from '../../_utils/domains.js';
import { notify } from '../../_utils/telegram.js';
import { jsonResponse } from '../../_utils/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  let body = {};
  try { body = await request.json(); } catch {
    body = {
      trackingUrl: url.searchParams.get('url'),
      reason: url.searchParams.get('reason'),
      reportedBy: url.searchParams.get('reporter')
    };
  }

  const host = request.headers.get('Host') || '';
  const trackingUrl = body.trackingUrl || `https://${host}` || env.TRACKING_BASE_URL || 'unknown';
  const reason = body.reason || 'unspecified';
  const reportedBy = body.reportedBy || 'anonymous';

  // Resolve the domain row (used for status + rotation)
  const domainId = await resolveDomainIdFromHost(env, host);
  const domainRow = domainId
    ? await env.DB.prepare(`SELECT * FROM tracking_domains WHERE id = ?`).bind(domainId).first()
    : null;

  // Log report
  await env.DB.prepare(
    `INSERT INTO link_health (tracking_url, domain_id, status, reported_by, report_reason)
     VALUES (?, ?, 'spam', ?, ?)`
  ).bind(trackingUrl, domainId, reportedBy, reason).run();

  // Count reports in last 24h for this domain
  const spamCount = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM link_health
     WHERE tracking_url = ? AND status = 'spam'
       AND created_at > datetime('now','-24 hours')`
  ).bind(trackingUrl).first();

  const threshold = parseInt(env.SPAM_THRESHOLD || '1');
  const count = spamCount?.count || 0;

  // Mark domain as spam in the pool
  if (domainId) await markDomainSpam(env, domainId);

  // Threshold crossed → rotate
  if (count > threshold && domainRow?.active) {
    const result = await rotateDomain(env, `spam threshold exceeded (${count} reports)`);

    if (result.rotated) {
      await notify(env,
        `🔄 *Auto-Rotated (Spam)*\n` +
        `❌ Old: ${result.oldDomain}\n` +
        `✅ New: ${result.newDomain}\n` +
        `📊 Reports: ${count}/${threshold}\n\n` +
        `New emails now use *${result.newDomain}*.`
      );
      return jsonResponse({
        success: true,
        spamCount: count,
        threshold,
        rotated: true,
        newDomain: result.newDomain
      });
    }

    await notify(env,
      `🚨 *ROTATION FAILED*\n` +
      `📊 ${count} spam reports but no healthy fallback.\n` +
      `⚠️ Add a new domain to the pool ASAP.`
    );
  }

  await notify(env,
    `⚠️ *Spam Report*\n` +
    `🔗 ${trackingUrl}\n` +
    `📝 ${reason}\n` +
    `👤 ${reportedBy}\n` +
    `📊 ${count}/${threshold} threshold`
  );

  return jsonResponse({
    success: true,
    spamCount: count,
    threshold,
    rotated: false
  });
}