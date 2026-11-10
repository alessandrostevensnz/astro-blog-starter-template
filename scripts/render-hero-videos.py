#!/usr/bin/env python3
"""Generate three native 1080p, 8-second site-header MP4s from the current CMS hero photos.

Uses only the repository's source photographs: no low-resolution GIF frames.
Sky movement is limited to distant sky; foliage movement is limited to green leaves.
Buildings, joinery, scaffolding, and other structural details remain stationary.
"""
import json
import math
import os
import subprocess
from pathlib import Path
from urllib.parse import unquote

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
W, H, FPS, N = 1920, 1080, 24, 192


def image_source(kind):
    data = json.loads((ROOT / "content" / "pages" / (kind + ".json")).read_text())
    url = data["photos"]["hero"]["src"]
    if not url.startswith("/images/"):
        raise ValueError("Expected a local /images/ hero: " + url)
    path = ROOT / "public" / unquote(url.lstrip("/"))
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def fit(frame):
    h, w = frame.shape[:2]
    scale = max(W / w, H / h)
    nw, nh = math.ceil(w * scale), math.ceil(h * scale)
    interpolation = cv2.INTER_LANCZOS4 if scale > 1 else cv2.INTER_AREA
    frame = cv2.resize(frame, (nw, nh), interpolation=interpolation)
    x, y = (nw - W) // 2, (nh - H) // 2
    return frame[y:y + H, x:x + W].copy()


def sky_mask(frame):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    candidate = ((h >= 88) & (h <= 129) & (s >= 37) & (v >= 75)).astype("uint8")
    candidate = cv2.morphologyEx(candidate, cv2.MORPH_CLOSE, np.ones((19, 19), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, 8)
    result = np.zeros((H, W), np.uint8)
    if count > 1:
        largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        result[labels == largest] = 255
        outlines, _ = cv2.findContours(result, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(result, outlines, -1, 255, -1)
        result = cv2.erode(result, np.ones((43, 43), np.uint8), iterations=1)
        result = cv2.GaussianBlur(result, (0, 0), 12)
    return (result.astype(np.float32) / 255)[..., None]


def foliage_mask(frame):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    greenery = ((h >= 28) & (h <= 91) & (s >= 30) & (v >= 38)).astype(np.uint8) * 255
    limit = np.zeros((H, W), np.uint8)
    # Local to the exact original About photo's exterior tree and windowsill leaves.
    limit[410:627, 1060:1187] = 255
    limit[563:700, 746:909] = 255
    greenery = cv2.bitwise_and(greenery, limit)
    return (cv2.GaussianBlur(greenery, (0, 0), 2.4).astype(np.float32) / 255)[..., None]


def blend(base, moving, mask):
    if not mask.any():
        return base.copy()
    return np.clip(base.astype(np.float32) * (1 - mask) +
                   moving.astype(np.float32) * mask, 0, 255).astype(np.uint8)


def encode(kind):
    image = cv2.imread(str(image_source(kind)), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Cannot read hero photograph: " + kind)
    base = fit(image)
    region = foliage_mask(base) if kind == "about" else sky_mask(base)
    if kind == "about":
        xmap, ymap = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    out = ROOT / "public" / "images" / ("andro-" + kind + "-1080p-8s.mp4")
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
           "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", "1920x1080",
           "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
           "-preset", "veryfast", "-crf", "20", "-maxrate", "4500k",
           "-bufsize", "9000k", "-pix_fmt", "yuv420p", "-profile:v",
           "high", "-level", "4.2", "-movflags", "+faststart", str(out)]
    with subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE) as proc:
        for index in range(N):
            phase = index / N
            if kind == "about":
                horizontal = 2.8 * np.sin(2 * math.pi * phase + ymap * .033)
                horizontal += .35 * np.sin(4 * math.pi * phase + ymap * .015)
                vertical = .95 * np.sin(2 * math.pi * phase + xmap * .019)
                moving = cv2.remap(base, (xmap + horizontal).astype(np.float32),
                                   (ymap + vertical).astype(np.float32),
                                   cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
            else:
                amount = 21 if kind == "maintenance" else 17
                dx = amount * math.sin(2 * math.pi * phase)
                dy = 2 * math.sin(2 * math.pi * phase + .4)
                moving = cv2.warpAffine(base, np.float32([[1, 0, dx], [0, 1, dy]]),
                                        (W, H), flags=cv2.INTER_LINEAR,
                                        borderMode=cv2.BORDER_REFLECT_101)
            frame = blend(base, moving, region)
            bright = 1 + (.006 if kind == "about" else .009) * (
                math.sin(2 * math.pi * phase + .3) - math.sin(.3))
            frame = np.clip(frame.astype(np.float32) * bright, 0, 255).astype(np.uint8)
            cam_x = (1.7 if kind == "about" else 2.7) * math.sin(2 * math.pi * phase)
            cam_y = .9 * (math.sin(2 * math.pi * phase + .7) - math.sin(.7))
            scale = 1.009 + .002 * (1 - math.cos(2 * math.pi * phase))
            affine = cv2.getRotationMatrix2D((W / 2, H / 2), 0, scale)
            affine[0, 2] += cam_x
            affine[1, 2] += cam_y
            frame = cv2.warpAffine(frame, affine, (W, H), flags=cv2.INTER_LINEAR,
                                   borderMode=cv2.BORDER_REFLECT_101)
            proc.stdin.write(frame.tobytes())
        proc.stdin.close()
        output = proc.stderr.read().decode("utf8", errors="replace")
        if proc.wait():
            raise RuntimeError("Video encoding failed: " + output[-2000:])
    if out.stat().st_size < 100_000:
        raise RuntimeError("Unexpectedly small MP4: " + str(out))
    print(kind, str(out), out.stat().st_size, "bytes", flush=True)


if __name__ == "__main__":
    for name in ("about", "construction", "maintenance"):
        encode(name)
