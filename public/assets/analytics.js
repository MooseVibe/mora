(() => {
  window.MoraAnalytics = { capture() {} };
  // ponytail: production-only analytics; local and preview deployments stay no-op.
  if (window.location.hostname !== "moratarot.com") return;

  const posthog = window.posthog = window.posthog || [];
  if (!posthog.__SV) {
    posthog._i = [];
    posthog.capture = (...args) => posthog.push(["capture", ...args]);
    posthog.init = (token, config) => {
      const script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `${config.api_host.replace(".i.posthog.com", "-assets.i.posthog.com")}/static/array.js`;
      document.head.append(script);
      posthog._i.push([token, config]);
    };
    posthog.__SV = 1;
  }

  posthog.init("phc_vHzfGXbbRiyxYwFZF34hwqU8HR8YDoyJmnCmUNEBsetr", {
    api_host: "https://eu.i.posthog.com",
    defaults: "2026-05-30",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    person_profiles: "identified_only",
    persistence: "sessionStorage",
  });

  window.MoraAnalytics.capture = (event, properties = {}) => {
    window.posthog?.capture?.(`mora_${event}`, properties);
  };
})();
