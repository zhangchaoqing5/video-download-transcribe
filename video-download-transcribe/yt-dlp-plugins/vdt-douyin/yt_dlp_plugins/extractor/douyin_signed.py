"""Project-local Douyin detail request compatibility for yt-dlp.

The request shape and checksum were verified with the project's Douyin probes.
See https://github.com/yt-dlp/yt-dlp/issues/9667 for the upstream discussion.
"""

import hashlib
import plistlib
import sys
from pathlib import Path
from urllib.parse import quote_plus

from yt_dlp.extractor.tiktok import DouyinIE
from yt_dlp.utils import ExtractorError


_SALT = "A96D855A08C0A9707F8BEF0D9A527E4E"
_DETAIL_ENDPOINT = "https://www-hj.douyin.com/aweme/v1/web/aweme/detail/"


def _chrome_user_agent():
    if sys.platform != "darwin":
        return None
    for app in (Path("/Applications/Google Chrome.app"), Path.home() / "Applications/Google Chrome.app"):
        try:
            with (app / "Contents/Info.plist").open("rb") as info_file:
                version = plistlib.load(info_file)["CFBundleShortVersionString"]
            major = int(version.split(".", 1)[0])
            return (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                f"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{major}.0.0.0 Safari/537.36"
            )
        except (OSError, KeyError, ValueError):
            continue
    return None


def _encoded(value):
    return quote_plus(value, safe="*").replace("~", "%7E")


# The private subclass replaces yt-dlp's DouyinIE without appearing as a second extractor.
class _VdtDouyinIE(DouyinIE, plugin_name="vdt_douyin"):
    def _real_extract(self, url):
        video_id = self._match_id(url)
        cookies = self._get_cookies(self._WEBPAGE_HOST)
        uifid = next((cookies[name].value for name in ("UIFID", "UIFID_TEMP") if name in cookies), None)
        if not uifid:
            return super()._real_extract(url)

        query = f"aweme_id={video_id}&uifid={_encoded(uifid)}"
        signature = hashlib.md5(f"{uifid}__{_SALT}_{query}".encode("utf-8")).hexdigest()
        user_agent = _chrome_user_agent()
        headers = {
            "Referer": f"https://www.douyin.com/video/{video_id}",
            "Accept": "application/json, text/plain, */*",
        }
        if user_agent:
            headers["User-Agent"] = user_agent

        payload = self._download_json(
            f"{_DETAIL_ENDPOINT}?{query}&x-secsdk-web-signature={signature}",
            video_id, "Downloading signed Douyin detail JSON", headers=headers,
        )
        detail = payload.get("aweme_detail") if isinstance(payload, dict) else None
        if not isinstance(detail, dict):
            raise ExtractorError("Signed Douyin detail response did not contain video data", expected=True)

        info = self._parse_aweme_video_app(detail)
        # yt-dlp keeps its format selection, progress, and file naming; use the
        # headers that also worked for the CDN download in the probe.
        info["http_headers"] = {
            "Referer": "https://www.douyin.com/",
            **({"User-Agent": user_agent} if user_agent else {}),
        }
        return info
