/* Visit counter: Matomo self-hosted on stats.vtesitaly.com (site id 2;
 * vtesitaly.com = 1, judge = 2, draft = 3). An external file instead of the
 * usual inline snippet because the CSP has no 'unsafe-inline'.
 * disableCookies keeps it cookieless, so no consent banner is needed. The
 * host check keeps local dev and the CI test runs out of the stats.
 */
// @ts-check

if (location.hostname.endsWith("vtesitaly.com")) {
  const w = /** @type {Window & { _paq?: unknown[][] }} */ (window);
  const paq = (w._paq = w._paq || []);
  paq.push(["disableCookies"]);
  // Only the opt-out cookie (set from vtesitaly.com/privacy) is ever written;
  // sharing its domain makes the choice apply to all three sites.
  paq.push(["setCookieDomain", "*.vtesitaly.com"]);
  paq.push(["trackPageView"]);
  paq.push(["enableLinkTracking"]);
  paq.push(["setTrackerUrl", "https://stats.vtesitaly.com/matomo.php"]);
  paq.push(["setSiteId", "2"]);
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://stats.vtesitaly.com/matomo.js";
  document.head.appendChild(s);
}
