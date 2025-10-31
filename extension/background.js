chrome.action.onClicked.addListener(() => {
  chrome.windows.create(
    {
      url: "https://drednot.io/leaderboard",
      type: "popup",
      width: 800,
      height: 600
    },
    (win) => {
      const tabId = win.tabs[0].id;
      chrome.debugger.attach({ tabId }, "1.3", () => {
        console.log("[*] Debugger attached to popup");
        chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
          console.log("[*] Network tracking enabled");
        });
        const cleanup = () => {
          chrome.debugger.onEvent.removeListener(listener);
          chrome.debugger.detach({ tabId }, () => {
            console.log("[*] Debugger detached");
            chrome.windows.remove(win.id);
          });
        };
        const sendToServer = (cf_clearance, cf__bm, clearance_expire) => {
          console.log("cf_clearance:", cf_clearance);
          console.log("clearance_expire:", clearance_expire);
          if (cf__bm) console.log("__cf_bm:", cf__bm);
          fetch("http://127.0.0.1:3002/cloudflare", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              _cf_clearance: cf_clearance,
              clearance_expire,
              ...(cf__bm && { _cf__bm: cf__bm })
            })
          }).catch(err => console.error("Send failed:", err));
          cleanup();
        };
        const handleSetCookie = (setCookieHeader) => {
          const setCookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
          let cf_clearance = null;
          let cf__bm = null;
          let clearance_expire = null;
          for (const cookieStr of setCookies) {
            if (cookieStr.includes("cf_clearance")) {
              const tokenMatch = cookieStr.match(/cf_clearance=([^;]+)/);
              const expiresMatch = cookieStr.match(/Expires=([^;]+)/i);
              if (tokenMatch) cf_clearance = tokenMatch[1];
              if (expiresMatch) clearance_expire = expiresMatch[1];
            }
            if (cookieStr.includes("__cf_bm")) {
              const bmMatch = cookieStr.match(/__cf_bm=([^;]+)/);
              if (bmMatch) cf__bm = bmMatch[1];
            }
          }
          if (cf_clearance && clearance_expire) sendToServer(cf_clearance, cf__bm, clearance_expire);
        };
        const listener = (source, method, params) => {
          if (source.tabId !== tabId) return;
          if (method === "Network.responseReceived") {
            const headers = params.response?.headers?.["set-cookie"];
            if (headers) {
              console.log("[*] responseReceived");
              handleSetCookie(headers);
            }
          }
          if (method === "Network.responseReceivedExtraInfo") {
            const headers = params.headers?.["set-cookie"];
            if (headers) {
              console.log("[*] responseReceivedExtraInfo");
              handleSetCookie(headers);
            }
          }
        };
        chrome.debugger.onEvent.addListener(listener);
        setTimeout(() => {
          chrome.debugger.sendCommand({ tabId }, "Network.getAllCookies", {}, (result) => {
            const cookies = result.cookies || [];
            const cfClearanceCookie = cookies.find(c => c.name === "cf_clearance");
            const cfBmCookie = cookies.find(c => c.name === "__cf_bm");
            if (cfClearanceCookie) {
              const expire = new Date(cfClearanceCookie.expires * 1000).toUTCString();
              sendToServer(cfClearanceCookie.value, cfBmCookie?.value, expire);
            } else console.warn("cf_clearance not found in Network.getAllCookies");
          });
        }, 3000);
      });
    }
  );
});