# Local invitation fonts

Downloaded from the official Google Fonts repository on 19 September 2026:

- [Great Vibes regular](https://github.com/google/fonts/tree/main/ofl/greatvibes): `GreatVibes-Regular.woff2`. License: `GreatVibes-OFL.txt`.
- [Cormorant Garamond variable](https://github.com/google/fonts/tree/main/ofl/cormorantgaramond): `CormorantGaramond-Variable.woff2`, weight axis 300–700. License: `CormorantGaramond-OFL.txt`.

Supplied by the couple on 26 September 2026:

- Calimoe (demo) by Ragamkata Studio: `Calimoe-Demo.woff2`, used for the couple's names. Free for personal use only; see `Calimoe-LICENSE.txt`. The demo covers Latin letters only.
- Caginari (personal use) by Hishand Studio: `Caginari.woff2`, used for the bride's initial. Free for personal use only; see `Caginari-LICENSE.pdf`. Only the capital letters A–Z are published (see `SUBSETS` in `tools/build-fonts.py`); the original `.otf` stays in `tools/font-sources/`.

The WOFF2 files preserve the original outlines and character coverage. They use `font-display: swap` and do not contact Google when a guest opens the invitation. Original TTF files live in `tools/font-sources/`, outside the published site, and are also used to render the social preview card.

To regenerate the committed WOFF2 files, install `tools/font-requirements.txt` in a Python virtual environment and run `python tools/build-fonts.py`. Python is not required for ordinary site builds. See the project's README for commands.
