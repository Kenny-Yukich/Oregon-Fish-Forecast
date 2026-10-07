#!/usr/bin/env python3
"""Non-mutating USGS v1 / NWS adapter smoke test. No third-party dependencies.

See BUILD_BRIEF.md for sources. A received record is not necessarily fresh or
representative of a fishing reach. This script does not predict fishing quality.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

USER_AGENT = "OregonFishForecast-development (oregonfishforecast.com)"
ALLOWED_HOSTS = {"api.waterdata.usgs.gov", "api.weather.gov"}
PARAMETERS = {"00060": "discharge", "00065": "gauge_height", "00010": "water_temperature"}
MAX_BYTES = 8 * 1024 * 1024


def validate_url(url: str, expected_host: str | None = None) -> str:
    parts = urlsplit(url)
    if (parts.scheme != "https" or parts.hostname not in ALLOWED_HOSTS
            or parts.username or parts.password or parts.port not in (None, 443)
            or (expected_host is not None and parts.hostname != expected_host)):
        raise ValueError("Refusing an unapproved source URL")
    return url


class SameHostRedirects(HTTPRedirectHandler):
    def redirect_request(self, req: Request, fp: Any, code: int, msg: str,
                         headers: Any, newurl: str) -> Request | None:
        validate_url(newurl, urlsplit(req.full_url).hostname)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def utc_time(value: str) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Missing timestamp")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Timestamp has no timezone")
    return parsed.astimezone(timezone.utc)


def numeric(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, str) and not value.strip():
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def get_json(url: str, api_key: str | None = None) -> dict[str, Any]:
    validate_url(url)
    headers = {"User-Agent": USER_AGENT, "Accept": "application/geo+json, application/json"}
    if api_key:
        if urlsplit(url).hostname != "api.waterdata.usgs.gov":
            raise ValueError("A USGS key cannot be sent to another host")
        headers["X-Api-Key"] = api_key
    opener = build_opener(SameHostRedirects())
    for attempt in range(3):
        try:
            with opener.open(Request(url, headers=headers), timeout=15) as response:
                body = response.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                raise ValueError("Source payload exceeds the smoke-test size limit")
            data = json.loads(body)
            if not isinstance(data, dict):
                raise ValueError("Expected a JSON object")
            return data
        except HTTPError as error:
            # Do not expose response bodies/headers that might contain secrets.
            if error.code in (429, 500, 502, 503, 504) and attempt < 2:
                retry = error.headers.get("Retry-After", "")
                delay = float(retry) if retry.isdigit() else 2 ** attempt
                # A long/date-form Retry-After should be respected by stopping,
                # not by retrying earlier than the provider requested.
                if retry and (not retry.isdigit() or delay > 5):
                    raise RuntimeError(f"HTTP {error.code}; retry later as requested by source") from None
                time.sleep(delay)
                continue
            raise RuntimeError(f"Source HTTP {error.code}") from None
        except (URLError, TimeoutError, OSError):
            raise RuntimeError("Source connection failed; check DNS/network access") from None
    raise RuntimeError("Source request did not complete")


def inspect_usgs(data: dict[str, Any], station: str, retrieved: datetime) -> dict[str, Any]:
    features = data.get("features")
    if not isinstance(features, list):
        raise ValueError("USGS response lacks a features array")
    if any(link.get("rel") == "next" for link in data.get("links", []) if isinstance(link, dict)):
        raise ValueError("USGS response is paginated; extend the adapter before treating it as complete")
    records: list[dict[str, Any]] = []
    for feature in features:
        props = feature.get("properties", {})
        if props.get("monitoring_location_id") != station:
            raise ValueError("USGS returned a different monitoring location")
        parameter = props.get("parameter_code")
        if parameter not in PARAMETERS:
            continue
        observed = utc_time(props.get("time"))
        value = numeric(props.get("value"))
        unit = props.get("unit_of_measure")
        issues = []
        if value is None:
            issues.append("non_numeric_or_missing_value")
        if not unit:
            issues.append("missing_unit")
        if observed > retrieved:
            issues.append("source_timestamp_in_future")
        records.append({
            "parameter_code": parameter, "parameter": PARAMETERS[parameter],
            "time_series_id": props.get("time_series_id"),
            "raw_value": props.get("value"), "numeric_value": value,
            "raw_unit": unit, "observed_at": observed.isoformat(),
            "age_minutes": round((retrieved - observed).total_seconds() / 60, 1),
            "approval_status": props.get("approval_status"),
            "qualifiers": props.get("qualifier"), "issues": issues,
        })
    if not records:
        raise ValueError("No target USGS parameter records were returned")
    return {
        "read_status": "received", "station_id": station,
        "retrieved_at": retrieved.isoformat(), "records": records,
        "warning": "No freshness, unit normalization, sensor-selection, or reach-representativeness approval implied.",
    }


def inspect_nws(data: dict[str, Any], retrieved: datetime) -> dict[str, Any]:
    props = data.get("properties", {})
    periods = props.get("periods")
    if not isinstance(periods, list) or not periods:
        raise ValueError("NWS response lacks hourly periods")
    for period in periods:
        if utc_time(period.get("endTime")) <= utc_time(period.get("startTime")):
            raise ValueError("NWS period has an invalid time interval")
    issue = props.get("updateTime") or props.get("updated") or props.get("generatedAt")
    issue_age = None
    if issue:
        issue_age = round((retrieved - utc_time(issue)).total_seconds() / 60, 1)
    return {
        "read_status": "received", "retrieved_at": retrieved.isoformat(),
        "issued_at": issue, "issue_age_minutes": issue_age,
        "period_count": len(periods), "sample_periods": periods[:6],
        "warning": "Forecast periods are not observations or a fishing forecast; freshness still requires review.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--station", default="USGS-14092500")
    parser.add_argument("--latitude", type=float, default=44.7259522504172)
    parser.add_argument("--longitude", type=float, default=-121.246993886344)
    parser.add_argument("--output", type=Path, default=Path("source-check.json"))
    args = parser.parse_args()
    if not re.fullmatch(r"USGS-\d{8,15}", args.station):
        parser.error("station must be USGS- followed by 8–15 digits")
    if not (-90 <= args.latitude <= 90 and -180 <= args.longitude <= 180):
        parser.error("invalid latitude/longitude")
    report: dict[str, Any] = {
        "mode": "source_connectivity_and_shape_check",
        "not_a_fishing_forecast": True,
        "weather_point_note": "Default coordinates are the gauge location, not an approved fishing access or reach weather point.",
        "sources": {},
    }
    latest_url = "https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items?" + urlencode({
        "monitoring_location_id": args.station, "f": "json", "limit": 100,
    })
    try:
        data = get_json(latest_url, os.environ.get("USGS_API_KEY"))
        report["sources"]["usgs"] = {"url": latest_url, **inspect_usgs(data, args.station, datetime.now(timezone.utc))}
    except (RuntimeError, ValueError, KeyError, TypeError, AttributeError) as error:
        report["sources"]["usgs"] = {"read_status": "failed", "error": str(error)}
    point_url = f"https://api.weather.gov/points/{args.latitude:.4f},{args.longitude:.4f}"
    try:
        point = get_json(point_url)
        hourly_url = validate_url(point["properties"]["forecastHourly"], "api.weather.gov")
        data = get_json(hourly_url)
        report["sources"]["nws"] = {"point_url": point_url, "hourly_url": hourly_url,
                                     **inspect_nws(data, datetime.now(timezone.utc))}
    except (RuntimeError, ValueError, KeyError, TypeError, AttributeError) as error:
        report["sources"]["nws"] = {"read_status": "failed", "error": str(error)}
    report["completed_at"] = datetime.now(timezone.utc).isoformat()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}")
    complete = all(result["read_status"] == "received" for result in report["sources"].values())
    print("Records received; inspect timestamps and metadata before use." if complete
          else "One or more source checks failed. No data was invented; inspect the output.")
    return 0 if complete else 2


if __name__ == "__main__":
    sys.exit(main())
