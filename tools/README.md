# tools

`pipeline.bin` is the encrypted build pipeline behind the locked scorecard pages (`supplier-quality.html`,
`component-scorecard.html`, `logs.html`). It is refreshed daily by a scheduled task that reads the complaint log and
the QA hold and defective log from Don's computer. Unpack it with `bundle.py` and the key from Supabase
(`public.page_keys`, admin only); the runbook inside explains the rest.
