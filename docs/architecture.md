# Architecture

## Request flow

```text
wedding.properties + HTML template + static assets
                         |
                    Java build
                         |
          dist/ + .vercel/output/static/
                         |
                 Static hosting CDN
                         |
                    Guest browser
```

Java is the build-time language. The output is a static website, with no hosted Java process, database, API, RSVP, or guest session. This suits a personal invitation that is shared widely and updated occasionally.

## Responsibilities

| Location | Responsibility |
| --- | --- |
| `config/wedding.properties` | Single editable source for names, dates, messages, gallery, events, venue, and optional media |
| `WeddingConfig` | Typed Java record; reads UTF-8 properties and validates values |
| `SiteGenerator` | Formats wedding data, copies assets, and creates deployment artifacts |
| `HtmlTemplate` | One-pass replacement of escaped `{{name}}` text and typed `{{{fragment}}}` HTML |
| `InvitationFragments` | Generates repeating event cards and story photos from fixed templates |
| `templates/` | Page structure; placeholders belong in text or quoted attributes |
| `static/css/` | Theme, layout, accessibility, and responsive styling |
| `static/js/` | Independent modules for opening, music, scratch cards, countdown, motion, and sharing |
| `static/assets/` | Local SVG artwork, licensed fonts, and space for the couple's photographs, audio, and video |

Template placeholders belong in HTML text or quoted attributes, never raw JavaScript, CSS, tag names, or unquoted attributes. Normal values escape ampersands, angle brackets, and both quote characters. Generated fragments use a separate type and are assembled from developer-owned templates; their configurable text still passes through escaping. Replacement happens once, so placeholder-like text in a property is not interpreted again.

Map URLs accept complete HTTP or HTTPS URLs. Media and image sources accept complete HTTPS URLs or relative `assets/` paths without traversal. Configurable event icons come from a fixed Java enum, not supplied HTML. Browser content remains useful when JavaScript is unavailable.

Java parses dates as `ZonedDateTime` and formats their visible labels using their configured timezone and site language. It also emits ISO timestamps with offsets. The browser countdown compares that instant with the current time, rather than rebuilding a local date from individual fields. A separately labelled local-time equivalent does not overwrite the main wedding date or event labels.

## Invitation experience

The reference is [Invifest](https://invifest-demo.vercel.app/). The invitation follows its cream, rose, and gold direction and its progression through an opening, blessing and couple section, date reveal, countdown, story, venue, celebrations, and family footer. It uses original page code and locally supplied artwork. RSVP is outside this project's scope.

`main.js` initializes each enhancement independently so a runtime initialization failure in one effect does not prevent the others from starting.

| Module | Behavior |
| --- | --- |
| `intro.js` | Opens an animated envelope or plays optional muted video; opens after the video ends, 4 seconds without starting, or 20 seconds of playback; supports Skip and Escape at any time |
| `music.js` | Plays an original synthesized melody or a configured audio track after interaction; provides pause/resume controls |
| `scratch-date.js` | Reveals date cards with pointer scratching or a button; does not gate the rest of the page |
| `countdown.js` | Updates the time remaining to the configured wedding instant and stops at zero |
| `effects.js` | Adds section entrances, a limited number of falling petals, and scroll progress; respects reduced motion |
| `sharing.js` | Opens the device share sheet where supported, otherwise copies the invitation URL |

The gallery contains three polaroid cards with SVG illustrations as placeholders. The venue image is also an illustration. Replace these and the example Haldi, Mehendi, and Sangeet details with confirmed information before sharing. The configured wedding date is 25 November 2026 at 12:45 PM with the `+05:30` offset; the Wedding event inherits it through `dateTime=wedding`.

Fonts and decorative assets are local. No reference photos, audio, or video are bundled. Add the couple's own media or appropriately licensed replacements through the properties file. The default synthesized music needs no downloaded recording.

## Performance approach

- Generate HTML once per build; serve it and its assets from a CDN.
- Keep browser code small; add dependencies only when they simplify a real feature.
- Provide explicit image dimensions and responsive layout; story photographs load lazily.
- Defer optional audio and video until interaction. The builder copies media unchanged, so compress replacement files before adding them.
- Start music only after a guest interaction, with a visible play/pause control.
- Keep entry independent of successful video playback and provide a button alternative to scratching.
- Pause countdown updates, music, and decorative petals while the tab is hidden.
- Respect reduced-motion preferences for the opening and decorative effects.

Concurrent delivery and animation smoothness are separate concerns. The deployment provider handles static requests, while media size and browser effects determine much of the experience on a guest's phone. There is no shared application server to scale, but this does not establish a measured 700-user capacity or guarantee performance on every device. Check mobile layouts and replacement media before publishing.
