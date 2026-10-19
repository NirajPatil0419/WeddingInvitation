# Wedding Invitation

A Java 21 project that generates a static wedding invitation. HTML provides the page, CSS handles its appearance, and small JavaScript modules handle browser interactions. Java runs when building the site; guests receive ordinary static files from the hosting provider's CDN.

The invitation introduces the couple in an animated opening, then goes directly to Save the date without a second name card. It includes an optional intro video, music controls, scratch-to-reveal date cards, countdown, polaroid story gallery, venue details, event cards, and a share button. Its sage-green and antique-gold design is inspired by the reference invitation. RSVP is excluded.

The configured couple is **Niraj and Tanaya**, with the wedding on **25 November 2026 at 12:45 PM, India Standard Time**. The venue is Rugved Celebration Central, Chhatrapati Sambhajinagar. The events are Haldi and Sangeet on 24 November, then Vedic Vivah and the Wedding on 25 November. The venue illustration is still a placeholder.

## Project structure

```text
WeddingInvitation/
|-- config/
|   `-- wedding.properties                 # Edit wedding details here
|-- src/main/
|   |-- java/com/weddinginvitation/
|   |   |-- SiteGenerator.java             # Generates the website and deployment output
|   |   |-- AssetValidator.java            # Checks media before replacing output
|   |   |-- CalendarFiles.java             # Calendar files (generated, not linked from the page)
|   |   |-- SharingAssets.java             # Preview image and sharing metadata
|   |   |-- config/WeddingConfig.java      # Loads and validates wedding details
|   |   |-- config/Messages.java           # Interface text and locale fallback
|   |   `-- template/
|   |       |-- HtmlTemplate.java          # Escaped text and generated HTML fragments
|   |       `-- InvitationFragments.java  # Repeating event cards and story photos
|   `-- resources/
|       |-- templates/index.html          # Invitation markup
|       |-- messages/en.properties        # Interface and browser text
|       `-- static/
|           |-- css/
|           |   |-- styles.css            # Colours, layout, responsive styles
|           |   `-- intro.css             # Sage paper gates, Ganpati seal, opening animation
|           |-- js/
|           |   |-- main.js               # Initializes independent enhancements
|           |   |-- intro.js              # Envelope opening and optional video
|           |   |-- music.js              # Music control and synthesized melody
|           |   |-- scratch-date.js       # Pointer scratch cards and reveal button
|           |   |-- countdown.js          # Countdown to the configured instant
|           |   |-- effects.js            # Section entrances, petals, scroll progress
|           |   `-- sharing.js            # Device share sheet or copy link
|           `-- assets/
|               |-- images/
|               |-- audio/
|               |-- video/
|               `-- fonts/
|-- scripts/
|   |-- build.ps1 / build.sh              # Compile Java and generate the site
|   `-- preview.ps1 / preview.sh          # Build and serve a local preview
|-- deployment/vercel-output.json         # Vercel Build Output API manifest
|-- tests/                                # Java and portable browser checks
|-- tools/                                # Original fonts and conversion script
|-- package.json / package-lock.json       # Pinned development dependencies
|-- .github/workflows/checks.yml           # Windows and Linux build/test checks
|-- docs/architecture.md                  # Design and performance decisions
|-- .vscode/settings.json                 # Java source and output directories
|-- build/                                # Generated Java classes (ignored by Git)
|-- dist/                                 # Generated static site (ignored by Git)
`-- .vercel/output/                       # Generated Vercel artifact (ignored by Git)
```

## Run locally

Install **JDK 21**, recorded in `.java-version`. Set `JAVA_HOME` to its installation directory, or put its `java` and `javac` on PATH. The scripts validate both tools before compiling. On Windows, a workspace-local JDK in `build/toolchains/jdk-21*` takes precedence; this workspace includes one so the older system Java can stay in place. The site build does not require Maven, Gradle, Node.js, or third-party Java libraries.

From the project directory in PowerShell:

```powershell
.\scripts\preview.ps1
```

Open **http://127.0.0.1:8080**. Stop with `Ctrl+C`. If local PowerShell policy prevents running scripts, use `powershell -ExecutionPolicy Bypass -File .\scripts\preview.ps1` for that process only.

Build without starting the preview:

```powershell
.\scripts\build.ps1
```

On macOS/Linux, use `bash scripts/preview.sh` or `bash scripts/build.sh`. An optional port can be passed with `-Port 8081` in PowerShell or `8081` after the shell script name. The preview server binds to your own machine and is for local development only.

There is no automatic rebuild yet. After editing source files or properties, run the build again and refresh your browser. Do not edit `dist/` or `.vercel/output/`; each successful build recreates them.

## Change wedding information

Edit **`config/wedding.properties`**. It holds the couple's names, optional parent names, messages, date/time, venue, maps link, page metadata, family sign-off, story photos, events, and optional media paths. Save it as UTF-8; Indian-language text can be entered directly.

Use an ISO date with a timezone offset. The current value, `2026-11-25T12:45:00+05:30`, means 12:45 PM in India. Java formats the displayed wedding and event dates in their configured timezone; visiting from another country does not change them. The countdown uses the same instant for all guests. A separate, clearly labelled local-time row can show the equivalent time where a guest lives.

| Settings | What to change |
| --- | --- |
| `couple.*`, `wedding.*`, `family.message`, `family.signature` | Names, optional parents, blessing, invitation text, wedding date, footer, and the closing "With warm regards" family sign-off |
| `venue.*` | Real venue name, full address, map link, image, and image description |
| `story.photos.count`, `story.photos.N.*` | Numbered photos, descriptive alt text, titles, and captions |
| `events.count`, `events.N.*` | Numbered event titles, dates, descriptions, map links, and icons |
| `media.introVideo`, `media.musicSource` | Optional video and music file paths |

Event cards show the title, date, time (without a timezone suffix), and description. `events.4.dateTime=wedding` keeps the Wedding card synchronized with `wedding.dateTime`. A blank event map uses the main venue map in the generated calendar files. Event icons can be `HALDI`, `MEHENDI`, `SANGEET`, `VIVAH`, or `WEDDING`.

To add an event or story photo, copy a numbered group, give it the next number, and increase its count. To remove entries, renumber the remaining groups consecutively and reduce the count.

Properties are text, not HTML. Java validates required fields, dates, language tags, counts, map URLs, contact links, and asset paths, and escapes values before inserting them into the page. Missing or unreadable local media fails the build before existing output is replaced. Remote HTTPS media is not fetched during builds. Files above 1 MiB, audio above 10 MiB, video above 20 MiB, and a static folder above 90 MiB produce advisory size warnings. Keep private credentials out of invitation content: anything rendered into the site is public.

## Photos, video, and music

Place your media under `src/main/resources/static/assets/`, then use paths such as `assets/images/couple-1.webp`, `assets/video/intro.mp4`, or `assets/audio/music.mp3` in the properties file. Complete HTTPS URLs also work. Absolute filesystem paths and `..` traversal paths are rejected. Compress photographs and video before adding them; the builder copies assets without recompressing them.

The story gallery uses the couple's photos (`assets/images/story-*.jpeg`). The venue SVG is still a placeholder illustration; replace its file or update `venue.image` and `venue.imageAlt`. Fonts and decorative artwork are served locally; the font files include their licenses.

With `media.introVideo` blank, guests tap the supplied Lord Ganpati wax seal on sage paper panels. If a guest does not tap within 3 seconds, the opening starts by itself and the music begins on their next tap, click, or key press (browsers block sound until then; a scroll swipe does not count, so it keeps trying on each tap until playback starts). Whenever a guest stops scrolling for 4 seconds anywhere before the end of the invitation, a dark "Scroll down" prompt appears; it disappears on scroll or scrolls the page when tapped. Pressing a key before then keeps the seal waiting, for keyboard and screen-reader guests. The panels open outward to a botanical arch, the couple's names fade in, and the opening dissolves into the invitation over 5.3 seconds, including an extra second to read the names. The couple's names use the Calimoe demo font (free for personal use; see `assets/fonts/Calimoe-LICENSE.txt`), falling back to Cormorant Garamond for characters it lacks such as `&`, and the sage paper palette continues through the rest of the invitation. Reduced-motion preferences open the invitation immediately. The opening uses original CSS and local SVG artwork inspired by the Élysée Sage live preview, with its styles isolated in `intro.css`; the reference site's video and artwork are not included. A configured video plays muted and opens the invitation when it ends, with playback capped at 20 seconds. If it cannot start within 4 seconds or playback fails, the invitation opens automatically. Guests can skip the opening or press Escape at any time. The date can be revealed by scratching or by pressing its reveal button, and the rest of the invitation remains available without completing it.

The invitation uses the supplied **Jashn-e-Bahaara (flute instrumental)** MP3 at `src/main/resources/static/assets/audio/jashn-e-bahaara-flute.mp3`, configured through `media.musicSource`. It plays softly at 30% volume and loops after the guest opens the invitation. Clear `media.musicSource` to return to the original built-in melody.

With `media.musicSource` blank, the browser can play an original synthesized melody without downloading an audio track. Set that property to your own music to use an audio file instead. Music starts only after interaction and has a visible play/pause control. Leaving the tab pauses playback; guests choose whether to resume it. Motion effects respect reduced-motion preferences.

## Deploy to Vercel

Use a **personal Hobby account** for this personal invitation. Keep the included `vercel.app` address to avoid buying a domain. Node.js/npm is needed for the optional Vercel CLI deployment commands below and development checks; the site generator itself still uses only Java.

1. Build locally using `.\scripts\build.ps1` (or `bash scripts/build.sh`).
2. Run `npx vercel login` and `npx vercel link` from the project root to connect your account and select or create the project. Select **Other** if asked for a framework.
3. Run `npx vercel deploy --prebuilt` to create a preview deployment.
4. After checking it, run `npx vercel deploy --prebuilt --prod` to publish the production invitation.

These commands publish content when you run them; the invitation has not been deployed by these instructions. Use the production URL when sharing with guests and verify it opens in an incognito window without a login prompt.

The generator writes `.vercel/output/config.json` and `.vercel/output/static/` using Vercel's [Build Output API](https://vercel.com/docs/build-output-api). The `--prebuilt` option uploads those files without running a Java build on Vercel. Project-link information in `.vercel/project.json` is preserved by rebuilds. If linking changes project settings or you change invitation details, rebuild before deploying again.

Keep the generated invitation within Vercel Hobby's [100 MB CLI upload limit](https://vercel.com/docs/limits), particularly when adding video and audio.

Git-based Java builds on Vercel have not been configured. The supported route is the explicit local build and prebuilt deployment above. The included CI workflow builds and tests on Windows and Linux. Publishing remains a separate action; CI does not deploy.

## Second invitation (wedding only)

Both invitations are live at the same time and independent of each other: each is its own Vercel project with its own link and WhatsApp preview, so share the full link with guests invited to every event and the wedding-only link with everyone else. Publishing one never affects the other.

`config/variants/niraj-weds-tanaya-wedding.properties` builds a second invitation for guests invited only to the wedding. It overrides just what differs from `config/wedding.properties` (its public URL, a single Wedding event, and the "Day of joy" wording); names, photos, venue, music, and everything else are shared, so edit those once in the main file. Interface-text keys from `messages/en.properties` can be overridden in the same file.

`.\scriptsuild.ps1 -Variant niraj-weds-tanaya-wedding` builds it into `build/variants/niraj-weds-tanaya-wedding/`. `.\scripts\deploy.ps1` builds and publishes both invitations: the main one to https://niraj-weds-tanaya.vercel.app and each variant to the Vercel project with the same name as its file (https://niraj-weds-tanaya-wedding.vercel.app), creating that project on first use. It reads `VERCEL_TOKEN` from the git-ignored `config/.env`.

## Free hosting and approximately 700 guests

As checked on 19 September 2026:

| Option | Free hosting considerations |
| --- | --- |
| [Vercel Hobby](https://vercel.com/docs/plans/hobby) | Personal, non-commercial projects; 100 GB monthly Fast Data Transfer and 1 million Edge Requests. Selected default. |
| [Cloudflare Pages](https://developers.cloudflare.com/pages/functions/pricing/) | Static asset requests are free and unlimited. A useful alternative; [each file is limited to 25 MiB](https://developers.cloudflare.com/pages/platform/limits/). |

Cloudflare supports [uploading a built folder](https://developers.cloudflare.com/pages/get-started/direct-upload/), so the same `dist/` output can be used there. Both routes can use a provider subdomain instead of a purchased domain. Free-plan terms and limits can change; Vercel can pause features when free usage is exhausted.

For a rough estimate, 700 full visits at 10 MB each would transfer about **7 GB**. Repeat visits and video playback add usage. The static architecture removes a shared Java server or database from guest requests. Story images load lazily, optional media waits for interaction, and background work pauses when the tab is hidden. Actual performance still depends on uploaded media, devices, and networks. No 700-user load test has been performed.

## Public URL, sharing, calendars, and contact

Set `site.url` in `config/wedding.properties` to the final HTTPS website root, for example `https://your-invitation.vercel.app/`. Queries, fragments, and credentials are rejected. A trailing slash is added automatically; subdirectory deployments are supported. Leave it blank while undecided. The generator then omits URL-dependent metadata instead of publishing a made-up address.

