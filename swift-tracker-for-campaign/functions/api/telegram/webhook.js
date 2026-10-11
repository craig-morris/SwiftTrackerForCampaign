// Telegram Webhook - Receives commands from Telegram bot
export async function onRequestPost(context) {
  const { request, env } = context;

  // Verify webhook secret
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const message = update.message;
  if (!message || !message.text) {
    return new Response('OK', { status: 200 });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();
  const botToken = env.TELEGRAM_BOT_TOKEN;

  // Handle commands
  if (text === '/start') {
    await sendMessage(botToken, chatId,
      `🚀 *SwiftTrackerForCampaign*\n\n` +
      `Available commands:\n` +
      `/stats - Campaign statistics\n` +
      `/health - Link health status\n` +
      `/recent - Recent events\n` +
      `/unsubs - Recent unsubscribes`
    );
  } else if (text === '/stats') {
    const totals = await env.DB.prepare(
      `SELECT event_type, COUNT(*) as count FROM email_events GROUP BY event_type`
    ).all();

    const opens = totals.results.find(r => r.event_type === 'open')?.count || 0;
    const clicks = totals.results.find(r => r.event_type === 'click')?.count || 0;
    const unsubs = totals.results.find(r => r.event_type === 'unsubscribe')?.count || 0;

    await sendMessage(botToken, chatId,
      `📊 *Campaign Stats*\n` +
      `📬 Opens: ${opens}\n` +
      `🔗 Clicks: ${clicks}\n` +
      `🚫 Unsubscribes: ${unsubs}`
    );
  } else if (text === '/health') {
    const health = await env.DB.prepare(
      `SELECT status, COUNT(*) as count FROM link_health 
       WHERE created_at > datetime('now', '-24 hours') 
       GROUP BY status`
    ).all();

    let healthText = `🏥 *Link Health (24h)*\n`;
    for (const h of health.results) {
      const emoji = h.status === 'healthy' ? '✅' : h.status === 'spam' ? '⚠️' : '❌';
      healthText += `${emoji} ${h.status}: ${h.count}\n`;
    }

    await sendMessage(botToken, chatId, healthText);
  } else if (text === '/recent') {
    const events = await env.DB.prepare(
      `SELECT event_type, recipient_email, campaign_subject, created_at 
       FROM email_events ORDER BY created_at DESC LIMIT 5`
    ).all();

    let recentText = `📋 *Recent Events*\n`;
    for (const e of events.results) {
      const emoji = e.event_type === 'open' ? '📬' : e.event_type === 'click' ? '🔗' : '🚫';
      recentText += `${emoji} ${e.recipient_email || 'unknown'} - ${e.campaign_subject || 'untitled'}\n`;
    }

    await sendMessage(botToken, chatId, recentText);
  } else if (text === '/unsubs') {
    const unsubs = await env.DB.prepare(
      `SELECT email, unsubscribed_at FROM unsubscribes ORDER BY unsubscribed_at DESC LIMIT 5`
    ).all();

    let unsubText = `🚫 *Recent Unsubscribes*\n`;
    for (const u of unsubs.results) {
      unsubText += `👤 ${u.email} - ${u.unsubscribed_at}\n`;
    }

    await sendMessage(botToken, chatId, unsubText);
  }

  return new Response('OK', { status: 200 });
}

async function sendMessage(botToken, chatId, text) {
  if (!botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    })
  });
}