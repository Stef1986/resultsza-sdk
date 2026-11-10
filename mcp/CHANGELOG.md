# Changelog

All notable changes to the ResultsZA MCP server are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Releases are tagged `mcp-vX.Y.Z`.

## [0.1.0]

### Added

- First release: a stdio MCP server built on `resultsza-sdk`, with ten read-only tools:
  `get_lottery_results`, `check_lottery_numbers`, `bulk_check_lottery_numbers`,
  `get_horse_racing_meetings`, `get_horse_racing_card`, `get_horse_race`,
  `generate_lottery_numbers`, `lucky_numbers_from_text`, `get_number_statistics` and `check_balance`.
- Uses your own ResultsZA API key from `RESULTSZA_API_KEY`. The key is never logged or returned,
  and the server only ever talks to https://resultsza.co.za.