Each build generates a 1200 x 630 PNG at `assets/images/invitation-preview.png` from the configured names, date, time, and venue. Once `site.url` is set, the page includes its canonical URL, `og:url`, an absolute `og:image`, image dimensions, and a large-image social card declaration. Sharing prefers the canonical URL.

The build still writes `calendar/wedding.ics` and one `calendar/event-N.ics` per celebration, but the page no longer links to them. Calendar timestamps use UTC instants converted from the configured timezone. Downloads contain start times only; no end time is guessed. Text is escaped and long lines are folded without splitting UTF-8 characters.

Set `contact.url` to a `mailto:` email address, a `tel:` phone number, or an HTTPS contact page to show the contact link. It stays hidden when blank. Edit `uiContact` in the messages file to change its label. Configured contact details become public.

## Development checks

Use **Node.js 22**, recorded in `.nvmrc`. Development dependencies are pinned in `package-lock.json`; downloaded runtimes and browser packages are ignored by Git.

```sh
npm ci
npx playwright install chromium
npm test
```

`npm test` builds, runs dependency-free Java checks, starts isolated local preview servers, and runs browser interaction and layout checks. Servers choose available loopback ports and shut down afterward. Screenshots and reports go to ignored `test-results/`.

On Windows, `.\scripts\test.ps1` runs the same checks. It uses `build/toolchains/node22/node.exe` when available, otherwise system Node. This workspace includes a local Node 22 runtime, so the global installation can stay in place. A fresh clone still needs the dependencies and browser installed using the commands above. `PLAYWRIGHT_CHANNEL=chrome` optionally selects an installed Chrome; no machine-specific browser path is hardcoded.

