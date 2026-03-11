# ShumTube Auth Helper

Chrome extension for ShumTube Generator desktop application.

## What it does

- Manages Google Labs (labs.google) authentication sessions
- Solves reCAPTCHA Enterprise for seamless image and video generation
- Monitors connection status in real-time
- Auto-refreshes session every 10 minutes

## Privacy & Security

**All data stays on your computer.** This extension communicates exclusively with the local ShumTube Generator app running on `localhost:4100`.

- No cookies are sent to external servers
- No user data is collected or transmitted
- No analytics or tracking
- Source code is fully open for inspection

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## How it works

```
Google Labs page (labs.google)
        |
        v
  Chrome Extension  <---->  ShumTube Generator (localhost:4100)
   - reads cookies           - requests reCAPTCHA tokens
   - solves reCAPTCHA         - uses tokens for API calls
   - monitors session         - generates images/videos
```

1. ShumTube Generator requests a reCAPTCHA token via `GET /api/v1/captcha/request`
2. Extension solves reCAPTCHA Enterprise on the real Google Labs page
3. Extension sends the token back via `POST /api/v1/captcha/response`
4. All communication happens on `127.0.0.1` — nothing leaves your machine

## Permissions explained

| Permission | Why |
|-----------|-----|
| `cookies` | Check if user is logged into Google Labs |
| `tabs` | Find open Google Labs tab for script injection |
| `scripting` | Execute reCAPTCHA on labs.google pages |
| `storage` | Save preferences (language, token count) |
| `alarms` | Periodic session health checks |

## Languages

Russian, English, O'zbek

## Install

1. Download or clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode"
4. Click "Load unpacked" and select this folder

## License

MIT
