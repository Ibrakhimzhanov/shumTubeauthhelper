
const _P = 4100;
const _B = `http://127.0.0.1:${_P}`;
const _I = 1500;
const _REFRESH_MIN = 10;
const _FAIL_THRESHOLD = 3;

let _polling = false;
let _conn = false;
let _cnt = 0;
let _sessionCnt = 0;
let _failStreak = 0;
let _lastSuccess = null;
let _lastCookieSend = 0;

chrome.storage.local.get(["tokenCount", "lastSuccess"], (d) => {
    _cnt = d.tokenCount || 0;
    _lastSuccess = d.lastSuccess || null;
});

chrome.alarms.create("ka", { periodInMinutes: 0.4 });
chrome.alarms.create("autoRefresh", { periodInMinutes: _REFRESH_MIN });

chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === "ka" && !_polling) _poll();
    if (a.name === "autoRefresh") _autoRefreshTab();
});

chrome.runtime.onInstalled.addListener(() => _poll());
chrome.runtime.onStartup.addListener(() => _poll());

chrome.tabs.onUpdated.addListener((id, info, tab) => {
    if (info.status === "complete" && tab.url && tab.url.includes("labs.google")) {
        if (!_polling) _poll();
        _failStreak = 0;
    }
});

async function _poll() {
    if (_polling) return;
    _polling = true;
    // Send cookies/auth immediately on first poll start
    sendCookiesToBackend().then(() => extractAndSendAuthToken()).catch(() => {});
    _lastCookieSend = Date.now();

    while (_polling) {
        try {
            const r = await fetch(`${_B}/api/v1/captcha/request`, {
                signal: AbortSignal.timeout(5000),
            });

            if (r.status === 200) {
                _conn = true;
                const d = await r.json();
                if (d && d.request_id) {
                    const res = await _exec(d);

                    if (!res.token && res.error && res.error.includes("not ready")) {
                        await _sleep(2000);
                        const retry = await _exec(d);
                        if (retry.token) {
                            await _post(d.request_id, retry.token, retry.error);
                            _onSuccess();
                        } else {
                            await _post(d.request_id, null, retry.error);
                            _onFail();
                        }
                    } else {
                        await _post(d.request_id, res.token, res.error);
                        if (res.token) _onSuccess();
                        else _onFail();
                    }
                }
            } else if (r.status === 204) {
                _conn = true;
                // Send cookies/auth every 5 min while polling
                if (Date.now() - _lastCookieSend > 5 * 60 * 1000) {
                    _lastCookieSend = Date.now();
                    sendCookiesToBackend().then(() => extractAndSendAuthToken()).catch(() => {});
                }
            } else {
                _conn = false;
            }
        } catch (e) {
            _conn = false;
        }

        await _sleep(_I);
    }
}

function _onSuccess() {
    _cnt++;
    _sessionCnt++;
    _failStreak = 0;
    _lastSuccess = Date.now();
    try { chrome.storage.local.set({ tokenCount: _cnt, lastSuccess: _lastSuccess }); } catch (e) { }

    if (_sessionCnt % 10 === 0) {
        console.log(`[ShumTube] Session token #${_sessionCnt} — clearing cookies & refreshing`);
        _clearLabsCookiesAndRefresh();
    }
}

async function _clearLabsCookiesAndRefresh() {
    const AUTH_PREFIXES = ["__Secure-", "SID", "SSID", "HSID", "LSID", "APISID", "SAPISID", "NID"];

    try {
        let cleared = 0;
        const cookies = await chrome.cookies.getAll({ domain: "labs.google" });
        for (const c of cookies) {
            if (AUTH_PREFIXES.some(p => c.name.startsWith(p))) continue;
            const url = `https://${c.domain.replace(/^\./, "")}${c.path}`;
            await chrome.cookies.remove({ url, name: c.name });
            cleared++;
        }
        console.log(`[ShumTube] Cleared ${cleared} non-auth cookies (kept auth intact)`);

        const tid = await _findTab();
        if (tid) {
            await chrome.tabs.reload(tid);
            console.log(`[ShumTube] Labs tab refreshed`);
        }
    } catch (e) { console.log(`[ShumTube] Cookie clear error: ${e.message}`); }
}

function _onFail() {
    _failStreak++;
    if (_failStreak >= _FAIL_THRESHOLD) {
        _failStreak = 0;
        _autoRefreshTab();
    }
}

async function _autoRefreshTab() {
    const settings = await chrome.storage.local.get(["autoRefresh"]);
    if (settings.autoRefresh === false) return;

    // Send fresh cookies and auth token on each periodic refresh
    sendCookiesToBackend().then(() => extractAndSendAuthToken()).catch(() => {});

    const tid = await _findTab();
    if (tid) {
        try {
            await chrome.tabs.reload(tid);
        } catch (e) { /* tab may be closed */ }
    }
}