Checks cover escaping, media validation and preservation of previous output on failure, calendar timezones and Unicode, sharing metadata, contacts, translation fallback, opening/video fallbacks, music, touch scratching, sharing, no-JavaScript behavior, and layouts at 320, 390, and 1440 pixels. CI runs the same checks on Windows and Linux without deploying.

```sh
npm run format
npm run format:check
```

Maintained tests live under `tests/`. Generated outputs, dependencies, caches, and screenshots are ignored by Git.

## Interface text and fonts

`src/main/resources/messages/en.properties` contains fixed interface text, including browser announcements. Add overrides in a file such as `fr.properties` or `fr-FR.properties`, then set `site.language`. Loading order is English, base language, then exact language tag. Missing translations retain their English values. Wedding content stays in `wedding.properties`. Some headings use separate keys for emphasized words; adjust their template if another language requires a different word order.

Interface values are escaped as ordinary text. JavaScript reads messages from hidden HTML elements rather than executable code. Fonts preserve their original character coverage; other scripts use browser fallback fonts.

Only WOFF2 fonts are published. The original TTFs in `tools/font-sources/` also render the social preview image. Keep those sources in Git. Original licenses stay alongside the published fonts. Python is only needed to regenerate WOFF2 files:

```sh
python -m venv build/font-env
# Activate the environment using your shell, then:
python -m pip install -r tools/font-requirements.txt
python tools/build-fonts.py
```
