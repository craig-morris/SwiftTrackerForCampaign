# SwiftTrackerForCampaign

🚀 First-Time Deployment: The Complete Guide
1. Prerequisites
Before you begin, make sure you have:

Node.js and npm installed on your computer.

A Cloudflare account. If you don't have one, you can sign up for free.

A domain name that you want to use for tracking (e.g., yourdomain.com).

2. Install Wrangler and Log In
Wrangler is Cloudflare's command-line tool. Open your terminal in the project directory and run these commands:

bash
# Install Wrangler locally as a dev dependency
npm install wrangler --save-dev

# Log in to your Cloudflare account (this will open a browser window)
npx wrangler login

3. Create Your D1 Database
This is where all your tracking data will be stored.

bash
npx wrangler d1 create swift_tracker_db
After running this, Wrangler will output important information. Copy the database_id from the output. You will need it in the next step.

4. Update wrangler.toml
Open the wrangler.toml file in your project and replace the placeholder YOUR_D1_DATABASE_ID with the database_id you just copied.

toml
[[d1_databases]]
binding = "DB"
database_name = "swift_tracker_db"
database_id = "PASTE_YOUR_DATABASE_ID_HERE" # <-- Update this line

5. Set Up Custom Domains (CRITICAL)
This step is non-negotiable for real domain rotation. You need to add each tracking subdomain to your Cloudflare Pages project so they all serve your tracking app.

Log in to your Cloudflare dashboard.

Go to Workers & Pages and select your Pages project.

Go to the Custom domains tab.

Click Set up a custom domain.

Enter your first tracking subdomain, for example, track1.yourdomain.com, and click Continue.

Repeat this process for all the subdomains you plan to use (e.g., track2.yourdomain.com, track3.yourdomain.com, etc.).

Cloudflare will automatically create the necessary DNS records for you. If you want to add more domains later, just repeat these steps.

6. Configure Environment Secrets
These are sensitive values your application needs at runtime. You will be prompted to enter the value for each secret in your terminal.

bash
# Your Telegram Bot Token (from BotFather)
npx wrangler pages secret put TELEGRAM_BOT_TOKEN

# The Chat ID where you want to receive notifications
npx wrangler pages secret put TELEGRAM_CHAT_ID

# A secret token to secure your Telegram webhook
npx wrangler pages secret put TELEGRAM_WEBHOOK_SECRET

# The SHA-256 hash of your admin dashboard password
npx wrangler pages secret put ADMIN_PASSWORD_HASH
Important: Secrets are bound at deploy time. You must set them before running your first deployment for them to be available to your application.

How to generate your ADMIN_PASSWORD_HASH:
Run this command in your terminal, replacing your-password with your desired password:

bash
echo -n "your-password" | shasum -a 256
7. Initialize the Database Schema
Apply your schema.sql file to the remote D1 database to create the necessary tables.

bash
npx wrangler d1 execute swift_tracker_db --file=schema.sql --remote
This command reads your schema file and executes it against the live database.

8. Deploy to Cloudflare Pages
You are now ready for your first deployment! This command will create your project and upload your assets.

bash
npx wrangler pages deploy public --project-name swift-tracker-for-campaign
Wrangler will prompt you to create a new project and specify a production branch (you can just use main). Once deployed, your project will be live at https://swift-tracker-for-campaign.pages.dev. Your custom domains will be active shortly after.

🔄 How to Deploy Updates
For any future changes you make to the code, you only need to run the deploy command again:

bash
npx wrangler pages deploy public --project-name swift-tracker-for-campaign
🐛 Troubleshooting Common Issues
"Secret not found" errors: Make sure you've run all the wrangler pages secret put commands before deploying. Remember that secrets are bound to a specific deployment.

Database errors: Double-check that you've correctly replaced the YOUR_D1_DATABASE_ID in your wrangler.toml file and that you've run the schema initialization step.

