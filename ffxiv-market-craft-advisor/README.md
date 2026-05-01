# FFXIV Market Craft Advisor

A static GitHub Pages site for comparing whether it is better to sell an ingredient raw, or craft it into a higher-value item and sell that instead.

## Files

- `index.html` — main site page
- `styles.css` — styling for the form and results
- `script.js` — pricing data, recipes, and profit comparison logic

## Usage

1. Open `index.html` in a browser or host this folder with GitHub Pages.
2. Select your datacenter.
3. Enter the ingredient you own and the quantity.
4. View the recommended option.

## Live pricing

This site resolves item IDs through XIVAPI and fetches live market prices from Universalis. No manual price file is required.

## Supported ingredients

The current recipe set supports Honey, White Pepper, Raw Culinary Fish, and Egg. You can extend the recipe list in `script.js` to add more ingredients and crafts.
