# Still Here

A memento mori app with a personal goal planner. Enter your birthdate to see how many days you have left, then track your own 30-day or year-long systems one day at a time.

Built with Next.js, Tailwind CSS, shadcn/ui, and optional Supabase sync.

## Development

```bash
npm install
npm run dev
```

## Supabase setup

The app works in local-only mode by default. To enable login and cross-device sync:

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Fill in:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```

4. Run the SQL in:

   ```bash
   supabase/migrations/20260406_user_settings_and_goals.sql
   ```

This migration creates:

- `user_settings` for the life calculator preferences
- `goals` for date-based daily plans and check-ins
- row-level security policies so each user only sees their own data

## Verification

```bash
npm run lint
npm run build
```
