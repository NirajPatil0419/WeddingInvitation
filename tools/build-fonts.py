"""Repackage the original fonts as WOFF2.

Optional maintenance tool; normal builds use the committed WOFF2 files.
Run in a virtual environment with tools/font-requirements.txt installed.
Fonts keep their full language coverage unless listed in SUBSETS.
"""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/main/resources/static/assets/fonts"
# Fonts used for a few letters only. Publishing just those letters keeps the download
# small and avoids redistributing the complete personal-use font.
SUBSETS = {"Caginari": "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}

sources = sorted((ROOT / "tools/font-sources").glob("*.ttf")) + sorted(
    (ROOT / "tools/font-sources").glob("*.otf")
)
for source in sources:
    with TTFont(source, recalcTimestamp=False) as font:
        if source.stem in SUBSETS:
            subsetter = subset.Subsetter(subset.Options(layout_features=["*"]))
            subsetter.populate(text=SUBSETS[source.stem])
            subsetter.subset(font)
        font.flavor = "woff2"
        destination = OUTPUT / (source.stem + ".woff2")
        font.save(destination)
        print(f"{destination.name}: {destination.stat().st_size:,} bytes")
