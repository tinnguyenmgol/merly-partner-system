# Merly website affiliate tracking

Paste this script into `merlyshoes.com` (for example in the global theme footer). It records individual `referral_ctv` affiliate-link traffic without requiring a customer discount code.

```html
<script>
(function () {
  var PARAMS = ["ref", "aff", "ctv", "partner"];
  var COOKIE_DAYS = 30;
  var TRACK_URL = "https://partner.merlyshoes.com/api/affiliate/track";
  var SAFE_CODE = /^[A-Z0-9_-]{3,50}$/;

  function normalize(value) {
    value = (value || "").trim().toUpperCase();
    return SAFE_CODE.test(value) ? value : "";
  }

  function getParamCode() {
    var params = new URLSearchParams(window.location.search);
    for (var i = 0; i < PARAMS.length; i += 1) {
      var code = normalize(params.get(PARAMS[i]));
      if (code) return code;
    }
    return "";
  }

  function setCookie(name, value) {
    var expires = new Date(Date.now() + COOKIE_DAYS * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + "; expires=" + expires + "; path=/; SameSite=Lax";
  }

  function getCookie(name) {
    return (document.cookie.split("; ").find(function (row) { return row.indexOf(name + "=") === 0; }) || "").split("=")[1] || "";
  }

  function remember(name, value) {
    try { window.localStorage.setItem(name, value); } catch (e) {}
    setCookie(name, value);
  }

  function recall(name) {
    try { return window.localStorage.getItem(name) || decodeURIComponent(getCookie(name)); } catch (e) { return decodeURIComponent(getCookie(name)); }
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return "merly_" + crypto.randomUUID();
    return "merly_" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  var code = getParamCode();
  var clickId = recall("merly_partner_click_id") || uuid();
  var landing = recall("merly_partner_landing") || window.location.href;

  if (code) {
    remember("merly_partner_code", code);
    remember("merly_partner_click_id", clickId);
    remember("merly_partner_landing", landing);
    try {
      fetch(TRACK_URL, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerCode: code,
          clickId: clickId,
          landingUrl: landing,
          currentUrl: window.location.href,
          referrer: document.referrer || "",
          source: "merly_website",
          occurredAt: new Date().toISOString()
        }),
        keepalive: true
      });
    } catch (e) {}
  } else {
    code = normalize(recall("merly_partner_code"));
  }

  function addHidden(form, name, value) {
    if (!form || !value || form.querySelector('[name="' + name + '"]')) return;
    var input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  function injectCartAttributes() {
    var storedCode = normalize(recall("merly_partner_code"));
    var storedClick = recall("merly_partner_click_id");
    var storedLanding = recall("merly_partner_landing");
    document.querySelectorAll('form[action*="/cart"], form[action*="/checkout"]').forEach(function (form) {
      addHidden(form, "attributes[merly_partner_code]", storedCode);
      addHidden(form, "attributes[merly_partner_click_id]", storedClick);
      addHidden(form, "attributes[merly_partner_landing]", storedLanding);
    });
  }

  function preserveInternalLinks() {
    var storedCode = normalize(recall("merly_partner_code"));
    if (!storedCode) return;
    document.querySelectorAll('a[href^="/"]:not([href^="//"]), a[href^="' + window.location.origin + '"]').forEach(function (link) {
      try {
        var url = new URL(link.getAttribute("href"), window.location.origin);
        if (!url.searchParams.has("ref")) url.searchParams.set("ref", storedCode);
        link.setAttribute("href", url.pathname + url.search + url.hash);
      } catch (e) {}
    });
  }

  injectCartAttributes();
  preserveInternalLinks();
  document.addEventListener("DOMContentLoaded", function () {
    injectCartAttributes();
    preserveInternalLinks();
  });
})();
</script>
```
