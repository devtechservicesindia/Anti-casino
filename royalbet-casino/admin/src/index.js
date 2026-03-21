// admin/src/index.js – Admin dashboard entry (scaffold)
// The admin dashboard is a separate React + Vite app running on port 5174.
// It shares the same design system (TailwindCSS gold/dark palette) as the
// main frontend but has its own routing and API client.
//
// Planned admin sections:
//   /admin/dashboard  – KPI cards, revenue charts (Recharts), live stats
//   /admin/users      – user list, verification, ban/suspend actions
//   /admin/games      – game config, RTP settings, enable/disable
//   /admin/payments   – deposit/withdrawal approval queue
//   /admin/audit-log  – immutable log of admin actions
