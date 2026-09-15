#!/usr/bin/env python3
"""Render the shared cue recipes to WAV files for the mobile app.

The web client synthesises these live with Web Audio. React Native has no
oscillator, so mobile plays files instead — and they have to come from the same
table, or the two platforms slowly stop sounding alike.

Run after editing packages/shared/src/cue-recipes.json:

    python3 mobile/scripts/gen-cue-sounds.py

The envelope and sweep maths below mirror Web Audio's
`exponentialRampToValueAtTime` exactly, so a rendered file and a browser-
synthesised cue are the same sound.
"""

import json
import math
import pathlib
import struct
import wave

RATE = 44100
# Web peaks are authored for a shared context and are quiet on their own. One
# gain applied to every cue keeps them audible while preserving the relative
# loudness the table intends (a missed answer is meant to sit above the rest).
TARGET_PEAK = 0.89
ATTACK = 0.015
# Web Audio cannot ramp to zero, so the recipes floor at this value.
FLOOR = 0.0001
TAIL = 0.02

ROOT = pathlib.Path(__file__).resolve().parents[2]
RECIPES = ROOT / "packages/shared/src/cue-recipes.json"
OUT = ROOT / "mobile/assets/sounds"


def osc(kind: str, phase: float) -> float:
    """One sample of the waveform at `phase` turns, matching OscillatorType."""
    frac = phase - math.floor(phase)
    if kind == "sine":
        return math.sin(2 * math.pi * frac)
    # Triangle: +1 at a quarter turn, -1 at three quarters.
    if frac < 0.25:
        return 4 * frac
    if frac < 0.75:
        return 2 - 4 * frac
    return 4 * frac - 4


def phase_at(t: float, f0: float, f1: float, dur: float) -> float:
    """Integral of an exponential frequency glide, in turns."""
    if f1 == f0:
        return f0 * t
    ratio = f1 / f0
    return f0 * dur / math.log(ratio) * (ratio ** (t / dur) - 1)


def gain_at(t: float, peak: float, dur: float) -> float:
    """The recipes' attack-then-decay envelope, both ramps exponential."""
    if t < ATTACK:
        return FLOOR * (peak / FLOOR) ** (t / ATTACK)
    if dur <= ATTACK:
        return peak
    return peak * (FLOOR / peak) ** ((t - ATTACK) / (dur - ATTACK))


def render(partials: list[dict]) -> list[float]:
    length = max(p["at"] + p["dur"] for p in partials) + TAIL
    buf = [0.0] * int(length * RATE)
    for p in partials:
        f0 = float(p["freq"])
        f1 = float(p.get("sweepTo", f0))
        dur = float(p["dur"])
        start = int(float(p["at"]) * RATE)
        for i in range(int(dur * RATE)):
            t = i / RATE
            sample = osc(p["type"], phase_at(t, f0, f1, dur)) * gain_at(t, float(p["peak"]), dur)
            if start + i < len(buf):
                buf[start + i] += sample
    return buf


def write_wav(path: pathlib.Path, samples: list[float]) -> None:
    with wave.open(str(path), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        frames = b"".join(
            struct.pack("<h", max(-32768, min(32767, int(s * 32767)))) for s in samples
        )
        f.writeframes(frames)


def main() -> None:
    recipes = json.loads(RECIPES.read_text())
    rendered = {name: render(partials) for name, partials in recipes.items()}

    # One shared scale factor, not per-file normalisation, so the cues keep
    # their intended balance against each other.
    loudest = max(max(abs(s) for s in buf) for buf in rendered.values())
    scale = TARGET_PEAK / loudest

    OUT.mkdir(parents=True, exist_ok=True)
    for name, buf in rendered.items():
        path = OUT / f"{name}.wav"
        write_wav(path, [s * scale for s in buf])
        print(f"{name:22} {len(buf) / RATE:.2f}s  {path.stat().st_size // 1024}KB")
    print(f"\nshared gain x{scale:.2f} (loudest raw peak {loudest:.3f})")


if __name__ == "__main__":
    main()