Domain rotation not working: Ensure you have added all your tracking subdomains in the Cloudflare Pages dashboard under "Custom domains". Rotation relies on having multiple domains configured.
===========================================

Email tracking framework for transactional emails, built on Cloudflare Pages.

## Features

- 📬 **Open Tracking** — Invisible 1×1 pixel with IP, country, device, timestamp
- 🔗 **Click Tracking** — Automatic link wrapping with redirect logging
- 🚫 **Unsubscribe Management** — One-click unsubscribe with suppression list
- 🛡️ **Spam Protection** — Health checks, spam reports, auto domain rotation
- 📱 **Telegram Alerts** — Real-time notifications via bot
- 🌍 **Edge-Deployed** — Cloudflare Pages + D1 database
- 🔒 **Admin Dashboard** — Session-based auth, responsive UI
- 🌐 **Firewall Rules** — Country blocking, user-agent filtering

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo>
cd swift-tracker-for-campaign
npm install


======================================
2. Create D1 database
bash
npx wrangler d1 create swift_tracker_db
Copy the database_id into wrangler.toml.

3. Run migrations
bash
npx wrangler d1 execute swift_tracker_db --file=schema.sql --remote

4. Set environment variables
bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET

# Generate ADMIN_PASSWORD_HASH with:

bash
echo -n "your-password" | shasum -a 256


5. Deploy
bash
npx wrangler pages deploy public


# Usage

Tracking Pixel
html
<img src="https://track.yourdomain.com/api/track/open?tid=ORDER123&email=customer@example.com&subject=Your+Order" width="1" height="1" />


Link Tracking
html
<a href="https://track.yourdomain.com/api/track/click?tid=ORDER123&email=customer@example.com&url=https://yoursite.com/offer">View Offer</a>


Unsubscribe
html
<a href="https://track.yourdomain.com/api/track/unsubscribe?tid=ORDER123&email=customer@example.com">Unsubscribe</a>


#Insight for framework

Telegram Bot Commands
Command	Description
/start	Show available commands
/stats	Campaign statistics
/health	Link health status
/recent	Recent events
/unsubs	Recent unsubscribes


Architecture
text
Email → Tracking Pixel/Click → Cloudflare Worker → D1 Database
                                              ↓
                                    Telegram Notification
                                              ↓
                                    Dashboard (Cloudflare Pages)


License
MIT

text

---

## Bug Check Summary

| Area | Potential Issue | Fix Applied |
|------|----------------|-------------|
| **Open tracking** | Bot opens inflate metrics | 1-hour dedup per tracking_id + IP |
| **Click redirect** | Open redirect vulnerability | URL validation (only http/https) |
| **Unsubscribe** | SQL injection via email | Parameterized queries throughout |
| **Session auth** | Session fixation | Random UUID + HttpOnly/Secure cookies |
| **Firewall** | Blocked bots break pixels | Returns valid GIF for `/open` even when blocked |
| **Spam rotation** | Race condition on threshold | Atomic count query before rotation |
| **Domain rotation** | No persistence across workers | Logged in D1; manual propagation needed |
| **CORS** | Cross-origin tracking requests | Middleware handles headers |
| **Responsive table** | Horizontal overflow | `overflow-x: auto` + `min-width` on table |
| **Search debounce** | Excessive API calls | 400ms debounce on input |
| **Pagination** | Edge case: page > totalPages | Server clamps via LIMIT/OFFSET |
| **Telegram webhook** | Unauthorized access | Secret token verification |
| **Health check** | Timeout on slow requests | AbortSignal.timeout(10000) |
| **D1 binding** | Missing database_id in config | Documented in README |
| **ADMIN_PASSWORD_HASH** | Plaintext fallback | SHA-256 comparison only |

---

**SwiftTrackerForCampaign** is now complete. Deploy it to Cloudflare Pages, create your D1 database, set your secrets, and start tracking. The framework handles opens, clicks, unsubscribes, spam reports, health checks, domain rotation, and Telegram notifications — all from the edge, with a responsive human-designed UI.