#!/usr/bin/env python3
"""Probe Douyin detail API with Chrome cookies and the proposed web signature.

Usage (run manually in Terminal after disabling the proxy):
  /opt/homebrew/Cellar/yt-dlp/2026.8.19/libexec/bin/python -B \
    scripts/probe_douyin_signature.py 7690761477313553841

This makes one metadata request. It does not download a video or print secrets.
The signature formula is an unmerged proposal from yt-dlp issue #9667.
"""

import argparse
import hashlib
import json
import os
import plistlib
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus
from urllib.request import HTTPCookieProcessor, Request, build_opener

from yt_dlp.cookies import extract_cookies_from_browser


SALT = "A96D855A08C0A9707F8BEF0D9A527E4E"
DETAIL_ENDPOINT = "https://www-hj.douyin.com/aweme/v1/web/aweme/detail/"


def check_chrome_cookie_database():
    profile = Path.home() / "Library/Application Support/Google/Chrome/Default"
    try:
        with os.scandir(profile) as entries:
            names = {entry.name for entry in entries}
        if "Cookies" in names:
            return
        if "Network" in names:
            with os.scandir(profile / "Network") as entries:
                if any(entry.name == "Cookies" for entry in entries):
                    return
    except PermissionError as error:
        raise RuntimeError(
            f"macOS denied directory access to {profile}. "
            "Run from the terminal app granted Full Disk Access, then fully quit and reopen that app."
        ) from error
    except FileNotFoundError as error:
        raise RuntimeError(f"Chrome Default profile directory does not exist: {profile}") from error
    raise RuntimeError(f"No Cookies database found in Chrome Default profile: {profile}")


def chrome_user_agent():
    for app in (Path("/Applications/Google Chrome.app"), Path.home() / "Applications/Google Chrome.app"):
        try:
            with (app / "Contents/Info.plist").open("rb") as info_file:
                version = plistlib.load(info_file)["CFBundleShortVersionString"]
            major = int(version.split(".", 1)[0])
            break
        except (OSError, KeyError, ValueError):
            continue
    else:
        raise RuntimeError("Cannot determine Chrome version; check where Google Chrome is installed")
    return (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        f"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{major}.0.0.0 Safari/537.36"
    )


def douyin_uifid(jar):
    for name in ("UIFID", "UIFID_TEMP"):
        for cookie in jar:
            domain = cookie.domain.lstrip(".").lower()
            if (
                cookie.name == name
                and (domain == "douyin.com" or domain.endswith(".douyin.com"))
                and cookie.value
                and not cookie.is_expired()
            ):
                return name, cookie.value
    raise RuntimeError("Chrome Default has no valid Douyin UIFID or UIFID_TEMP cookie")


def url_search_params_value(value):
    # Match JavaScript URLSearchParams: keep '*', encode '~', and use '+' for spaces.
    return quote_plus(value, safe="*").replace("~", "%7E")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video_id", help="numeric ID from a douyin.com/video/ URL")
    args = parser.parse_args()
    if not args.video_id.isascii() or not args.video_id.isdigit():
        parser.error("video_id must contain only ASCII digits")

    check_chrome_cookie_database()
    jar = extract_cookies_from_browser("chrome", "Default")
    cookie_name, uifid = douyin_uifid(jar)
    print(f"UIFID source: {cookie_name} (value hidden)")

    # Timestamp is omitted from the URL and empty in the checksum.
    query = f"aweme_id={args.video_id}&uifid={url_search_params_value(uifid)}"
    signature = hashlib.md5(f"{uifid}__{SALT}_{query}".encode("utf-8")).hexdigest()
    request = Request(
        f"{DETAIL_ENDPOINT}?{query}&x-secsdk-web-signature={signature}",
        headers={
            "User-Agent": chrome_user_agent(),
            "Referer": f"https://www.douyin.com/video/{args.video_id}",
            "Accept": "application/json, text/plain, */*",
        },
    )
    opener = build_opener(HTTPCookieProcessor(jar))
    try:
        with opener.open(request, timeout=20) as response:
            status = response.status
            body = response.read(2_000_000)
    except HTTPError as error:
        status = error.code
        body = error.read(2_000_000)
    except URLError as error:
        print(f"Network error: {type(error.reason).__name__} (no request URL printed)")
        return 2

    print(f"HTTP status: {status}")
    rejection = next(
        (message for message in ("Uifid Not Found", "Signature Not Found", "Sign Invalid")
         if message.encode() in body),
        None,
    )
    if rejection:
        print(f"ArgusSecurityPlugin: {rejection}")
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeDecodeError):
        payload = None
    has_detail = isinstance(payload, dict) and isinstance(payload.get("aweme_detail"), dict)
    print(f"aweme_detail present: {has_detail}")
    return 0 if status == 200 and has_detail else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        raise SystemExit(f"Probe stopped: {error}")
