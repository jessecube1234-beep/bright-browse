# Bright Browse

A kid-safe browser that gives parents control over which websites, YouTube
channels, and online content their children can access.

## Features

- Allow entire websites or individual pages
- Allow YouTube channels by channel ID or `@handle`
- Lock parent settings behind a 4–6 digit PIN
- Replace the regular YouTube homepage with a list of approved channels
- Match topics such as math, space, reading, coding, and art with approved resources
- Include a starter list of educational sites and YouTube channels

## Development

Install the dependencies and start the app:

```bash
npm install
npm run start
```

Run the tests:

```bash
npm test
```

If PowerShell blocks `npm`, use `npm.cmd` instead.

## Windows installer

Build the installer with:

```bash
npm run make
```

The installer will be created at:

```text
out/make/squirrel.windows/x64/Bright Browse Setup.exe
```

Only developers need to run the build command. Everyone else installs the app
with `Bright Browse Setup.exe` and opens it from the Windows app icon.

## Project layout

```text
config/
└── default-policy.json  Starter sites, channels, and topic tags

src/
├── main/
│   ├── main.cjs          Electron window, navigation, and IPC
│   ├── pin-store.cjs     Parent PIN storage and verification
│   ├── policy.cjs        URL and YouTube filtering rules
│   └── policy-store.cjs  Saved approval list and default migrations
├── preload/
│   └── preload.cjs       Restricted bridge used by the interface
└── renderer/
    ├── index.html        App interface
    ├── app.js            Interface behavior
    └── styles.css        App styles

tests/
├── pin-store.test.cjs
├── policy-store.test.cjs
└── policy.test.cjs
```

The filtering rules are in `src/main/policy.cjs`. The starter approval list and
topic tags are in `config/default-policy.json`.

## Approval rules

- **Website:** Allows the domain and its subdomains.
- **Webpage:** Allows one exact page.
- **YouTube channel:** Allows the channel page and verifies a video's channel before showing it.

Parent changes are saved in Electron's per-user application-data folder. The
PIN is salted and hashed before it is saved.

## Limitations

Bright Browse is still an early version. Downloads and operating-system
shortcuts are not fully locked down. YouTube could also change the page data
used to identify a video's channel, which would require an update here.
