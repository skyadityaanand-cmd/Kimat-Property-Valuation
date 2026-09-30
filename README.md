# Kimat demo dataset

## Important: this is synthetic data

Kimat does **not** currently read a real property listings dataset, government records, scraped listings, or market feed. The backend creates 40 deterministic demo listings whenever a six-digit pincode is searched. Names, addresses, attributes, and estimated prices are generated for demonstration only; they are not real homes, verified prices, or investment advice.

The CSV/JSON exports here contain the 40 synthetic listings for each pincode used by the app's suggestion chips: `560038`, `411001`, and `560102` (120 rows total). `pincode-insights.json` contains the corresponding aggregates computed from those same records, not a second external dataset.

## Files

- `listings.csv` — flat table; amenities are separated with semicolons
- `listings.json` — same listing rows with amenities represented as arrays
- `pincode-insights.json` — derived market-read values for the three sample pincodes
- `generate-demo-dataset.mjs` — dependency-free Node.js generator that mirrors the backend's deterministic listing and insight generation

## Regenerate for other pincodes

Run with Node.js 20 or later:

```bash
node generate-demo-dataset.mjs 560038 411001 560102
```

The command writes the three data files next to the script by default. Pass `--out <directory>` to choose another output directory:

```bash
node generate-demo-dataset.mjs 560038 --out ./my-data
```

Each pincode always produces 40 repeatable rows. The backend adds query-specific `match_score` values when a user searches; those scores depend on the entered requirements and are not part of this base listings dataset.
