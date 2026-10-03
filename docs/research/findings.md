| Date | Milestone | Finding | Action |
|---|---|---|---|
| 2026-10-03 | M0 | Vercel CLI has no credentials, so production deploy did not run | Aiden logs in, then runs `npx vercel link` and `npx vercel deploy --prod` |
| 2026-10-03 | M1 | Production URL and server XAI_API_KEY are missing, so token checks 2 and 3 did not run | Aiden records the production URL in docs/research/deploy.md and sets the server key, then re-runs those curls |
