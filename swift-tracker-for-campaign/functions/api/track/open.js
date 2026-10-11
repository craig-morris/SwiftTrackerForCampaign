// Open tracking pixel — logs open + host domain for per-domain analytics
import { notify } from '../../_utils/telegram.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const trackingId = url.searchParams.get('tid') || 'unknown';
  const recipient = url.searchParams.get('email') || url.searchParams.get('r') || 'unknown';
  const subject = url.searchParams.get('subject') || url.searchParams.get('s') || 'untitled';

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const country = request.headers.get('CF-IPCountry') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  const language = (request.headers.get('Accept-Language') || 'unknown').split(',')[0];
  const trackedDomain = `https://${url.host}`;

  // Dedup: one open per tracking_id + IP per hour
  const existing = await env.DB.prepare(
    `SELECT id FROM email_events
     WHERE tracking_id = ? AND ip = ? AND event_type = 'open'
       AND created_at > datetime('now','-1 hour')`
  ).bind(trackingId, ip).first();

  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO email_events
        (tracking_id, event_type, recipient_email, campaign_subject,
         ip, country, user_agent, language, tracked_domain)
       VALUES (?, 'open', ?, ?, ?, ?, ?, ?, ?)`
    ).bind(trackingId, recipient, subject, ip, country, userAgent, language, trackedDomain).run();

    await notify(env,
      `📬 *Email Opened*\n` +
      `👤 ${recipient}\n` +
      `📧 ${subject}\n` +
      `🌍 ${country} | IP: ${ip}\n` +
      `🔗 ${trackedDomain}`
    );
  }

  return new Response(
    atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
    {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }
  );
}