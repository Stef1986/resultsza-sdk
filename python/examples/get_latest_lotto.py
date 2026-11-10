"""Fetch the latest South African Lotto results.

    RESULTSZA_API_KEY=your_key python get_latest_lotto.py

Create a free account at https://resultsza.co.za/signup, then generate your
API key in My Dashboard.
"""
import os

from resultsza import ResultsZA

client = ResultsZA(api_key=os.environ["RESULTSZA_API_KEY"])

# Omit `date` for the most recent draw, or pass "YYYY-MM-DD" for a specific one.
latest = client.get_lotto_results()
print(latest)

# A few more one-liners:
#   client.get_sa_powerball_results()
#   client.get_euromillions_results(date="2026-07-07")
#   client.get_uk49s_results(game="UK49s Lunchtime")
#   client.generate_random_numbers(game="Powerball", lines=5)
#   client.get_hot_cold_numbers(product="Lotto")
#   client.get_gosloto_6_45_results(date="2026-08-06")  # every draw that day
