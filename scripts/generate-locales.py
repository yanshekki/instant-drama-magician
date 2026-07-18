#!/usr/bin/env python3
"""
Generate full UI locale JSON files from en.json / zh-HK.json.
- zh-CN: zhconv from zh-HK
- es, hi, ar, pt-BR, fr, ja, ru: Google translate leaf strings (preserves {{vars}})
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

from deep_translator import GoogleTranslator
import zhconv

ROOT = Path(__file__).resolve().parents[1]
LOCALE_DIR = ROOT / "src" / "locales"
CACHE_DIR = ROOT / ".locale-cache"
CACHE_DIR.mkdir(exist_ok=True)

# deep-translator target codes
TARGETS = {
    "es": "es",
    "hi": "hi",
    "ar": "ar",
    "pt-BR": "pt",
    "fr": "fr",
    "ja": "ja",
    "ru": "ru",
}

PLACEHOLDER_RE = re.compile(r"(\{\{[^}]+\}\}|\{[a-zA-Z0-9_]+\})")


def load_json(name: str) -> dict:
    return json.loads((LOCALE_DIR / name).read_text(encoding="utf-8"))


def flatten(d: dict, prefix: str = "") -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = str(v)
    return out


def unflatten(flat: dict[str, str]) -> dict:
    root: dict = {}
    for key, val in flat.items():
        parts = key.split(".")
        cur = root
        for p in parts[:-1]:
            cur = cur.setdefault(p, {})
        cur[parts[-1]] = val
    return root


def protect(s: str) -> tuple[str, list[str]]:
    tokens: list[str] = []

    def repl(m: re.Match) -> str:
        tokens.append(m.group(0))
        return f"⟦{len(tokens) - 1}⟧"

    return PLACEHOLDER_RE.sub(repl, s), tokens


def restore(s: str, tokens: list[str]) -> str:
    out = s
    for i, tok in enumerate(tokens):
        # translators sometimes mess brackets
        for variant in (f"⟦{i}⟧", f"[[{i}]]", f"[{i}]", f"{{{{PH{i}}}}}"):
            if variant in out:
                out = out.replace(variant, tok)
                break
        else:
            # try unicode bracket variants
            out = out.replace(f"⟦ {i} ⟧", tok)
    return out


def load_cache(lang: str) -> dict[str, str]:
    p = CACHE_DIR / f"{lang}.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {}


def save_cache(lang: str, cache: dict[str, str]) -> None:
    p = CACHE_DIR / f"{lang}.json"
    p.write_text(json.dumps(cache, ensure_ascii=False, indent=0), encoding="utf-8")


def translate_flat(
    en_flat: dict[str, str], lang: str, google_code: str
) -> dict[str, str]:
    cache = load_cache(lang)
    translator = GoogleTranslator(source="en", target=google_code)
    out: dict[str, str] = {}
    pending: list[tuple[str, str, list[str]]] = []

    for key, text in en_flat.items():
        if key in cache and cache[key]:
            out[key] = cache[key]
            continue
        # Keep pure technical tokens / empty
        if not text.strip() or text in (
            "OK",
            "FFmpeg",
            "API",
            "BGM",
            "TTS",
            "HTTP",
            "URL",
            "JSON",
            "LLM",
        ):
            out[key] = text
            cache[key] = text
            continue
        protected, tokens = protect(text)
        pending.append((key, protected, tokens))

    print(f"[{lang}] cached={len(out)} to_translate={len(pending)}")

    BATCH = 40
    for i in range(0, len(pending), BATCH):
        chunk = pending[i : i + BATCH]
        texts = [p for _, p, _ in chunk]
        tries = 0
        translated_list: list[str] | None = None
        while tries < 6:
            try:
                if hasattr(translator, "translate_batch"):
                    translated_list = translator.translate_batch(texts)
                else:
                    translated_list = [translator.translate(t) for t in texts]
                break
            except Exception as e:
                tries += 1
                print(f"  batch retry {tries}: {e}")
                time.sleep(1.5 * tries)
        if translated_list is None:
            translated_list = texts

        for (key, protected, tokens), translated in zip(chunk, translated_list):
            if not translated:
                translated = protected
            restored = restore(str(translated), tokens)
            for t in tokens:
                if t not in restored:
                    restored = f"{restored} {t}".strip()
            out[key] = restored
            cache[key] = restored
        save_cache(lang, cache)
        print(f"  [{lang}] {min(i + BATCH, len(pending))}/{len(pending)}")
        time.sleep(0.25)

    save_cache(lang, cache)
    return out


def make_zh_cn(zh_hk: dict) -> dict:
    flat = flatten(zh_hk)
    converted = {k: zhconv.convert(v, "zh-cn") for k, v in flat.items()}
    return unflatten(converted)


def main() -> None:
    en = load_json("en.json")
    zh_hk = load_json("zh-HK.json")
    en_flat = flatten(en)

    # zh-CN
    zh_cn = make_zh_cn(zh_hk)
    (LOCALE_DIR / "zh-CN.json").write_text(
        json.dumps(zh_cn, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("wrote zh-CN.json")

    for lang, gcode in TARGETS.items():
        flat = translate_flat(en_flat, lang, gcode)
        nested = unflatten(flat)
        path = LOCALE_DIR / f"{lang}.json"
        path.write_text(
            json.dumps(nested, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"wrote {path.name} keys={len(flat)}")

    # verify key counts
    for name in ["en", "zh-HK", "zh-CN", *TARGETS.keys()]:
        data = load_json(f"{name}.json")
        n = len(flatten(data))
        print(f"  verify {name}: {n} leaves")


if __name__ == "__main__":
    main()
