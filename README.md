# Daycraft

**Make room for a better day.**

A complete, English-language personal productivity workspace built with **Alpine.js**, **Motion**, and **Chart.js**. Warm neutrals, thoughtful animation, a dark forest theme, and responsive layouts make everyday planning feel a little better.

## Run locally

Install Node.js 20 or newer, open this folder, and run:

```sh
npm start
```

Open **http://localhost:3000**. All browser dependencies and fonts are already included in `dist/assets`, so installing packages is unnecessary to run the app. `PORT` can override the default port.

## Run on Replit

1. Create a Node.js Replit project and upload the contents of this folder. Keep `dist`, `scripts`, `package.json`, and `.replit` at the project root.
2. Press **Run**. The included `.replit` file runs `npm start`, binds the server to `0.0.0.0`, and forwards port 3000.
3. If creating a deployment, use the included run command `node scripts/serve.mjs`. Alternatively, publish `dist` with a static hosting service.

The app was prepared for Replit; it has not been uploaded to or deployed through a Replit account.

## Your workspace

- **Overview:** today’s intentions, daily rituals, live progress, a weekly chart, and quick access to focus.
- **My tasks:** full task creation, editing and deletion; categories, priorities, due dates, optional times, estimates, descriptions, and checkable subtasks. Search and combine date, category, status, and priority filters. Sort by date, priority, newest, or title. Switch between list and Kanban views. Drag cards between columns or use their accessible “Move to” menus.
- **Habits:** custom icons and colors, weekly schedules, check-ins for past scheduled days, streaks that skip off-days, a 30-day consistency rate, and an 84-day activity garden. Future check-ins are disabled.
- **Planner:** week, month, and day views. Tasks appear on their due dates. Create, edit and remove time blocks, with an overlap notice. Tasks without times remain “Anytime.” The weekly view is an ordered agenda by day, rather than a proportional hourly grid.
- **Insights:** 7-, 14-, and 30-day task and focus charts, category breakdowns, habit completion rates, a daily table, and CSV export. Analytics use the day a task was completed, independently of its due date.
- **Focus room:** customizable focus and break durations, task selection, pause/resume/reset, an immersive quiet mode, and session history. The running timer follows a timestamp and resumes correctly after a refresh. Complete a whole session or log at least one minute with the finish button. Switching mode or resetting abandons the current unlogged session.
- **Journal:** daily reflections, a mood check-in, gratitude notes, rotating prompts, automatic saving, and recent entries.
- **Goals:** a target, unit, deadline, color, editable progress, one-step progress logging, and milestone celebrations.
- **Settings:** name, daily task target, week start, light/dark/system appearance, reduced motion, focus durations, backup export/import, and a confirmed fresh start.
- **Everywhere:** command search, keyboard shortcuts, in-app reminders, responsive navigation, focus-trapped dialogs, toast feedback, and a ten-second undo for deletions.

## Data and privacy

The app is **browser-local**. It stores its workspace under `daycraft.v1` in localStorage, without accounts, a backend, or automatic cross-device sync. Tabs on the same origin can pick up changes. Other browsers, devices, and deployment origins have separate workspaces.

Export a JSON backup from Settings before clearing browser storage or moving between URLs or devices. Import validates the file, then asks before replacing the current workspace. Backups can include private journal text: keep them somewhere appropriate. If local saving fails, the app displays a notice and still allows backup export.

The first visit includes clearly marked sample tasks, habits, plans, goals, and 27 days of aggregate sample history. Choose **Settings → Start with a clean slate** when you want an empty workspace. Appearance and focus preferences are preserved.

Dates and times follow the device’s local timezone. Reminders are shown inside the app; this version does not send push notifications or run scheduled actions when the app is closed. Timer completion is reconciled when the app is opened again.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Cmd/Ctrl + K | Search tasks, habits, pages and quick actions |
| N | New task |
| H | New habit |
| F | Focus room |
| D | Toggle light/dark |
| ? | Show shortcuts and help |
| Esc | Close a dialog or exit quiet mode |

Single-key shortcuts are ignored while typing in a field. Command search supports the up/down arrows and Enter.

## Project structure

```text
dist/
  index.html              Alpine templates and SVG icon symbols
  assets/
    app.js                Workspace interactions and chart integration
    core.js               Dates, sample data, statistics and import validation
    style.css             Responsive design, themes and animation
    dm-sans-*.ttf          Local fonts
    favicon.svg
    vendor/               Pinned libraries and third-party licenses
scripts/
  serve.mjs               Dependency-free static HTTP server
  vendor.mjs              Refresh included browser libraries
tests/
  core.test.cjs           Calendar, streak, analytics and validation tests
  app.test.cjs            Real Alpine DOM interaction tests in jsdom
package.json
.replit
```

## Development and verification

To install development dependencies and run the tests:

```sh
npm ci
npm test
```

To refresh the included browser libraries from the pinned packages:

```sh
npm run vendor
```

There is no build step. Edit the files in `dist` and refresh. Deployment consists of serving `dist` over HTTP. Do not open the HTML through a `file://` URL: storage behavior is browser-dependent.

Automated checks cover calendar boundaries, scheduled streaks, actual completion dates, valid backup round trips, corrupt imports, safe text rendering, every page’s Alpine expressions, task and habit interactions, time-block validation, goal progress, journal switching, timer recovery, shortcuts, deletion undo, and clean-slate behavior. The DOM tests use jsdom; charts and motion are stubbed because jsdom does not provide a canvas or visual layout. Interactive visual browser QA was not available in the build environment.

Third-party licenses are included under `dist/assets/vendor`. DM Sans is distributed under the SIL Open Font License.
