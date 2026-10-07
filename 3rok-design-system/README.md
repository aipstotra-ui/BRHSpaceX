# 3rok design system

The tokens and base component styles used by the 3rok app.

## Files

- `tokens.css`: colors (dark default, `data-theme="light"` for the report theme), spacing, radii, font stacks and the type classes (`display-*`, `heading-*`, `body*`, `eyebrow`, `button`, `data-*`).
- `components/bundle.css`: base reset plus the `rok-*` component classes (btn, nav, panel, stat, badge, field, tabs, table, progress, map) and a few layout utilities (`row`, `space-above`, `error`).
- `components/index.d.ts`: documents the component props the app's React components follow.
- `tokens.json`: the same token data in machine-readable form.

## Fonts

The app loads three variable fonts with `next/font/local` from the `@fontsource-variable` npm packages (all OFL-1.1), in `app/fonts.ts`:

| Role | Font | CSS variable | Token |
|---|---|---|---|
| UI and body text | Inter | `--font-inter` | `--font-sans` |
| Display and headings | Space Grotesk | `--font-grotesk` | `--font-display` |
| Numbers and telemetry | JetBrains Mono (tabular figures) | `--font-jetbrains` | `--font-mono` |

Without those variables the stacks fall back to system fonts.

## Rules

- Headings are sentence case. Capitals are only for `eyebrow` and `button` labels.
- Use tokens for every color, font, spacing and radius. Font sizes come from the type classes or `--text-xs/sm/md/lg`.
- Sticky elements under the top bar offset by `var(--topbar-h)`, which the app sets from the bar's measured height.
