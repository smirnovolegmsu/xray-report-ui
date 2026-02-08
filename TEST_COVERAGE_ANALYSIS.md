# Test Coverage Analysis

## Current State

**The project has zero test coverage.** There are no test files, no testing framework installed, no test configuration, and no test scripts in `package.json`. The only code quality tools in place are ESLint and TypeScript's `tsc --noEmit`.

| Aspect | Status |
|--------|--------|
| Testing framework | Not installed |
| Test files | 0 |
| Test configuration | None |
| Coverage tooling | None |
| `npm test` script | Missing |

The codebase consists of **82 frontend TypeScript/TSX files** across utilities, components, hooks, and pages — plus **3 backend Python files**. None have any test coverage.

---

## Recommended Testing Framework Setup

For a Next.js 16 + React 19 project, the recommended stack is:

- **Vitest** — fast, Vite-native test runner with built-in coverage via `@vitest/coverage-v8`
- **React Testing Library** (`@testing-library/react`) — component testing
- **MSW (Mock Service Worker)** — API mocking for integration tests
- **`@testing-library/user-event`** — simulating user interactions

---

## Priority Areas for Test Coverage

### Priority 1: Utility Functions (highest ROI, easiest to test)

These are pure functions with no React dependencies. They have branching logic, edge cases, and are used widely across the codebase. Testing them gives the highest confidence-per-effort.

#### `lib/utils.ts`

| Function | Why it needs tests |
|----------|--------------------|
| `formatBytes()` | 6 code paths: zero bytes, standard mode with various units, compact mode (GB vs MB), `returnObject` flag, custom `decimals`, trailing zero removal. Used in metrics cards, user tables, traffic displays. |
| `calculateChange()` | Edge case when `previous === 0` returns `null`. Negative vs positive percentages. Used in all dashboard metric comparisons. |
| `formatChange()` | Threshold at `abs >= 10` switches between `toFixed(1)` and `Math.round()`. |
| `handleApiError()` | 4 branches: `error.response.data.error`, `error.response.data.message`, `error.message`, fallback string. Used in every API call error handler. |

**Suggested test cases for `formatBytes`:**
- `formatBytes(0)` → `'0 B'`
- `formatBytes(0, { returnObject: true })` → `{ value: '0', unit: 'B' }`
- `formatBytes(1024)` → `'1 KB'`
- `formatBytes(1536, { decimals: 0 })` → `'2 KB'`
- `formatBytes(1073741824, { compact: true })` → `'1 GB'`
- `formatBytes(5242880, { compact: true })` → `'5 MB'`
- `formatBytes(1073741824, { compact: true, returnObject: true })` → `{ value: '1', unit: 'GB' }`

#### `lib/time-utils.ts`

| Function | Why it needs tests |
|----------|--------------------|
| `formatRelativeTime()` | 5 time brackets (seconds, minutes, hours, days, 7+ days) × 2 languages × Russian pluralization rules (`минуту`/`минуты`/`минут`). Complex pluralization logic is error-prone. |
| `formatEventTime()` | Combines relative + absolute time formatting. Branching on `showRelative`, `diffHours < 24`, and `timeRange`. |

**Suggested test cases for `formatRelativeTime`:**
- Just now (< 60s ago) in both ru/en
- Minutes ago with correct Russian pluralization (1 минуту, 3 минуты, 7 минут)
- Hours ago with correct Russian pluralization (1 час, 3 часа, 7 часов)
- Days ago with correct Russian pluralization (1 день, 3 дня, 7 дней)
- Dates older than 7 days render as locale date strings
- Dates older than 365 days include the year

#### `lib/i18n.ts`

| Function | Why it needs tests |
|----------|--------------------|
| `tr()` | Simple but critical — all UI text flows through `lang` selection. Verify correct language is returned for each input. |

#### `lib/card-colors.ts` and `lib/card-sizes.ts`

| Function | Why it needs tests |
|----------|--------------------|
| `getCardColorClasses()` | Ensure all 6 color schemes return valid class objects with `bg`, `text`, and `border` keys. |
| `getCardSizeClasses()` | Ensure all 3 sizes return valid class objects. Test the default parameter behavior. |

---

### Priority 2: Zustand Store (`lib/store.ts`)

The app store manages global state for theme, language, metrics, filters, and live settings. It uses `zustand/persist` with a custom `clientStorage` adapter.

**What to test:**
- Initial state values match expected defaults
- Each setter (`setTheme`, `setLang`, `setMetric`, etc.) correctly updates state
- `toggleUserSelection` — add user to empty list, add second user, remove existing user (toggle off)
- `partialize` — only the specified keys are persisted (not `selectedUsers`, `usageDate`, `livePaused`)
- `clientStorage` — graceful handling when `window` is undefined (SSR safety)

