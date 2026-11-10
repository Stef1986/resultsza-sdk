# ResultsZA MCP server

The official [ResultsZA](https://resultsza.co.za) MCP server. It lets AI assistants such as Claude Desktop, Cursor and VS Code look up South African lottery results, check numbers, read number statistics and get South African horse racing results, using **your own ResultsZA API key**.

Ask your assistant things like:

- "What were last night's Powerball numbers?"
- "Did 5 20 21 36 1 13 win anything in Lotto on Saturday?"
- "Show me the hot and cold numbers for Daily Lotto."
- "Which race meetings were on at Greyville this week?"

More details: [resultsza.co.za/mcp](https://resultsza.co.za/mcp)

## What you need

- Node.js 20 or newer.
- A ResultsZA API key: create a free account at [resultsza.co.za/signup](https://resultsza.co.za/signup), then generate the key in My Dashboard.
- A plan: [resultsza.co.za/api-pricing](https://resultsza.co.za/api-pricing).

## Set it up

### Claude Desktop

Add this to `claude_desktop_config.json` (Settings, Developer, Edit Config), then restart Claude Desktop:

```json
{
  "mcpServers": {
    "resultsza": {
      "command": "npx",
      "args": ["-y", "resultsza-mcp"],
      "env": { "RESULTSZA_API_KEY": "YOUR_API_KEY" }
    }
  }
}
```

### Cursor

Add the same block to `~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project):

```json
{
  "mcpServers": {
    "resultsza": {
      "command": "npx",
      "args": ["-y", "resultsza-mcp"],
      "env": { "RESULTSZA_API_KEY": "YOUR_API_KEY" }
    }
  }
}
```

### VS Code

Add this to `.vscode/mcp.json`. VS Code asks for the key on first start and stores it securely:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "resultsza-api-key",
      "description": "ResultsZA API key",
      "password": true
    }
  ],
  "servers": {
    "resultsza": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "resultsza-mcp"],
      "env": { "RESULTSZA_API_KEY": "${input:resultsza-api-key}" }
    }
  }
}
```

## Tools

All tools are read-only.

| Tool | What it does | Cost |
|---|---|---|
| `get_lottery_results` | Results for South African games (with prize divisions and jackpot), UK 49's, EuroMillions, Irish Lotto, US Powerball, Mega Millions, Kenya, Nigeria, Ghana and Gosloto | 1 call |
| `check_lottery_numbers` | Check up to 10 lines against a South African draw | 1 call |
| `bulk_check_lottery_numbers` | Check up to 500 lines | 1 call per line |
| `get_horse_racing_meetings` | South African race meetings in a date range (up to 7 days) | 1 call |
| `get_horse_racing_card` | All races at a meeting with the top three and tote dividends | 1 call |
| `get_horse_race` | The full runner table for one race | 1 call |
| `generate_lottery_numbers` | Random lines for a game | 1 call |
| `lucky_numbers_from_text` | Numbers from a name or phrase | 1 call |
| `get_number_statistics` | Hot and cold numbers, frequencies or common pairs | 1 call |
| `check_balance` | Your plan, calls used and calls left | Free |

Calls come from your ResultsZA plan, exactly as if you called the API yourself. Badly formed requests (for example a date that is not YYYY-MM-DD, or an unknown game) are rejected before they use a call. A valid request that finds nothing, such as an unknown racecourse, still uses one.

## Privacy and security

- Your API key stays on your machine. It is only ever sent to `https://resultsza.co.za`; the address cannot be changed and redirects are refused.
- The MCP server never writes your key to its logs or returns it in any tool result.
- ResultsZA never sees your conversations with your assistant.
- The server cannot run commands or read or write files on your computer.

## Links

- API documentation: [resultsza.co.za/api_docs](https://resultsza.co.za/api_docs)
- Node and Python SDKs: [github.com/Stef1986/resultsza-sdk](https://github.com/Stef1986/resultsza-sdk)
- Support: info@resultsza.co.za

ResultsZA is an independent service and is not affiliated with the South African National Lottery or any lottery or racing operator.

## License

MIT
