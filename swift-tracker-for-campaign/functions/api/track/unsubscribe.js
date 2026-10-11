// Unsubscribe — logs, suppresses, confirms
import { notify } from '../../_utils/telegram.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const trackingId = url.searchParams.get('tid') || 'unknown';
  const email = url.searchParams.get('email') || url.searchParams.get('e') || '';
  const subject = url.searchParams.get('subject') || url.searchParams.get('s') || 'untitled';

  if (!email) return new Response('Missing email parameter', { status: 400 });

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const country = request.headers.get('CF-IPCountry') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  const trackedDomain = `https://${url.host}`;

  await env.DB.prepare(
    `INSERT INTO email_events
      (tracking_id, event_type, recipient_email, campaign_subject,
       ip, country, user_agent, tracked_domain)
     VALUES (?, 'unsubscribe', ?, ?, ?, ?, ?, ?)`
  ).bind(trackingId, email, subject, ip, country, userAgent, trackedDomain).run();

  await env.DB.prepare(
    `INSERT OR IGNORE INTO unsubscribes (email, tracking_id) VALUES (?, ?)`
  ).bind(email, trackingId).run();

  await notify(env,
    `🚫 *Unsubscribe*\n` +
    `👤 ${email}\n` +
    `📧 ${subject}`
  );

  return new Response(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Unsubscribed — SwiftTracker</title>
      <link rel="icon" href="/favicon.svg" type="image/svg+xml">
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div class="confirm-page">
        <div class="confirm-card">
          <svg class="confirm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <h1>You've been unsubscribed</h1>
          <p>We're sorry to see you go, <strong>${escapeHtml(email)}</strong>.</p>
          <p class="subtext">You will no longer receive emails from this campaign.</p>
          <a href="/" class="btn btn-primary">Return to Home</a>
        </div>
      </div>
    </body>
    </html>
  `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}