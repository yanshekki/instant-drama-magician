#!/usr/bin/env python3
"""Verify all 10 UI locales have identical key sets."""
import json
import sys
from pathlib import Path

LOCALE = Path(__file__).resolve().parents[1] / "src" / "locales"
LANGS = ["en", "zh-HK", "zh-CN", "es", "hi", "ar", "pt-BR", "fr", "ja", "ru"]


def flatten(d, p=""):
    o = {}
    for k, v in d.items():
        key = f"{p}.{k}" if p else k
        if isinstance(v, dict):
            o.update(flatten(v, key))
        else:
            o[key] = v
    return o


def main() -> int:
    base = flatten(json.loads((LOCALE / "en.json").read_text(encoding="utf-8")))
    ok = True
    for lang in LANGS:
        path = LOCALE / f"{lang}.json"
        if not path.exists():
            print(f"MISSING FILE {lang}")
            ok = False
            continue
        flat = flatten(json.loads(path.read_text(encoding="utf-8")))
        missing = sorted(set(base) - set(flat))
        extra = sorted(set(flat) - set(base))
        same_en = sum(1 for k, v in flat.items() if k in base and v == base[k] and lang not in ("en",))
        print(
            f"{lang:6} leaves={len(flat)} missing={len(missing)} extra={len(extra)} same_as_en={same_en if lang != 'en' else '-'}"
        )
        if missing:
            print("  missing sample:", missing[:8])
            ok = False
        if extra:
            print("  extra sample:", extra[:8])
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
