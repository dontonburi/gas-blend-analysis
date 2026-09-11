# C Line gas log

A small website for recording production runs, meter readings, and gas weight checks on the C Line, and seeing blended-gas consumption and waste factor per shift. Hosted free on GitHub Pages; data stored in Supabase (Postgres) so it can be exported any time.

## What's in here

| File | Purpose |
|---|---|
| `index.html`, `styles.css`, `app.js` | The website. No build step. |
| `config.example.js` | Template for your Supabase keys. Copy to `config.js`. |
| `supabase/schema.sql` | Creates the tables and locks them to signed-in users. Run once. |
| `supabase/seed.sql` | Loads the 27 blended-gas items, 9/1–9/2/2026 production, 3,800 meter readings and 484 gas-weight-check rows. Run once, after schema. |

## Setup (about 15 minutes)

### 1. Supabase
1. Go to https://supabase.com, create a free account, then **New project**. Pick a name, a database password (save it), and the region closest to you.
2. Once the project is ready, open **SQL Editor** → **New query**. Paste the whole of `supabase/schema.sql` and click **Run**.
3. New query again: paste `supabase/seed.sql` and **Run**. (It's a large paste; it takes a few seconds.)
4. **Authentication → Users → Add user → Create new user.** Enter your email and a password, tick *Auto Confirm User*. This is your login for the site.
5. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up" so nobody else can create an account.
6. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
7. Note the email you used for the user — it goes in `config.js` as `LOGIN_EMAIL`. The site asks only for the password.

### 2. The site
1. Copy `config.example.js` to `config.js` and paste in the URL and anon key.
2. Create a free account at https://github.com and a **New repository** (public, any name, e.g. `c-line-gas-log`).
3. Upload every file in this folder to the repository (drag-and-drop on the repo page works). Include `config.js` — the anon key is designed to be public; row-level security keeps the data private.
4. In the repo: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save.**
5. After a minute, the site is live at `https://YOUR-USERNAME.github.io/c-line-gas-log/`. Sign in with the user you created in step 1.4.

### 3. Supabase → allow the site
**Authentication → URL Configuration → Site URL**: set it to your GitHub Pages address. Not strictly required for password sign-in, but keeps things tidy.

## Password
The site asks for a password before showing anything. This is a simple front-door check in the browser; the database itself is open to the site (`supabase/allow_anon.sql`), so treat the password as a courtesy lock rather than real security.

## Using it

- **Production runs** — date, shift, item (optional), cases. Several items in one shift are fine; add a row per item.
- **Meter readings** — paste the totalizer export (timestamp, N₂O scf, N₂ scf). Duplicate timestamps are skipped, so re-pasting overlapping ranges is safe.
- **Gas weight checks** — one row per head from the paper form. The form keeps date/gasser/time and advances the head number after each save so a sheet takes about two minutes.
- **Items** — per-item N₂O ratio (by volume) and target gas per can. Leave blank to use the defaults in Settings.
- **Dashboard** — gas per shift is read off the totalizers at the shift boundaries (07:00 / 15:00 / 23:00), converted to lb, and compared with cans × target g. Waste factor = metered ÷ target.
- **Export CSV** on every page. You can also export any table from Supabase → Table Editor, or take a full database backup from Supabase → Database → Backups.

## Changing the maths
Densities, default ratio and default target fill are constants at the top of `app.js` (`D`, `DEFAULT_RATIO_VOL`, `DEFAULT_TARGET_G`), as are shift start hours (`SHIFT_START`). The site password is stored as a SHA-256 hash (`PASSWORD_HASH`); to change it, hash the new password and replace that value.

## Timezone note
Meter timestamps are stored with the timezone they were entered in and shifts are calculated in the browser's local time. Keep using the site from the plant's timezone (Eastern) and everything lines up.
