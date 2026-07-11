"""List race meetings, then pull a full race card and a single race.

    RESULTSZA_API_KEY=your_key python horse_racing_racecard.py
"""
import os

from resultsza import ResultsZA

client = ResultsZA(api_key=os.environ["RESULTSZA_API_KEY"])

# Meetings default to the last 7 days. The span may not exceed 7 days - the
# client validates this before calling so you don't waste an API call.
meetings = client.get_horse_racing_meetings()
print(meetings)

# Replace date/venue with a real meeting from the list above.
racecard = client.get_horse_racing_results(date="2026-07-08", venue="Greyville")
print(racecard)

# A single race's full runner table (race_no is 1-based).
race = client.get_horse_racing_race(date="2026-07-08", venue="Greyville", race_no=1)
print(race)
