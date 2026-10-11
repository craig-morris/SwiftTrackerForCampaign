// Click redirect — logs click + host domain, then redirects
import { notify } from '../../_utils/telegram.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const trackingId = url.searchParams.get('tid') || 'unknown';
  const recipient = url.searchParams.get('email') || url.searchParams.get('r') || 'unknown';
  const subject = url.searchParams.get('subject') || url.searchParams.get('s') || 'untitled';
  const destination = url.searchParams.get('url') || url.searchParams.get('u') || 'https://example.com';

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const country = request.headers.get('CF-IPCountry') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  const language = (request.headers.get('Accept-Language') || 'unknown').split(',')[0];
  const trackedDomain = `https://${url.host}`;

  // Validate destination
  let safeDestination = 'https://example.com';
  try {
    const destUrl = new URL(destination);
    if (destUrl.protocol === 'http:' || destUrl.protocol === 'https:') {
      safeDestination = destination;
    }
  } catch {}

  await env.DB.prepare(
    `INSERT INTO email_events
      (tracking_id, event_type, recipient_email, campaign_subject,
       destination_url, ip, country, user_agent, language, tracked_domain)
     VALUES (?, 'click', ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(trackingId, recipient, subject, safeDestination, ip, country, userAgent, language, trackedDomain).run();

  await notify(env,
    `🔗 *Link Clicked*\n` +
    `👤 ${recipient}\n` +
    `📧 ${subject}\n` +
    `🎯 ${safeDestination}\n` +
    `🌍 ${country} | IP: ${ip}\n` +
    `🔗 ${trackedDomain}`
  );

  return Response.redirect(safeDestination, 302);
}