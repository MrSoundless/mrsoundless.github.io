# FFXIV Market Craft Advisor

A static GitHub Pages site for comparing whether it is better to sell an ingredient raw, craft it into a higher-value item, or exchange Crafters'/Gatherers' Scrip for a marketable reward.

## Files

- `index.html` — main site page
- `styles.css` — styling for the form and results
- `script.js` — pricing data, recipes, and profit comparison logic

## Usage

1. Open `index.html` in a browser or host this folder with GitHub Pages.
2. Select your datacenter.
3. Enter the ingredient you own and the quantity.
4. View the recommended option.

For scrip, choose Crafters' or Gatherers' Scrip, select Orange or Purple, choose a specific world, and enter the amount you own. You can rank exchange rewards for direct sale or rank craftable items that use those rewards after paying for their other ingredients.

## Live pricing

This site resolves item IDs through XIVAPI and fetches live market prices from Universalis. It compares current listings against recent sale history for every item, falls back to recent sale prices when an item is sold out, and ignores obviously inflated listings when they are far above what players have actually been paying. No manual price file is required.

## Scrip exchange data

Marketable Crafters' and Gatherers' Scrip rewards and exchange costs are discovered from XIVAPI's live `SpecialShop` game data. Live prices and recent sales are loaded from Universalis. Both Orange and Purple Scrip are supported, with no hardcoded reward catalog.
