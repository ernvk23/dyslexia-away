# DyslexiaAway

A simple browser extension that applies a dyslexic-friendly font. For some of us, that small change makes reading a lot easier.

---

## Features

* **Fonts:** Choose from Andika, Lexend, Shantell Sans, OpenDyslexic, Atkinson Hyperlegible, or use any custom font available on your system.
* **Custom settings:** Adjust spacing and line height
* **Site exclusion:** Skip pages where it could cause issues
* **Cross-browser compatible:** Works on Chrome/Firefox compatible browsers (including Firefox for Android)
* **Minimal overhead:** Runs with near-zero CPU usage
* **Theme switching:** Choose between light, dark, or system themes

> [!NOTE]
> Some fonts may not support specific languages (e.g., Cyrillic/Greek).

## Sample

<img src="./docs/img/sample-full.webp" alt="Sample" width="60%" style="border-radius: 0.4rem; margin: auto; display: block;">

## Installation

### Browser Stores (Recommended)
Get the extension directly from the official browser stores:

[![Firefox Add-ons](https://img.shields.io/badge/Firefox_Add--ons-FF7139?logo=firefox&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/dyslexiaaway/)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/dyslexiaaway-beta/cdlibplbalgnomagghdgogdofiphhjce)

### Manual Installation (Alternative)
Download the ZIP from [Latest Release](https://github.com/ernvk23/dyslexia-away/releases/latest), then:

- **Firefox:** `about:debugging` → "This Firefox" → "Load Temporary Add-on"
- **Chrome/Chromium:** `chrome://extensions` → enable "Developer mode" → drag & drop the ZIP

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

Licensed under [GPL-3.0](./LICENSE).

## Credits

**Fonts** (all licensed under SIL OFL): [Andika](https://fonts.google.com/specimen/Andika), [Lexend](https://www.lexend.com/), [Shantell Sans](https://github.com/arrowtype/shantell-sans), [OpenDyslexic](https://opendyslexic.org/), [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont)

**Icons:** [SVGRepo](https://www.svgrepo.com/) (CC0).