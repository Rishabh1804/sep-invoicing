# Geist under test

The interface's two faces, served to the test browser in place of Google Fonts (`routeFonts`, `tests/e2e/fixtures.ts`), so every
spec measures in the face the app ships in (docs/UI_PASS_3.md §24m). The app itself keeps loading them from Google Fonts.

| File | Face | Subset |
|---|---|---|
| `geist-latin.woff2` | Geist 1.800, variable (wght 100–900) | latin |
| `geist-latin-ext.woff2` | Geist 1.800, variable | latin-ext: holds the rupee sign (U+20B9), which latin does not |
| `geist-mono-latin.woff2` | Geist Mono 1.701, variable (wght 100–900) | latin |
| `geist-mono-latin-ext.woff2` | Geist Mono 1.701, variable | latin-ext, the rupee sign |

As Google Fonts served them on 20 Oct 2026 (`fonts.gstatic.com/s/geist/v5`, `/s/geistmono/v6`), with the same unicode ranges.
Both faces are under the SIL Open Font License 1.1, whose text is `OFL.txt` (the same text for both, from `google/fonts`,
`ofl/geist` and `ofl/geistmono`). The paper faces (Fraunces, Inter, IBM Plex Mono) are not served: paper declares its own faces
and P228's record of it was taken without them.
