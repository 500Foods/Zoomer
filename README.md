# Zoomer: Smart Per-Page Zoom for Firefox <img src="icons/zoomer-48.png" align="right">

Ever visit a website where some pages need different zoom levels? Zoomer remembers your preferred zoom level for each page, automatically adjusting as you browse. Unlike other zoom extensions that only work at the domain level, Zoomer gives you precise control down to specific pages within the same website.

## 🌟 Key Features

- **Page-Level Zoom Control**: Set different zoom levels for different pages on the same website
- **Smart URL Matching**: Customize how specific you want the URL matching to be (domain, path, query parameters)
- **Automatic Adjustment**: Zoom levels change instantly as you navigate
- **Import/Export Settings**: Easily backup or transfer your zoom preferences
- **Privacy Focused**: Works in private browsing mode, all data stays local

## 🚀 Installation & Quick Start

### Firefox Add-ons Store
1. Visit the [Zoomer Firefox Add-on page](https://addons.mozilla.org/firefox/addon/zoomer/)
2. Click "Add to Firefox"
3. Follow the prompts to install

### Manual Installation
1. Download the latest release from the [GitHub Releases page](https://github.com/500Foods/Zoomer/releases)
2. In Firefox, go to `about:debugging`
3. Click "This Firefox" > "Load Temporary Add-on"
4. Select the downloaded .xpi file

### Getting Started
1. Once installed, browse to any webpage
3. Adjust the zoom level as desired (Ctrl + or Ctrl -)
4. Zoomer automatically remembers your preference
5. Return later - the page automatically zooms to your setting!

## 💡 How It Works

Zoomer intelligently matches URLs to remember your zoom preferences:

```
example.com/blog          → 120% zoom
example.com/blog/article  → 150% zoom
example.com/dashboard     → 90% zoom
```

You control how specific the matching should be:
- Just the domain
- Include the path
- Include query parameters
- Include URL fragments

## 🛠️ Advanced Features

### URL Component Matching
Choose which parts of the URL matter for zoom settings:
- **Basic**: Match only the domain (example.com)
- **Standard**: Include the path (/blog/article)
- **Precise**: Include query parameters (?id=123) and fragments (#section1)

### Storage Management
- Set maximum number of stored zoom settings
- Automatic cleanup of old, unused settings
- Export/Import functionality for backup or transfer
- Detailed storage usage statistics

### Debug Mode
Enable console logging to see exactly how Zoomer matches URLs and applies zoom settings - perfect for troubleshooting or just understanding the process.

## Key Dependencies

## Additional Notes
While this project is currently under active development, feel free to give it a try and post any issues you encounter.  Or start a discussion if you would like to help steer the project in a particular direction.  Early days yet, so a good time to have your voice heard. 

## Repository Information
[![Count Lines of Code](https://github.com/500Foods/Zoomer/actions/workflows/main.yml/badge.svg)](https://github.com/500Foods/Zoomer/actions/workflows/main.yml)
<!--CLOC-START -->
```
Last updated at 2025-05-18 08:58:49 UTC
-------------------------------------------------------------------------------
Language                     files          blank        comment           code
-------------------------------------------------------------------------------
JavaScript                       7            225            260           1168
HTML                             2             14              0            132
Markdown                         3             17              2            129
CSS                              2              8              1             46
JSON                             1              6              0             38
YAML                             2              8             13             35
-------------------------------------------------------------------------------
SUM:                            17            278            276           1548
-------------------------------------------------------------------------------
6 Files (without source code) were skipped
```
<!--CLOC-END-->

## Sponsor / Donate / Support
If you find this work interesting, helpful, or valuable, or that it has saved you time, money, or both, please consider directly supporting these efforts financially via [GitHub Sponsors](https://github.com/sponsors/500Foods) or donating via [Buy Me a Pizza](https://www.buymeacoffee.com/andrewsimard500). Also, check out these other [GitHub Repositories](https://github.com/500Foods?tab=repositories&q=&sort=stargazers) that may interest you.