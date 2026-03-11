# Privacy Policy — ShumTube Auth Helper

## What data does this extension access?

### Cookies (google.com, labs.google)
- **Purpose:** Verify that the user is logged into Google Labs
- **Storage:** Cookies are only read locally to check authentication status. No cookies are sent to external servers.
- **Sharing:** Never shared with third parties

### Tabs
- **Purpose:** Detect if a Google Labs tab is open and inject reCAPTCHA verification scripts
- **Storage:** No tab data is stored
- **Sharing:** Never shared

### Scripting (labs.google pages only)
- **Purpose:** Execute reCAPTCHA Enterprise verification on the Google Labs page
- **Storage:** No page data is stored
- **Sharing:** Verification tokens are only sent to the local ShumTube Generator application (localhost)

### Storage
- **Purpose:** Save user preferences (language, auto-refresh setting, token count)
- **Storage:** Chrome local storage only
- **Sharing:** Never shared

### Alarms
- **Purpose:** Periodic session health checks and auto-refresh
- **Storage:** No data stored
- **Sharing:** Never shared

## Local communication only
This extension communicates exclusively with the ShumTube Generator desktop application running on localhost (127.0.0.1:4100). No data is sent to any external server.

## Data retention
- Token count and settings are stored in Chrome's local storage
- Session cookies are managed by Chrome's built-in cookie system
- No user data is transmitted or stored externally

## Contact
For questions about this privacy policy, contact: shumtube@example.com
