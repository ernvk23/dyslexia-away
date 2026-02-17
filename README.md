# DyslexiaAway

A simple browser extension that applies a dyslexic-friendly font. For some of us, that small change makes reading a lot easier.

---

## Features

* **Dyslexic-friendly fonts:** Andika, Lexend, OpenDyslexic, Shantell Sans, Balsamiq Sans, or Atkinson Hyperlegible
* **Custom settings:** Adjust spacing and line height
* **Site exclusion:** Skip pages where it could cause issues
* **Cross-browser compatible:** Works on Chrome/Firefox compatible browsers (including Firefox for Android)
* **Minimal overhead:** Runs with near-zero CPU usage
* **Theme switching:** Choose between light, dark, or system themes

> [!NOTE]
> Some fonts may not support specific languages (e.g., Cyrillic/Greek).

## Sample

<img src="./app/sample-full.webp" alt="Sample" width="60%" style="border-radius: 0.4rem; margin: auto; display: block;">

## Installation

### Browser Stores (Recommended)
Get the extension directly from the official browser stores:

[![Firefox Add-ons](https://img.shields.io/badge/Firefox_Add--ons-FF7139?logo=firefox&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/dyslexiaaway/)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/dyslexiaaway-beta/cdlibplbalgnomagghdgogdofiphhjce)

### Manual Installation (Alternative)
#### Firefox & Chrome/Chromium Browsers
1. Download the appropriate ZIP file from [Latest Release](https://github.com/ernvk23/dyslexia-away/releases/latest)
   - `dyslexia-away-firefox.zip` for Firefox
   - `dyslexia-away-chrome.zip` for Chrome/Chromium
2. **Firefox:** Go to `about:debugging`, click "This Firefox", then "Load Temporary Add-on" and select the ZIP file
3. **Chrome/Chromium:** Go to `chrome://extensions`, enable "Developer mode", drag and drop the ZIP file
> **Alternative:** If drag & drop doesn't work, extract the ZIP file and use "Load unpacked" in Developer mode.

## Usage
Under extensions, click it to toggle and adjust settings.

## Motivation

I built this because I wanted something simple that just makes reading feel better. 
A lot of accessibility tools are great but try to do too much.
This one only does one thing - and that's enough for me.

If reading has ever felt harder than it should be, this might help.
For me, it made things click in a way they hadn't before.


## Technical Details

- **Manifest Version:** 3 (Chrome & Firefox)
- **Font Loading:** Local font files bundled with extension
- **Compatibility:** Chrome 88+, Firefox 142+ (including Firefox for Android)
- **Zero-footprint:** Stays asleep unless settings change
- **Privacy First:** No tracking, no data collection, no external dependencies



## License

Licensed under the [GNU General Public License v3.0 (GPL-3.0)](./LICENSE).

## Credits

- [Andika](https://fonts.google.com/specimen/Andika) - a typeface designed for clarity and legibility ([SIL OFL](./app/fonts/Andika-OFL.txt))
- [Lexend](https://www.lexend.com/) - a typeface designed to improve reading proficiency ([SIL OFL](./app/fonts/Lexend-OFL.txt))
- [OpenDyslexic](https://opendyslexic.org/) - an open typeface made to help with reading ([SIL OFL](./app/fonts/OpenDyslexic-OFL.txt))
- [Shantell Sans](https://github.com/arrowtype/shantell-sans) - a friendly typeface ([SIL OFL](./app/fonts/ShantellSans-OFL.txt))
- [Balsamiq Sans](https://github.com/balsamiq/balsamiqsans) - a Comic Sans-based font ([SIL OFL](./app/fonts/BalsamiqSans-OFL.txt))
- [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont) - a typeface designed to increase legibility for readers with low vision ([SIL OFL](./app/fonts/AtkinsonHyperlegible-OFL.txt))
- [SVGRepo](https://www.svgrepo.com/) - extension icon (CC0 License)