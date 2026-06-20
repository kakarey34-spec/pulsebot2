# Pulse Bot 2

Discord bot for **Pulse Studios** — multi-option tickets, shop, giveaways, security, and logging. Uses **Discord Components v2** and **JSON file storage** (no database).

Made By LyxosDime

---

## Features

- **Ticket panel** — Purchase, Support, Partner with live active counters
- **Payments** — PayPal (configurable email/instructions) and PaySafe (auto tier rounding: €5, €10, €25, €50, €100)
- **Promo codes** — Discount-only vouchers for purchase tickets
- **Shop** — Sellers post products with images and descriptions
- **Giveaways** — Timed giveaways with button entry
- **Reviews** — `/rep` modal in the rep channel
- **Suggestions** — Auto ✅ / ❌ reactions in the suggestion channel
- **Anti-nuke** — Mass delete/ban protection with security logs
- **Anti-link** — Blocks links from non-staff with logging
- **Logging** — Member, channel, role, voice, moderation, commands, security, server, tickets
- **Moderation** — ban, kick, mute, unmute, clear, say

---

## Full tutorial: Deploy on Render

### 1. Create the Discord bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → name it (e.g. Pulse Bot).
2. Open **Bot** → **Reset Token** → copy the token (you will need it as `DISCORD_TOKEN`).
3. Enable **Privileged Gateway Intents**:
   - Server Members Intent
   - Message Content Intent
4. Under **Bot** → set **About Me** to: `Made By LyxosDime` (this is the bot bio — not settable via code).
5. Copy **Application ID** from **General Information** → use as `CLIENT_ID`.
6. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: Administrator (or at minimum: Manage Channels, Manage Roles, Ban/Kick/Timeout, Read/Send Messages, Attach Files, Embed Links, Use Slash Commands, Manage Messages, View Audit Log, Connect)
7. Open the generated invite URL and add the bot to your server.

### 2. Push this repo to GitHub

If you cloned from GitHub as `pulsebot2`, skip to step 3.

```bash
cd pulsebot2
git init
git add .
git commit -m "Initial Pulse Studios bot"
gh repo create pulsebot2 --public --source=. --push
```

### 3. Create a Render Web Service

1. Sign in at [render.com](https://render.com) → **New +** → **Web Service**.
2. Connect your GitHub account and select the **pulsebot2** repository.
3. Settings:

| Field | Value |
|--------|--------|
| **Name** | `pulsebot2` (or any name) |
| **Region** | Closest to your users |
| **Branch** | `main` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance type** | Free works for small servers |

4. **Environment variables** (Environment tab):

| Key | Value |
|-----|--------|
| `DISCORD_TOKEN` | Your bot token |
| `CLIENT_ID` | Application ID |
| `GUILD_ID` | Your Discord server ID (recommended for instant slash command updates) |
| `PORT` | `3000` (Render sets this automatically; optional) |

5. **Persistent disk (important — keeps JSON data across deploys)**:
   - Go to **Disks** → **Add Disk**
   - **Mount path:** `/opt/render/project/src/data` if root is repo root, OR mount at `data` relative path
   - For this project, mount disk at: **`/opt/render/project/src/pulsebot2/data`** if deploying from monorepo, or **`/opt/render/project/src/data`** if repo root is `pulsebot2`
   - **Size:** 1 GB is enough
   - Save and redeploy

   > Without a persistent disk, ticket/giveaway/promo JSON resets on every deploy.

6. Click **Create Web Service** and wait for deploy. Logs should show `Logged in as YourBot#1234`.

7. Health check: open `https://your-service.onrender.com/health` — should return `{"status":"ok",...}`.

### 4. First-time server setup

Run these slash commands in Discord (owner role required for `/config`):

```
/config ticket-category type:Purchase category:<your-purchase-category>
/config ticket-category type:Support category:<your-support-category>
/config ticket-category type:Partner category:<your-partner-category>
/config channel key:shop channel:<shop-channel>
/config channel key:promo channel:<promo-announce-channel>   (optional)
/config paypal email:you@paypal.com instructions:Send exact amount with Discord name in note
/config paysafe instructions:Buy a PaySafe card for the tier shown and send the code here
/ticket panel
```

Default log channel IDs are pre-configured in `src/config/defaults.js`. Override any with `/config channel key:<name> channel:<#channel>`.

### 5. Role setup

Assign these roles in your server (IDs are in defaults):

| Role | ID |
|------|-----|
| Owner | `1517510292526075925` |
| Mod | `1517887427300036628` |
| Seller | `1517887595638558830` |

- **Owner** — `/config`, full control
- **Mod** — moderation, giveaways, promos, ticket staff actions
- **Seller** — `/product add` to post shop items

### 6. Using the bot day-to-day

| Task | Command / action |
|------|------------------|
| Open tickets | Users click panel buttons (Purchase / Support / Partner) |
| Post shop item | `/product add name:... description:... price:€25 image:<attachment>` |
| Create discount | `/promo create code:SAVE10 discount:10 channel:#promo` |
| Start giveaway | `/giveaway start title:... prize:... duration:1d` |
| Leave review | `/rep` in rep channel |
| Suggestions | Post in suggestion channel → bot adds ✅ ❌ |
| Staff close ticket | Close button in ticket or `/ticket close` |

### 7. Local development

```bash
cp .env.example .env
# Edit .env with your token and IDs
npm install
npm run dev
```

Data is stored in `data/*.json`.

### 8. Troubleshooting

| Issue | Fix |
|-------|-----|
| Slash commands missing | Set `GUILD_ID` and redeploy; wait ~1 min |
| Bot offline on free tier | Render free services sleep after inactivity; first request wakes them |
| Data lost after deploy | Add Render persistent disk mounted to `data/` |
| Panel not updating counters | Re-run `/ticket panel`; old message IDs are tracked in JSON |
| Anti-nuke false positives | Owner/mod/seller roles are whitelisted automatically |

---

## Tech stack

- Node.js 18+
- discord.js 14.19+ (Components v2)
- JSON persistence in `data/`

## License

MIT
