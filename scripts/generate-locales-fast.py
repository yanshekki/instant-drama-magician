#!/usr/bin/env python3
"""Fast parallel locale generator (multi-lang × multi-string workers)."""
from __future__ import annotations

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import zhconv
from deep_translator import GoogleTranslator

ROOT = Path(__file__).resolve().parents[1]
LOCALE = ROOT / "src" / "locales"
CACHE = ROOT / ".locale-cache"
CACHE.mkdir(exist_ok=True)

TARGETS = [
    ("es", "es"),
    ("hi", "hi"),
    ("ar", "ar"),
    ("pt-BR", "pt"),
    ("fr", "fr"),
    ("ja", "ja"),
    ("ru", "ru"),
]

PH = re.compile(r"(\{\{[^}]+\}\})")


def flatten(d: dict, p: str = "") -> dict[str, str]:
    o: dict[str, str] = {}
    for k, v in d.items():
        key = f"{p}.{k}" if p else k
        if isinstance(v, dict):
            o.update(flatten(v, key))
        else:
            o[key] = str(v)
    return o


def unflatten(flat: dict[str, str]) -> dict:
    root: dict = {}
    for key, val in flat.items():
        parts = key.split(".")
        cur = root
        for part in parts[:-1]:
            cur = cur.setdefault(part, {})
        cur[parts[-1]] = val
    return root


def protect(s: str) -> tuple[str, list[str]]:
    toks: list[str] = []

    def r(m: re.Match) -> str:
        toks.append(m.group(0))
        return f"__PH{len(toks) - 1}__"

    return PH.sub(r, s), toks


def restore(s: str, toks: list[str]) -> str:
    out = s
    for i, t in enumerate(toks):
        out = out.replace(f"__PH{i}__", t).replace(f"__ph{i}__", t)
    return out


def translate_one(tr: GoogleTranslator, text: str) -> str:
    prot, toks = protect(text)
    for attempt in range(5):
        try:
            t = tr.translate(prot) or prot
            t = restore(t, toks)
            for tok in toks:
                if tok not in t:
                    t = f"{t} {tok}".strip()
            return t
        except Exception:
            time.sleep(0.35 * (attempt + 1))
    return text


def do_lang(lang: str, gcode: str, en_flat: dict[str, str]) -> tuple[str, int]:
    cache_path = CACHE / f"{lang}.json"
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    # Thread-local translators avoid client races
    out = dict(cache)
    todo = [k for k in en_flat if not out.get(k)]
    print(
        f"START {lang} todo={len(todo)} cached={len(en_flat) - len(todo)}",
        flush=True,
    )
    if not todo:
        path = LOCALE / f"{lang}.json"
        path.write_text(
            json.dumps(unflatten(out), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"DONE {lang} (cache full) {len(out)}", flush=True)
        return lang, len(out)

    def worker(k: str) -> tuple[str, str]:
        tr = GoogleTranslator(source="en", target=gcode)
        return k, translate_one(tr, en_flat[k])

    done = 0
    with ThreadPoolExecutor(max_workers=16) as pool:
        futs = [pool.submit(worker, k) for k in todo]
        for fut in as_completed(futs):
            try:
                k, val = fut.result()
                out[k] = val
            except Exception as e:
                # Should not happen often
                print(f"  worker err {lang}: {e}", flush=True)
            done += 1
            if done % 100 == 0:
                cache_path.write_text(
                    json.dumps(out, ensure_ascii=False), encoding="utf-8"
                )
                print(f"  {lang} {done}/{len(todo)}", flush=True)

    for k, v in en_flat.items():
        out.setdefault(k, v)
    cache_path.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    (LOCALE / f"{lang}.json").write_text(
        json.dumps(unflatten(out), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"DONE {lang} {len(out)}", flush=True)
    return lang, len(out)


def main() -> None:
    en_flat = flatten(json.loads((LOCALE / "en.json").read_text(encoding="utf-8")))
    zh = flatten(json.loads((LOCALE / "zh-HK.json").read_text(encoding="utf-8")))
    zh_cn = {k: zhconv.convert(v, "zh-cn") for k, v in zh.items()}
    (LOCALE / "zh-CN.json").write_text(
        json.dumps(unflatten(zh_cn), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("zh-CN ok", len(zh_cn), flush=True)

    # 4 languages in parallel
    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = [
            pool.submit(do_lang, lang, code, en_flat) for lang, code in TARGETS
        ]
        for f in as_completed(futs):
            print("finished", f.result(), flush=True)

    print("ALL OK", flush=True)
    for name in ["en", "zh-HK", "zh-CN"] + [t[0] for t in TARGETS]:
        n = len(
            flatten(
                json.loads((LOCALE / f"{name}.json").read_text(encoding="utf-8"))
            )
        )
        print(name, n, flush=True)


if __name__ == "__main__":
    main()
