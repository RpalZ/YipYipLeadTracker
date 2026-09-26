import assert from "node:assert/strict";
import test from "node:test";

import { uiCopy } from "../lib/i18n";
import {
  preferenceCookie,
  resolveUiLocale,
  resolveUiTheme,
  UI_LOCALE_COOKIE,
} from "../lib/interface-preferences";

test("interface preferences accept only supported locales and themes", () => {
  assert.equal(resolveUiLocale("nl"), "nl");
  assert.equal(resolveUiLocale("de"), "en");
  assert.equal(resolveUiTheme("dark"), "dark");
  assert.equal(resolveUiTheme("system"), "light");
});

test("Dutch catalog mirrors every English interface group and key", () => {
  assert.deepEqual(Object.keys(uiCopy.nl), Object.keys(uiCopy.en));
  for (const group of Object.keys(uiCopy.en) as Array<keyof typeof uiCopy.en>) {
    assert.deepEqual(Object.keys(uiCopy.nl[group]), Object.keys(uiCopy.en[group]));
  }
  assert.equal(uiCopy.nl.dashboard.title, "Acquisitiepijplijn");
});

test("preference cookies are project-wide, durable, and same-site", () => {
  assert.equal(
    preferenceCookie(UI_LOCALE_COOKIE, "nl"),
    "yipyip-ui-locale=nl; Path=/; Max-Age=31536000; SameSite=Lax",
  );
});
