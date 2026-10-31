# Spidey Hang website

The website for [Spidey Hang](https://github.com/ashishmanhas231/Hang-in-there), the desktop toy where
Spider-Man hangs from a web at the top of your screen. Visitors can play with him in the browser, read
about every feature, and download the app for Windows, macOS or Linux.

The Spidey hanging off the page is not a copy: it runs the app's own physics, drawing, picture-hero
loader and reminder bubble, copied from the app into `vendor/spidey/`. He starts as Iron Spider and
hangs still until you grab him or switch on "Swing on his own"; every hero from the app can be picked.

## Run it

Needs Node.js 22.12 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests: commands, platform detection, downloads, settings
npm run build      # the static site, in dist/
npm run preview    # serve dist/
```

## How it fits together

```
index.html, download/index.html   the two pages (Vite builds both)
src/
  main.js, download-main.js       page entry points
  overlay/                        the hanging Spidey (a port of the app's hang-view.js), his menu,
                                  settings (localStorage, the app's keys), picture heroes
  sections/                       playground, reminders, hero gallery, terminal, download cards
  lib/                            the app's command language, platform detection, release lookup
  theme.js                        light and dark (follows the system until you pick one)
  assets/heroes/                  the app's hero pictures (from its src/heroes)
vendor/spidey/                    the app's browser code, copied by `npm run sync`
scripts/
  sync-app-code.mjs               copies the app's code in: npm run sync -- /path/to/Hang-in-there
  fetch-release.mjs               saves the app's latest GitHub release before each build
site.config.js                    which GitHub repositories hold the app and this site
```

## Downloads

The download buttons point at the app's GitHub Releases. The app's own workflow builds the Windows
`.exe`, both macOS `.dmg` files and the Linux `.deb`, and attaches them to a release when a `v*` tag is
pushed. The site picks the files up by name pattern at build time and checks GitHub again in the
browser, so a new release shows up without rebuilding the site. Until there is a release, every card
links to the releases page.

## Publishing

`.github/workflows/pages.yml` tests, builds and deploys to GitHub Pages on every push to `main`.
In the repository settings, set **Pages › Source** to **GitHub Actions** once.

## Artwork

The code is MIT licensed. The hero pictures in `src/assets/heroes/` come from the app's `src/heroes/`
and are artwork of the Marvel character; the MIT licence does not cover them.
Spider-Man is a Marvel character. This is an unofficial fan project, not affiliated with or endorsed
by Marvel or Disney.
