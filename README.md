# MarketingMind AI MVP

A deploy-ready, dependency-free MVP for a modular local-business marketing workspace. The included demo workspace is **Studio Salvadore Salon & Spa**.

## Included

- Dashboard with marketing health and activity
- Editable business profile (saved in browser storage)
- Multilingual local content generator with editable drafts, planner save, and scheduling
- Social scheduling queue with edit, reschedule, status and delete controls
- Basic SEO audit and Google Business/local SEO checklist
- Google review-request generator using the saved business review URL
- CRM leads with live pipeline metrics, status updates and local record management
- Appointment booking, confirmation/completion states, expected value and optional CRM capture
- Analytics overview with GA4 and Looker Studio placeholders
- Interactive charts and scenario-based lead/revenue predictions with CSV export
- Local CSV import (`month, leads, revenue, visits`) with validation and trend regression
- Combined technical and fundamental scoring for adjusted business forecasts
- Dynamic local credit/API usage history with free-first guardrails
- Responsive layout for desktop, tablet, and mobile
- Installable PWA with branded icon and offline app-shell support

This is a front-end MVP. Demo data and user edits are stored in `localStorage`; no customer data is sent anywhere. Provider connections are explicitly marked as placeholders.

## Run locally

No package installation is required. Open `index.html` directly, or use any static server:

```bash
npx serve .
```

Then open the local URL shown in the terminal.

## Deploy on Cloudflare Pages (recommended free-first route)

1. Create a private GitHub repository and upload these files to its root.
2. In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repository.
4. Choose **None** for framework preset, leave the build command blank, and set the output directory to `/`.
5. Deploy. Add a custom domain from the Pages project when ready.

## Deploy on GitHub Pages

1. Push these files to a repository.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**, select the main branch and `/ (root)`, then save.

## Production roadmap

Workspace data is currently stored in the browser. Use **Business settings → Export backup** to download a portable JSON copy, and **Import backup** to restore it on another browser or device.

The CRM can import and export lead CSV files for Excel or Google Sheets. Appointments can also be exported as CSV for daily operations and reporting.
Lead records support phone numbers, dated follow-ups, notes, pipeline status, source, and service interest.

1. Add authentication and a database (Supabase free tier is a practical fit).
2. Move business, leads, appointments, and posts from browser storage to the database.
3. Add server-side endpoints for AI providers so API keys are never exposed in the browser.
4. Connect Meta, Google Business Profile, and calendar APIs using OAuth.
5. Add a URL crawler for live SEO audits.
6. Connect GA4 Data API and embed a Looker Studio report.
7. Add roles, consent records, audit logs, backups, and rate limits before real customer use.

## Optional Supabase backend starter

`supabase/schema.sql` creates an authentication-ready database for workspaces, leads, appointments, posts, usage events, and historical forecast points. It enables Row Level Security so authenticated users can access only workspaces they own. Run it in a new Supabase project's SQL editor, then connect the frontend through server-side or authenticated API code. Never place a Supabase service-role key in browser files.

## Cloudflare Pages Function

`functions/api/health.js` provides a same-origin `GET /api/health` endpoint on Cloudflare Pages. It returns application, version, runtime, environment, and timestamp data with no-store and nosniff headers. Use this endpoint as the health check for future authenticated Supabase and AI API routes.

`functions/api/integrations.js` provides `GET /api/integrations`. It reports only whether the required server environment variables are present; it never returns credentials. The Business Settings screen uses it for the live Integration Readiness card.

## Files

- `index.html` — accessible app shell and page metadata
- `styles.css` — responsive visual system
- `app.js` — modules, demo data, interactions, and browser persistence

## Important security note

Do not place real API keys in `app.js`. Use a serverless function or backend secret store for production integrations.

