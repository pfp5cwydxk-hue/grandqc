macOS Code Signing & Notarization Guide
=====================================

This document explains how to code sign and notarize the macOS DMG produced by Electron Forge.

Prerequisites
-------------
- An Apple Developer account (Organization or Individual) with a valid certificate.
- Xcode and Xcode command-line tools installed on the build machine.
- `notarytool` (bundled with recent Xcode) or `altool`.
- `productbuild`, `codesign`, and `stapler` available (bundled with Xcode).

High-level steps
----------------
1. Create and export a Developer ID Application certificate from your Apple Developer account (or use the one in your Keychain).
2. Build the app with Electron Forge (this produces the `.app` and `.dmg`).
3. Codesign the `.app` with your Developer ID certificate.
4. Create a signed installer `.pkg` or sign the DMG metadata, then notarize with `notarytool`.
5. Staple the notarization ticket to the `.dmg` or `.pkg` and verify.

Commands (example)
-------------------

Replace `"Developer ID Application: Your Name (TEAMID)"` and paths with your values.

1) Codesign the app (recursively, preserve entitlements if needed):

```bash
codesign --deep --force --verbose --sign "Developer ID Application: Your Name (TEAMID)" \
  "/path/to/pathology-app.app"
```

2) Verify codesign:

```bash
codesign --verify --deep --strict --verbose=2 "/path/to/pathology-app.app"
spctl --assess --type execute --verbose=4 "/path/to/pathology-app.app"
```

3) Create a ZIP or DMG (Electron Forge usually created a DMG). If you have a `.pkg`, you can use `productbuild`.

4) Notarize using `notarytool` (recommended) or `altool` (deprecated):

```bash
# Using notarytool (Xcode 13+)
notarytool submit "/path/to/pathology-app-1.0.0.dmg" --apple-id "you@domain.com" --team-id "TEAMID" --keychain-profile "AC_PASSWORD_PROFILE" --wait

# Using altool (older):
xcrun altool --notarize-app -f "/path/to/pathology-app-1.0.0.dmg" --primary-bundle-id "com.pathology.grandqc" -u "you@domain.com" -p "APP-SPECIFIC-PASSWORD"
```

5) Staple notarization ticket to the DMG:

```bash
xcrun stapler staple "/path/to/pathology-app-1.0.0.dmg"
xcrun stapler validate "/path/to/pathology-app-1.0.0.dmg"
```

Notes & tips
------------
- Notarization requires either an API key profile (`notarytool` with keychain profile) or an app-specific password for `altool`.
- For CI/CD, create an App Store Connect API key and configure `notarytool` with a keychain profile.
- If you want the DMG to show a custom background or volume icon, include `background` and `.VolumeIcon.icns` in the DMG build process (Electron Forge can copy provided assets).
- To include an icon, create an `icon.icns` file and reference it in `forge.config.js` via `packagerConfig.icon` and maker config. For DMG backgrounds add `background` and `.VolumeIcon.icns` files into the DMG source.

Example: add icon to Forge config
---------------------------------
In `forge.config.js`:

```js
packagerConfig: {
  icon: './assets/icon', // path without extension — packager will use icon.icns on mac
},
makers: [
  { name: '@electron-forge/maker-dmg', config: { icon: './assets/icon.icns' } },
]
```

If you'd like, I can (A) add a placeholder `icon.icns` to the repo, (B) create CI steps to notarize automatically (requires you to provide Apple credentials), or (C) walk you through manual signing on your Mac.
