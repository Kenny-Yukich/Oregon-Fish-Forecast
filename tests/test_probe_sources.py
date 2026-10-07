"""Offline fixture tests; these do not establish successful live API delivery."""
import unittest
from datetime import datetime, timezone

from probe_sources import inspect_nws, inspect_usgs, numeric, utc_time, validate_url

NOW = datetime(2026, 10, 7, 12, 0, tzinfo=timezone.utc)


def usgs_payload(value="4120", unit="ft3/s", observed="2026-10-07T11:45:00Z", station="USGS-14092500"):
    return {"features": [{"properties": {
        "monitoring_location_id": station, "parameter_code": "00060",
        "time_series_id": "fixture-only-series", "value": value,
        "unit_of_measure": unit, "time": observed, "approval_status": "Provisional",
        "qualifier": None,
    }}], "links": []}


class SmokeTestHelpers(unittest.TestCase):
    def test_real_zero_is_not_missing(self):
        self.assertEqual(numeric("0"), 0.0)

    def test_missing_invalid_and_nonfinite_are_not_numbers(self):
        for value in (None, "", "  ", "Ice", "NaN", float("inf"), True):
            with self.subTest(value=value):
                self.assertIsNone(numeric(value))

    def test_offset_is_preserved_as_an_instant(self):
        self.assertEqual(utc_time("2026-10-07T05:00:00-07:00"), NOW)

    def test_naive_timestamp_rejected(self):
        with self.assertRaises(ValueError):
            utc_time("2026-10-07T12:00:00")

    def test_measurement_age_not_download_age(self):
        record = inspect_usgs(usgs_payload(), "USGS-14092500", NOW)["records"][0]
        self.assertEqual(record["age_minutes"], 15.0)
        self.assertEqual(record["approval_status"], "Provisional")

    def test_old_record_retains_old_age(self):
        result = inspect_usgs(usgs_payload(observed="2026-10-01T12:00:00Z"), "USGS-14092500", NOW)
        self.assertEqual(result["records"][0]["age_minutes"], 8640)
        self.assertNotIn("live", result)

    def test_non_numeric_flag_is_explicit(self):
        record = inspect_usgs(usgs_payload(value="Ice"), "USGS-14092500", NOW)["records"][0]
        self.assertIsNone(record["numeric_value"])
        self.assertIn("non_numeric_or_missing_value", record["issues"])

    def test_future_timestamp_is_flagged(self):
        result = inspect_usgs(usgs_payload(observed="2026-10-08T12:00:00Z"), "USGS-14092500", NOW)
        self.assertIn("source_timestamp_in_future", result["records"][0]["issues"])

    def test_missing_unit_is_not_guessed(self):
        record = inspect_usgs(usgs_payload(unit=None), "USGS-14092500", NOW)["records"][0]
        self.assertIn("missing_unit", record["issues"])

    def test_wrong_station_rejected(self):
        with self.assertRaises(ValueError):
            inspect_usgs(usgs_payload(station="USGS-14076500"), "USGS-14092500", NOW)

    def test_empty_features_rejected(self):
        with self.assertRaises(ValueError):
            inspect_usgs({"features": [], "links": []}, "USGS-14092500", NOW)

    def test_pagination_cannot_be_mistaken_for_complete(self):
        data = usgs_payload()
        data["links"] = [{"rel": "next", "href": "https://api.waterdata.usgs.gov/next"}]
        with self.assertRaises(ValueError):
            inspect_usgs(data, "USGS-14092500", NOW)

    def test_no_cross_provider_or_insecure_url(self):
        for url in ("https://example.com/", "http://api.weather.gov/", "https://user:pw@api.weather.gov/"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                validate_url(url)
        with self.assertRaises(ValueError):
            validate_url("https://api.weather.gov/", "api.waterdata.usgs.gov")

    def test_valid_source_url(self):
        url = "https://api.weather.gov/gridpoints/PDT/1,2/forecast/hourly"
        self.assertEqual(validate_url(url, "api.weather.gov"), url)

    def test_weather_times_and_issue_age(self):
        payload = {"properties": {"updateTime": "2026-10-07T10:00:00Z", "periods": [{
            "startTime": "2026-10-07T05:00:00-07:00", "endTime": "2026-10-07T06:00:00-07:00",
            "temperature": 52, "temperatureUnit": "F",
        }]}}
        result = inspect_nws(payload, NOW)
        self.assertEqual(result["issue_age_minutes"], 120)
        self.assertEqual(result["period_count"], 1)

    def test_weather_empty_rejected(self):
        with self.assertRaises(ValueError):
            inspect_nws({"properties": {"periods": []}}, NOW)

    def test_weather_reversed_interval_rejected(self):
        payload = {"properties": {"periods": [{"startTime": "2026-10-07T13:00:00Z", "endTime": "2026-10-07T12:00:00Z"}]}}
        with self.assertRaises(ValueError):
            inspect_nws(payload, NOW)


if __name__ == "__main__":
    unittest.main()
