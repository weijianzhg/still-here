# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

All commands run from the `app/` directory:

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
```

No test suite is configured.

## Architecture

**Still Here** is a memento mori app — it shows users how many days they have left to live, based on regional life expectancy data, with optional age-adjusted (conditional survival probability) calculations. Users can also journal daily reflections.

The app is a single Next.js App Router page (`app/src/app/page.tsx`) that renders one large client component. All state is persisted to `localStorage`.

### Key files

- `app/src/components/still-here.tsx` — the entire UI. All state, layout, and rendering logic lives here. This is where almost all changes happen.
- `app/src/lib/calculator.ts` — `calculateLifeStats()`: computes days alive, days remaining, age, and life progress. Handles the age-adjusted conditional survival formula.
- `app/src/lib/life-data.ts` — region definitions and life expectancy lookup (8 regions + custom).
- `app/src/lib/utils.ts` — `cn()` utility for merging Tailwind classes.
- `app/src/components/ui/` — shadcn/ui components (do not modify directly).

### State shape

```typescript
interface Settings {
  birthdate: string;
  regionId: string;
  customLifeExpectancy: string;
  ageAdjusted: boolean;
}

interface JournalEntry {
  id: string;
  date: string;
  dayNumber: number;
  title: string;
  body: string;
  createdAt: number;
}
```

### UI / Styling

- Tailwind CSS 4 with a stone/amber color palette
- shadcn/ui components (base-nova style, Lucide icons)
- The component includes a hydration guard to prevent SSR/client mismatch when reading from `localStorage`
- Path alias: `@/*` → `./src/*`
