"""Generate the trivia game's UI sound effects as 16-bit PCM WAV files.

Pure standard library (no ffmpeg/lame available). Run from app/:
    python tool/gen_sfx.py
Outputs into assets/sfx/. Sounds are short, gentle, and click-free (each note
gets a linear attack/release envelope).
"""
import math
import os
import struct
import wave

SR = 44100  # sample rate
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sfx")


def _env(i, n, attack=0.01, release=0.06):
    """Linear attack/release envelope in [0,1] to avoid clicks."""
    t = i / SR
    dur = n / SR
    a = min(1.0, t / attack) if attack > 0 else 1.0
    r = min(1.0, (dur - t) / release) if release > 0 else 1.0
    return max(0.0, min(a, r))


def tone(freq, dur, amp=0.4, attack=0.01, release=0.06):
    n = int(SR * dur)
    return [
        amp * _env(i, n, attack, release) * math.sin(2 * math.pi * freq * i / SR)
        for i in range(n)
    ]


def noise(dur, amp=0.35, attack=0.02, release=0.12, seed=1):
    n = int(SR * dur)
    # Deterministic LCG so output is reproducible without importing random state.
    x = seed
    out = []
    for i in range(n):
        x = (1103515245 * x + 12345) & 0x7FFFFFFF
        val = (x / 0x3FFFFFFF) - 1.0  # [-1, 1]
        out.append(amp * _env(i, n, attack, release) * val)
    return out


def seq(*chunks):
    out = []
    for c in chunks:
        out.extend(c)
    return out


def mix(*chunks):
    """Overlay equal-length chunks (sum, then soft-clip)."""
    n = max(len(c) for c in chunks)
    out = [0.0] * n
    for c in chunks:
        for i, v in enumerate(c):
            out[i] += v
    return [max(-1.0, min(1.0, v)) for v in out]


def write(name, samples):
    path = os.path.join(OUT, name)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(struct.pack("<h", int(s * 32767)) for s in samples)
        w.writeframes(frames)
    print(f"wrote {name}  ({len(samples)/SR:.2f}s, {len(frames)} bytes)")


def main():
    os.makedirs(OUT, exist_ok=True)

    # correct: bright rising two-note chime (C5 -> E5 -> G5 sparkle).
    write("correct.wav", seq(
        tone(523.25, 0.10, amp=0.38),
        tone(659.25, 0.10, amp=0.38),
        tone(783.99, 0.16, amp=0.40, release=0.10),
    ))

    # wrong: low descending "nope" (two low tones falling).
    write("wrong.wav", seq(
        tone(196.00, 0.14, amp=0.42),
        tone(146.83, 0.22, amp=0.42, release=0.12),
    ))

    # tick: very short high blip for the countdown.
    write("tick.wav", tone(1046.50, 0.04, amp=0.30, attack=0.002, release=0.02))

    # whoosh: filtered noise burst for transitions.
    write("whoosh.wav", noise(0.26, amp=0.30, attack=0.06, release=0.16))

    # fanfare: ascending arpeggio C-E-G-C for the round result.
    write("fanfare.wav", seq(
        tone(523.25, 0.10, amp=0.38),
        tone(659.25, 0.10, amp=0.38),
        tone(783.99, 0.10, amp=0.38),
        tone(1046.50, 0.26, amp=0.42, release=0.14),
    ))


if __name__ == "__main__":
    main()
