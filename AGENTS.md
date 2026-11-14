# Repository Guidelines

## Project Structure & Module Organization

- `index.html` contains the entire application: HTML, inline CSS, JavaScript simulation logic, and Canvas 2D rendering. Keep it self-contained and usable offline without external dependencies.
- `Sim` implements the steady-state queue; `DaySim` implements the opening-day schedule and advance registration. `Queue` supports queue operations, while `erlangC()` and `theoryOf()` calculate theoretical metrics.
- `README.md` documents the Japanese interface, model assumptions, controls, and example results. Update it when behavior or defaults change.
- There are no separate source, asset, or test directories.

## Build, Test, and Development Commands

- Open `index.html` directly in a browser to run the simulator; installation and compilation are unnecessary.
- Optionally run `python3 -m http.server 8000` from the repository root, then visit `http://localhost:8000` for local HTTP testing.
- No package scripts, build pipeline, formatter, linter, or automated test runner are configured.

## Coding Style & Naming Conventions

Use two-space indentation per nesting level, matching the surrounding HTML, CSS, and JavaScript. JavaScript uses semicolons, double-quoted strings, `const` by default, and `let` for reassignment. Use PascalCase for classes, camelCase for functions and variables, UPPER_SNAKE_CASE for constants, and kebab-case for CSS classes.

Keep simulation logic separate from rendering within the existing script sections. Preserve Japanese user-facing labels and explanatory comments. Simulation time is measured in minutes; convert hourly rates explicitly.

## Testing Guidelines

There is no enforced coverage threshold or test naming convention. Manually verify both tabs after changes: sliders, pause/resume, reset, charts, resizing, and light/dark appearance. Check the browser console for errors.

For model changes, exercise zero arrivals, overloaded queues, changing server counts, opening/closing boundaries, and advance registration. Compare steady-state calculations with the README formulas; use reproducible seeds and repeated runs when checking stochastic behavior.

## Commit & Pull Request Guidelines

Git metadata is absent from this checkout, so existing commit conventions cannot be verified. Use concise, imperative subjects such as `Fix arrival scheduling across hourly boundaries`.

Describe the change, its reason, and verification performed. Link relevant issues and include screenshots for visual changes. Explain any changes to formulas, units, defaults, or simulation assumptions.