async function _exec(req) {
    let tid = await _findTab();

    // Auto-open tab if no active session
    if (!tid) {
        try {
            console.log("[ShumTube] No active session — auto-opening labs.google/fx/tools/flow");
            const tab = await chrome.tabs.create({ url: "https://labs.google/fx/tools/flow", active: false });
            // Wait for page to load
            await new Promise((resolve) => {
                const listener = (tabId, info) => {
                    if (tabId === tab.id && info.status === "complete") {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
                // Timeout safety: resolve after 15s even if load event doesn't fire
                setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }, 15000);
            });
            // Extra wait for reCAPTCHA to initialize
            await _sleep(3000);
            tid = await _findTab();
        } catch (e) {
            console.log(`[ShumTube] Auto-open failed: ${e.message}`);
        }
    }

    if (!tid) return { token: null, error: "No active session" };

    const sk = req.site_key || "";
    const act = req.action || "";

    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tid },
            world: "MAIN",
            func: async (s, a) => {
                try {
                    if (typeof grecaptcha === "undefined" || !grecaptcha.enterprise) {
                        return { token: null, error: "Service not ready" };
                    }

                    let k = s;
                    if (!k) {
                        try {
                            if (typeof ___grecaptcha_cfg !== "undefined" && ___grecaptcha_cfg.clients) {
                                const c = ___grecaptcha_cfg.clients;
                                const ks = Object.keys(c);
                                if (ks.length > 0) {
                                    const cl = c[ks[0]];
                                    for (const p of Object.keys(cl)) {
                                        const v = cl[p];
                                        if (v && typeof v === "object") {
                                            for (const p2 of Object.keys(v)) {
                                                const v2 = v[p2];
                                                if (v2 && typeof v2 === "object" && v2.sitekey) {
                                                    k = v2.sitekey;
                                                    break;
                                                }
                                            }
                                        }
                                        if (k) break;
                                    }
                                }
                            }
                            if (!k) {
                                const ss = document.querySelectorAll('script[src*="recaptcha"]');
                                for (const el of ss) {
                                    const m = el.src.match(/[?&]render=([^&]+)/);
                                    if (m && m[1] !== "explicit") { k = m[1]; break; }
                                }
                            }
                        } catch (e) { }
                    }

                    if (!k) return { token: null, error: "Config not ready" };

                    await new Promise((r) => grecaptcha.enterprise.ready(r));
                    const t = await grecaptcha.enterprise.execute(k, { action: a });
                    return { token: t, error: null };
                } catch (err) {
                    return { token: null, error: err.message || String(err) };
                }
            },
            args: [sk, act],
        });

        if (results && results[0] && results[0].result) return results[0].result;
        return { token: null, error: "No result" };
    } catch (e) {
        return { token: null, error: e.message };
    }
}

async function _findTab() {
    try {
        const tabs = await chrome.tabs.query({});
        const t = tabs.filter(
            (t) => t.url && t.url.includes("labs.google") && t.url.includes("tools/flow")
        );
        return t.length > 0 ? t[0].id : null;
    } catch (e) {
        return null;
    }
}

async function _checkV(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: () => {
                const ok = typeof grecaptcha !== "undefined" && !!grecaptcha.enterprise;
                let k = null;
                if (ok) {
                    try {
                        if (typeof ___grecaptcha_cfg !== "undefined" && ___grecaptcha_cfg.clients) {
                            const c = ___grecaptcha_cfg.clients;
                            const ks = Object.keys(c);
                            if (ks.length > 0) {
                                const cl = c[ks[0]];
                                for (const p of Object.keys(cl)) {
                                    const v = cl[p];
                                    if (v && typeof v === "object") {
                                        for (const p2 of Object.keys(v)) {
                                            const v2 = v[p2];
                                            if (v2 && typeof v2 === "object" && v2.sitekey) {
                                                k = v2.sitekey;
                                                break;
                                            }
                                        }
                                    }
                                    if (k) break;
                                }
                            }
                        }
                    } catch (e) { }
                }
                return { available: ok, siteKey: k, error: ok ? null : "Not ready" };
            },
        });
        if (results && results[0] && results[0].result) return results[0].result;
        return { available: false, error: "No result" };
    } catch (e) {
        return { available: false, error: e.message };
    }
}