---

### Priority 3: SWR Data Hooks (`lib/swr.ts`)

These hooks are the data layer for the entire frontend. They wrap `apiClient` calls with SWR caching, deduplication, and auto-refresh.

**What to test (with MSW or mocked apiClient):**
- Each hook returns `data`, `error`, `isLoading` correctly
- SWR cache keys are correct (e.g., `['dashboard', 14]`, `'users'`, `['events', 100]`)
- `refreshInterval` values match expected polling rates (5s for live, 30s for users, 60s for dashboard)
- Revalidation helpers (`revalidateDashboard`, `revalidateUsers`, etc.) trigger the correct cache mutations
- Error states propagate correctly

---

### Priority 4: API Client (`lib/api.ts`)

The API client is a structured wrapper around axios. Testing it ensures correct URL construction, parameter passing, and type safety.

**What to test (with axios mock):**
- Each method calls the correct HTTP verb and URL path
- Query parameters are passed correctly (e.g., `getUserStats(uuid)` passes `{ params: { uuid } }`)
- Request body is structured correctly (e.g., `addUser(email)` sends `{ email }`)
- The axios instance uses the correct `baseURL`, `timeout`, and headers
- `downloadBackup` sets `responseType: 'blob'`

---

### Priority 5: Complex Component Logic

Several components contain significant business logic that should be tested independently of rendering.

#### `components/features/users/users-table.tsx`

| Logic | Why it needs tests |
|-------|--------------------|
| `getLastActivityDays()` | Calculates inactivity from `lastSeenAt` timestamp or falls back to traffic heuristics. 4 code paths. |
| `matchesFilter()` | Filter logic for 'all', 'active', 'low-activity', 'online' tabs. Thresholds at 3 days and 10 MB. |
| Search filtering | Case-insensitive matching on `email` and `alias`. |
| Filter count calculation | Counts must match the actual filter results. |

#### `components/features/overview/metrics-cards.tsx`

| Logic | Why it needs tests |
|-------|--------------------|
| Dashboard stats computation | Sums `daily_traffic_bytes`, `daily_conns`, counts active users, calculates averages. |
| Average traffic per user/day | Division: `traffic_total / (active_users × 7)`, with zero-division guard. |

#### `components/features/events/event-icon.tsx`

| Logic | Why it needs tests |
|-------|--------------------|
| Icon selection | 15+ branches mapping `(type, action)` pairs to icons. Verify all event types return the correct icon. |

---

### Priority 6: Component Rendering Tests

Once the logic is covered, add rendering tests for key UI components:

| Component | What to test |
|-----------|-------------|
| `MetricsCards` | Renders 4 cards with correct labels for ru/en. Shows loading skeleton. Shows null when no data. |
| `UsersTable` | Renders user rows. Shows empty state. Applies search filter. Applies tab filter. |
| `EventsTable` | Renders event rows with correct icons and severity badges. |
| `TrafficChart` | Renders with mock data (snapshot or visual regression). |
| `LiveNow` | Displays real-time metrics. Handles connection error state. |
| Layout components (`Header`, `Sidebar`) | Navigation links render. Active state is correct. Responsive behavior. |

---

### Priority 7: Integration / E2E Tests

After unit and component coverage is established:

| Scenario | Tool |
|----------|------|
| Full page load with mocked API | Vitest + React Testing Library + MSW |
| User CRUD flow (add, edit alias, kick, delete) | Playwright or Cypress |
| Settings changes persist across reload | Playwright |
| Live dashboard updates in real-time | Playwright with clock mocking |

---

## Summary: Coverage Roadmap

| Phase | Scope | Estimated Files | Impact |
|-------|-------|-----------------|--------|
| **Phase 1** | Utility functions (`lib/utils.ts`, `lib/time-utils.ts`, `lib/i18n.ts`, `lib/card-*.ts`) | 5 test files | Covers most reused logic, catches formatting and edge-case bugs |
| **Phase 2** | Zustand store (`lib/store.ts`) | 1 test file | Ensures state management works correctly, especially persistence |
| **Phase 3** | SWR hooks + API client (`lib/swr.ts`, `lib/api.ts`) | 2 test files | Validates the entire data fetching layer |
| **Phase 4** | Component logic extraction + testing | 3-5 test files | Business logic in users filtering, metrics calculation, event mapping |
| **Phase 5** | Component rendering tests | 10-15 test files | UI correctness, accessibility, i18n |
| **Phase 6** | E2E tests | 3-5 test files | Full user flows |

Starting with Phases 1-3 would provide meaningful coverage over the core logic with minimal setup effort.
