
(() => {
    if (document.getElementById("shumtube-fab")) return;

    let iconUrl, popupUrl;
    try {
        iconUrl = chrome.runtime.getURL("icon48.png");
        popupUrl = chrome.runtime.getURL("popup.html");
    } catch (e) {
        return;
    }

    function _alive() {
        try { return !!chrome.runtime?.id; } catch (e) { return false; }
    }

    const css = document.createElement("style");
    css.textContent = `
        #shumtube-fab {
            position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
            width: 48px; height: 48px; border-radius: 14px;
            background: rgba(15,17,23,0.85);
            backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255,255,255,0.08);
            box-shadow: 0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset;
            display: flex; align-items: center; justify-content: center;
            cursor: grab; user-select: none;
            transition: box-shadow 0.3s ease, transform 0.2s ease;
        }
        #shumtube-fab:hover {
            box-shadow: 0 8px 32px rgba(139,92,246,0.25), 0 0 0 1px rgba(139,92,246,0.15) inset;
            transform: scale(1.08);
        }
        #shumtube-fab-badge {
            position: absolute; top: -5px; right: -5px;
            min-width: 18px; height: 18px; line-height: 18px; text-align: center;
            font-size: 10px; font-weight: 800; font-family: 'Inter', system-ui, sans-serif;
            color: #fff; background: linear-gradient(135deg, #8b5cf6, #06b6d4);
            border-radius: 9px; padding: 0 5px;
            box-shadow: 0 2px 8px rgba(139,92,246,0.5);
            transition: background 0.3s, box-shadow 0.3s;
        }
        #shumtube-fab.gc #shumtube-fab-badge {
            background: linear-gradient(135deg, #22c55e, #10b981);
            box-shadow: 0 2px 8px rgba(34,197,94,0.5);
        }
        #shumtube-fab.gd #shumtube-fab-badge {
            background: linear-gradient(135deg, #ef4444, #f43f5e);
            box-shadow: 0 2px 8px rgba(239,68,68,0.5);
        }

        #shumtube-iframe-wrap {
            position: fixed; z-index: 2147483646;
            border-radius: 16px; overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06) inset;
            border: 1px solid rgba(255,255,255,0.08);
            animation: stSlideIn 0.2s ease-out;
        }
        #shumtube-iframe-wrap iframe {
            width: 360px; height: 460px; border: none;
            border-radius: 16px; display: block;
        }
        @keyframes stSlideIn {
            from { opacity: 0; transform: translateY(8px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
    `;
    document.head.appendChild(css);

    const fab = document.createElement("div");
    fab.id = "shumtube-fab";
    fab.title = "ShumTube Auth";
    fab.innerHTML = `<img src="${iconUrl}" width="26" height="26" style="border-radius:7px;opacity:0.9;" /><span id="shumtube-fab-badge">—</span>`;
    document.body.appendChild(fab);

    let isDrag = false, sx, sy, fx, fy, rafId = null;
    const fabSize = 48;

    fab.addEventListener("mousedown", (e) => {
        isDrag = false; sx = e.clientX; sy = e.clientY;
        const r = fab.getBoundingClientRect(); fx = r.left; fy = r.top;
        fab.style.cursor = "grabbing"; fab.style.transition = "none";
        e.preventDefault();

        const mv = (e) => {
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDrag = true;
            if (isDrag) {
                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    const x = Math.max(0, Math.min(window.innerWidth - fabSize, fx + dx));
                    const y = Math.max(0, Math.min(window.innerHeight - fabSize, fy + dy));
                    fab.style.left = `${x}px`;
                    fab.style.top = `${y}px`;
                    fab.style.right = "auto";
                    fab.style.bottom = "auto";
                });
            }
        };
        const up = () => {
            document.removeEventListener("mousemove", mv);
            document.removeEventListener("mouseup", up);
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            fab.style.cursor = "grab";
            fab.style.transition = "box-shadow 0.3s ease, transform 0.2s ease";
        };
        document.addEventListener("mousemove", mv);
        document.addEventListener("mouseup", up);
    });

    fab.addEventListener("click", () => { if (!isDrag && _alive()) togglePanel(); });

    let panel = null;

    function togglePanel() {
        if (!_alive()) return;
        if (panel) { panel.remove(); panel = null; return; }

        panel = document.createElement("div");
        panel.id = "shumtube-iframe-wrap";

        const iframe = document.createElement("iframe");
        iframe.src = popupUrl;

        panel.appendChild(iframe);

        const fabRect = fab.getBoundingClientRect();
        if (fabRect.top > 480) {
            panel.style.bottom = `${window.innerHeight - fabRect.top + 10}px`;
        } else {
            panel.style.top = `${fabRect.bottom + 10}px`;
        }
        const rightPos = window.innerWidth - fabRect.right;
        panel.style.right = `${Math.max(8, rightPos)}px`;

        document.body.appendChild(panel);

        setTimeout(() => document.addEventListener("click", _closeOutside), 100);
    }

    function _closeOutside(e) {
        if (panel && !panel.contains(e.target) && !fab.contains(e.target)) {
            panel.remove(); panel = null;
            document.removeEventListener("click", _closeOutside);
        }
    }

    let _badgeTimer = null;

    function updateBadge() {
        if (!_alive()) {
            if (_badgeTimer) clearInterval(_badgeTimer);
            const el = document.getElementById("shumtube-fab");
            if (el) el.remove();
            if (panel) { panel.remove(); panel = null; }
            return;
        }
        try {
            chrome.runtime.sendMessage({ type: "GET_STATS" }, (r) => {
                if (chrome.runtime.lastError) return;
                const badge = document.getElementById("shumtube-fab-badge");
                if (!badge) return;
                if (r) {
                    badge.textContent = r.tokenCount || "0";
                    fab.className = r.connected ? "gc" : "gd";
                } else {
                    badge.textContent = "!";
                    fab.className = "gd";
                }
            });
        } catch (e) { }
    }

    updateBadge();
    _badgeTimer = setInterval(updateBadge, 3000);
})();