chrome.runtime.onMessage.addListener((msg, _s, send) => {
    if (msg.type === "CHECK_V") {
        _checkV(msg.tabId).then((r) => send(r)).catch((e) => send({ available: false, error: e.message }));
        return true;
    }
    if (msg.type === "TEST_V") {
        _exec({ site_key: msg.site_key || "", action: msg.action || "" })
            .then((r) => {
                if (r.token) {
                    _onSuccess();
                    sendCookiesToBackend().then(() => extractAndSendAuthToken()).catch(() => {});
                }
                send(r);
            }).catch((e) => send({ token: null, error: e.message }));
        return true;
    }
    if (msg.type === "GET_STATS") {
        send({ tokenCount: _cnt, lastSuccess: _lastSuccess, connected: _conn });
        return true;
    }
    if (msg.type === "CHECK_FULL_STATUS") {
        (async () => {
            const result = { bridge: "err", bridgeText: "Not running", tab: "warn", tabText: "No session", login: "warn", loginText: "—", captcha: "warn", captchaText: "—" };
            try {
                const r = await fetch(`${_B}/api/v1/captcha/health`, { signal: AbortSignal.timeout(3000) });
                if (r.ok) { result.bridge = "ok"; result.bridgeText = "Connected"; }
                else { result.bridgeText = `Error (${r.status})`; }
            } catch (e) { }
            try {
                const tabs = await chrome.tabs.query({});
                const ft = tabs.filter(t => t.url && t.url.includes("labs.google"));
                if (ft.length > 0) {
                    result.tab = "ok"; result.tabText = `Active (${ft.length})`;
                    try {
                        const c = await chrome.cookies.getAll({ domain: ".google.com" });
                        const ok = c.some(c => c.name === "SID" || c.name === "__Secure-3PSID" || c.name === "SAPISID");
                        result.login = ok ? "ok" : "err";
                        result.loginText = ok ? "Authenticated" : "Not signed in";
                    } catch (e) { result.loginText = "Unknown"; }
                    try {
                        const cv = await _checkV(ft[0].id);
                        if (cv && cv.available) { result.captcha = "ok"; result.captchaText = "Ready"; }
                        else { result.captchaText = cv?.error || "Not ready"; }
                    } catch (e) { result.captchaText = "Timeout"; }
                }
            } catch (e) { result.tab = "err"; result.tabText = "Error"; }
            send(result);
        })();
        return true;
    }
    if (msg.type === "CLEAR_COOKIES_REFRESH") {
        (async () => {
            const AUTH_PREFIXES = ["__Secure-", "SID", "SSID", "HSID", "LSID", "APISID", "SAPISID", "NID"];
            let cleared = 0;
            try {
                const cookies = await chrome.cookies.getAll({ domain: "labs.google" });
                for (const c of cookies) {
                    if (AUTH_PREFIXES.some(p => c.name.startsWith(p))) continue;
                    const url = `https://${c.domain.replace(/^\./, "")}${c.path}`;
                    await chrome.cookies.remove({ url, name: c.name });
                    cleared++;
                }
            } catch (e) { }
            send({ cleared });
        })();
        return true;
    }
    if (msg.type === "REFRESH_TAB") {
        (async () => {
            try {
                const tabs = await chrome.tabs.query({});
                const ft = tabs.filter(t => t.url && t.url.includes("labs.google"));
                if (ft.length > 0) {
                    await chrome.tabs.reload(ft[0].id);
                    send({ ok: true });
                } else {
                    send({ ok: false, error: "No Labs tab" });
                }
            } catch (e) {
                send({ ok: false, error: e.message });
            }
        })();
        return true;
    }
    if (msg.type === "RESET_STATS") {
        _cnt = 0; _lastSuccess = null;
        chrome.storage.local.set({ tokenCount: 0, lastSuccess: null });
        send({ ok: true });
        return true;
    }
    return false;
});

async function _post(id, token, error) {
    try {
        const r = await fetch(`${_B}/api/v1/captcha/response`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                request_id: id,
                token: token,
                error: error || null,
                user_agent: navigator.userAgent,
            }),
            signal: AbortSignal.timeout(5000),
        });
        if (r.ok) {
            sendCookiesToBackend().then(() => extractAndSendAuthToken()).catch(() => {});
        }
    } catch (e) { }
}

async function sendCookiesToBackend() {
    try {
        const cookies = await chrome.cookies.getAll({ domain: '.google.com' });
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        const r = await fetch(`${_B}/api/v1/auth/cookies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookies: cookieString }),
            signal: AbortSignal.timeout(5000),
        });
        if (r.ok) console.log(`[ShumTube] Cookies sent to backend (${cookies.length} cookies)`);
        else console.log(`[ShumTube] Cookie send failed: ${r.status}`);
    } catch (e) {
        console.log(`[ShumTube] Cookie send error: ${e.message}`);
    }
}

async function sendAuthTokenToBackend(token) {
    try {
        const r = await fetch(`${_B}/api/v1/auth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: token }),
            signal: AbortSignal.timeout(5000),
        });
        if (r.ok) console.log(`[ShumTube] Auth token sent to backend`);
        else console.log(`[ShumTube] Auth token send failed: ${r.status}`);
    } catch (e) {
        console.log(`[ShumTube] Auth token send error: ${e.message}`);
    }
}

async function extractAndSendAuthToken() {
    const tid = await _findTab();
    if (!tid) return;
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tid },
            world: "MAIN",
            func: async () => {
                try {
                    const r = await fetch('https://labs.google/fx/api/auth/session', { credentials: 'include' });
                    const d = await r.json();
                    return d.accessToken || d.access_token || null;
                } catch (e) {
                    return null;
                }
            },
        });
        const token = results && results[0] && results[0].result;
        if (token) {
            await sendAuthTokenToBackend(token);
        } else {
            console.log(`[ShumTube] No auth token found in session`);
        }
    } catch (e) {
        console.log(`[ShumTube] Auth token extract error: ${e.message}`);
    }
}

function _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
