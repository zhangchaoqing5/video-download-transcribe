#!/usr/bin/env python3
"""Download one Douyin video using the signed detail request, then verify it with ffprobe.

Run manually from Terminal after disabling the proxy. This script does not alter VDT.
"""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPCookieProcessor, Request, build_opener

from yt_dlp.cookies import extract_cookies_from_browser

from probe_douyin_signature import (
    DETAIL_ENDPOINT,
    SALT,
    check_chrome_cookie_database,
    chrome_user_agent,
    douyin_uifid,
    url_search_params_value,
)


def video_urls(detail):
    video = detail.get("video") or {}
    addresses = [video.get(key) for key in ("play_addr", "play_addr_h264", "download_addr")]
    addresses.extend(item.get("play_addr") for item in (video.get("bit_rate") or []) if isinstance(item, dict))
    urls = []
    for address in addresses:
        if not isinstance(address, dict):
            continue
        for url in address.get("url_list") or []:
            if isinstance(url, str) and urlsplit(url).scheme in ("http", "https") and url not in urls:
                urls.append(url)
    # Direct CDN links are more likely to work than Douyin API play links.
    return sorted(urls, key=lambda url: "aweme/v1" in urlsplit(url).path)


def download_and_verify(opener, url, output, user_agent, ffprobe):
    request = Request(url, headers={
        "User-Agent": user_agent,
        "Referer": "https://www.douyin.com/",
        "Accept": "*/*",
    })
    with tempfile.NamedTemporaryFile(prefix="douyin-probe-", suffix=".part", dir=output.parent, delete=False) as file:
        temp_path = Path(file.name)
        try:
            with opener.open(request, timeout=30) as response:
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}")
                expected = response.headers.get("Content-Length")
                total = 0
                while chunk := response.read(1024 * 1024):
                    file.write(chunk)
                    total += len(chunk)
            if total == 0 or (expected and total != int(expected)):
                raise RuntimeError("empty or incomplete response")
            file.flush()
            result = subprocess.run(
                [ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name",
                 "-of", "default=noprint_wrappers=1:nokey=1", str(temp_path)],
                capture_output=True, text=True, timeout=30, check=False,
            )
            codec = result.stdout.strip()
            if result.returncode != 0 or not codec:
                raise RuntimeError("ffprobe found no playable video stream")
            os.link(temp_path, output)  # Fails instead of overwriting an existing file.
            return total, codec
        finally:
            temp_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video_id", help="numeric ID from a douyin.com/video/ URL")
    parser.add_argument("--output", type=Path, help="output MP4 path (default: ~/Downloads/douyin-probe-ID.mp4)")
    args = parser.parse_args()
    if not args.video_id.isascii() or not args.video_id.isdigit():
        parser.error("video_id must contain only ASCII digits")

    output = (args.output or Path.home() / "Downloads" / f"douyin-probe-{args.video_id}.mp4").expanduser()
    if not output.parent.is_dir():
        parser.error(f"output directory does not exist: {output.parent}")
    if output.exists():
        parser.error(f"output already exists; choose a different --output: {output}")
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        parser.error("ffprobe is required to verify the downloaded video; it was not found on PATH")

    check_chrome_cookie_database()
    jar = extract_cookies_from_browser("chrome", "Default")
    cookie_name, uifid = douyin_uifid(jar)
    print(f"UIFID source: {cookie_name} (value hidden)", flush=True)

    query = f"aweme_id={args.video_id}&uifid={url_search_params_value(uifid)}"
    signature = hashlib.md5(f"{uifid}__{SALT}_{query}".encode("utf-8")).hexdigest()
    user_agent = chrome_user_agent()
    opener = build_opener(HTTPCookieProcessor(jar))
    request = Request(
        f"{DETAIL_ENDPOINT}?{query}&x-secsdk-web-signature={signature}",
        headers={"User-Agent": user_agent, "Referer": f"https://www.douyin.com/video/{args.video_id}",
                 "Accept": "application/json, text/plain, */*"},
    )
    try:
        with opener.open(request, timeout=20) as response:
            payload = json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"detail request: HTTP {error.code}") from None
    except (URLError, ValueError) as error:
        raise RuntimeError(f"detail request failed: {type(error).__name__}") from None
    detail = payload.get("aweme_detail") if isinstance(payload, dict) else None
    if not isinstance(detail, dict):
        raise RuntimeError("detail request returned no aweme_detail")
    urls = video_urls(detail)
    if not urls:
        raise RuntimeError("detail response contains no video play URLs")
    print(f"Detail: OK; trying {min(len(urls), 6)} video source(s)", flush=True)

    for index, url in enumerate(urls[:6], 1):
        try:
            size, codec = download_and_verify(opener, url, output, user_agent, ffprobe)
        except HTTPError as error:
            print(f"Source {index}: HTTP {error.code}", flush=True)
        except (URLError, RuntimeError, OSError, ValueError, subprocess.TimeoutExpired) as error:
            print(f"Source {index}: {type(error).__name__}: {error if isinstance(error, RuntimeError) else 'request failed'}", flush=True)
        else:
            print(f"SUCCESS: {output} ({size:,} bytes; video codec: {codec})")
            return 0
    raise RuntimeError("no source produced a complete video that ffprobe can read")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        raise SystemExit(f"Probe stopped: {error}")
