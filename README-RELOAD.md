# Full reload

## Database (Supabase → SQL Editor)
Run the files in `supabase/` in order, each in a new query tab:

| Step | File | What it does |
|---|---|---|
| 0 | 00_schema.sql | Drops and recreates every table (all existing data is removed) |
| 1 | 01_items.sql | 37 gas-blend items with BOM standards and corrections; 8 non-gas items flagged |
| 2 | 02_production_runs.sql | All production runs 8/24–9/19, both lines |
| 3 | 03_gas_readings.sql | Blend meter totalizers, C and D, 8/24–9/20 (large paste) |
| 4 | 04_filler_readings.sql | Filler cans/min |
| 5 | 05_filler_downtime.sql | Filler current-downtime minutes |
| 6 | 06_gas_weight_checks.sql | Paperwork gas weight checks, C Line 8/31–9/2 |
| 7 | 07_gas_events.sql | Confirmed gas-open events with causes |

If the editor rejects step 3 for size, split it at the second `insert into` line and run the two halves separately.

## Site (GitHub)
Upload `index.html`, `app.js`, `styles.css` over the existing files (keep your `config.js`), then hard-refresh.
