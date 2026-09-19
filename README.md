# Wedding Invitation

A Java 21 project that generates a static wedding invitation. HTML provides the page, CSS handles its appearance, and small JavaScript modules handle browser interactions. Java runs when building the site; guests receive ordinary static files from the hosting provider's CDN.

The invitation includes an animated envelope opening, optional intro video, music controls, scratch-to-reveal date cards, countdown, polaroid story gallery, venue details, event cards, and a share button. Its cream, rose, and gold design is inspired by the reference invitation. RSVP is excluded.

The configured couple is **Niraj and Tanaya**, with the wedding on **25 November 2026 at 12:45 PM, India Standard Time**. Venue details, the other event dates, and the supplied illustrations still need your replacements before sharing.

## Project structure

```text
WeddingInvitation/
|-- config/
|   `-- wedding.properties                 # Edit wedding details here
|-- src/main/
|   |-- java/com/weddinginvitation/
|   |   |-- SiteGenerator.java             # Generates the website and deployment output
|   |   |-- config/WeddingConfig.java      # Loads and validates wedding details
|   |   `-- template/
|   |       |-- HtmlTemplate.java          # Escaped text and generated HTML fragments
|   |       `-- InvitationFragments.java  # Repeating event cards and story photos
|   `-- resources/
|       |-- templates/index.html          # Invitation markup
|       `-- static/
|           |-- css/styles.css            # Colours, layout, responsive styles
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
|-- docs/architecture.md                  # Design and performance decisions
|-- .vscode/settings.json                 # Java source and output directories
|-- build/                                # Generated Java classes (ignored by Git)
|-- dist/                                 # Generated static site (ignored by Git)
`-- .vercel/output/                       # Generated Vercel artifact (ignored by Git)
```

## Run locally

Install **JDK 21 or newer**, with `java` and `javac` on PATH. The site build does not require Maven, Gradle, Node.js, or third-party Java libraries.

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

Edit **`config/wedding.properties`**. It holds the couple's names, optional parent names, messages, date/time, venue, maps link, page metadata, hashtag, story photos, events, and optional media paths. Save it as UTF-8; Indian-language text can be entered directly.

Use an ISO date with a timezone offset. The current value, `2026-11-25T12:45:00+05:30`, means 12:45 PM in India. Java formats the displayed wedding and event dates in their configured timezone; visiting from another country does not change them. The countdown uses the same instant for all guests. A separate, clearly labelled local-time row can show the equivalent time where a guest lives.

| Settings | What to change |
| --- | --- |
| `couple.*`, `wedding.*`, `family.message` | Names, optional parents, hashtag, blessing, invitation text, wedding date, and footer |
| `venue.*` | Real venue name, full address, map link, image, and image description |
| `story.photos.count`, `story.photos.N.*` | Numbered photos, descriptive alt text, titles, and captions |
| `events.count`, `events.N.*` | Numbered event titles, dates, descriptions, dress codes, map links, and icons |
| `media.introVideo`, `media.musicSource` | Optional video and music file paths |

The Haldi, Mehendi, and Sangeet dates are explicitly marked examples in the properties file. Confirm or replace them. `events.4.dateTime=wedding` keeps the Wedding card synchronized with `wedding.dateTime`. A blank event map uses the main venue map; a blank dress code hides that line. Event icons can be `HALDI`, `MEHENDI`, `SANGEET`, or `WEDDING`.

To add an event or story photo, copy a numbered group, give it the next number, and increase its count. To remove entries, renumber the remaining groups consecutively and reduce the count.

Properties are text, not HTML. Java validates required fields, dates, language tags, counts, map URLs, and asset paths, and escapes values before inserting them into the page. Keep private credentials out of invitation content: anything rendered into the site is public.

## Photos, video, and music

Place your media under `src/main/resources/static/assets/`, then use paths such as `assets/images/couple-1.webp`, `assets/video/intro.mp4`, or `assets/audio/music.mp3` in the properties file. Complete HTTPS URLs also work. Absolute filesystem paths and `..` traversal paths are rejected. Compress photographs and video before adding them; the builder copies assets without recompressing them.

The three story illustrations and venue SVG are editable placeholders, not photos of the couple or the real venue. Replace their files or update the corresponding properties, including meaningful image descriptions. Fonts and decorative artwork are served locally; the font files include their licenses.

With `media.introVideo` blank, the opening uses the built-in envelope animation. A configured video plays muted and opens the invitation when it ends, with playback capped at 20 seconds. If it cannot start within 4 seconds or playback fails, the invitation opens automatically. Guests can skip the opening or press Escape at any time. The date can be revealed by scratching or by pressing its reveal button, and the rest of the invitation remains available without completing it.

With `media.musicSource` blank, the browser can play an original synthesized melody without downloading an audio track. Set that property to your own music to use an audio file instead. Music starts only after interaction and has a visible play/pause control. Leaving the tab pauses playback; guests choose whether to resume it. Motion effects respect reduced-motion preferences.

## Deploy to Vercel

Use a **personal Hobby account** for this personal invitation. Keep the included `vercel.app` address to avoid buying a domain. Node.js/npm is needed only for the optional Vercel CLI deployment commands below.

1. Build locally using `.\scripts\build.ps1` (or `bash scripts/build.sh`).
2. Run `npx vercel login` and `npx vercel link` from the project root to connect your account and select or create the project. Select **Other** if asked for a framework.
3. Run `npx vercel deploy --prebuilt` to create a preview deployment.
4. After checking it, run `npx vercel deploy --prebuilt --prod` to publish the production invitation.

These commands publish content when you run them; the invitation has not been deployed by these instructions. Use the production URL when sharing with guests and verify it opens in an incognito window without a login prompt.

The generator writes `.vercel/output/config.json` and `.vercel/output/static/` using Vercel's [Build Output API](https://vercel.com/docs/build-output-api). The `--prebuilt` option uploads those files without running a Java build on Vercel. Project-link information in `.vercel/project.json` is preserved by rebuilds. If linking changes project settings or you change invitation details, rebuild before deploying again.

Keep the generated invitation within Vercel Hobby's [100 MB CLI upload limit](https://vercel.com/docs/limits), particularly when adding video and audio.

Git-based Java builds on Vercel have not been configured. The supported route is the explicit local build and prebuilt deployment above. A future CI workflow can run the same Java build.

## Free hosting and approximately 700 guests

As checked on 19 September 2026:

| Option | Free hosting considerations |
| --- | --- |
| [Vercel Hobby](https://vercel.com/docs/plans/hobby) | Personal, non-commercial projects; 100 GB monthly Fast Data Transfer and 1 million Edge Requests. Selected default. |
| [Cloudflare Pages](https://developers.cloudflare.com/pages/functions/pricing/) | Static asset requests are free and unlimited. A useful alternative; [each file is limited to 25 MiB](https://developers.cloudflare.com/pages/platform/limits/). |

Cloudflare supports [uploading a built folder](https://developers.cloudflare.com/pages/get-started/direct-upload/), so the same `dist/` output can be used there. Both routes can use a provider subdomain instead of a purchased domain. Free-plan terms and limits can change; Vercel can pause features when free usage is exhausted.

For a rough estimate, 700 full visits at 10 MB each would transfer about **7 GB**. Repeat visits and video playback add usage. The static architecture removes a shared Java server or database from guest requests. Story images load lazily, optional media waits for interaction, and background work pauses when the tab is hidden. Actual performance still depends on uploaded media, devices, and networks. No 700-user load test has been performed.
