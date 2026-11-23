import assert from "node:assert/strict";
import test from "node:test";

const data = new Map();
const tokenRequests = [];
const removedTokens = [];
const listeners = {};
const register = (name) => ({ addListener: (handler) => { listeners[name] = handler; } });

globalThis.chrome = {
  runtime: {
    id: "test-extension",
    getManifest: () => ({ oauth2: { client_id: "fixture.apps.googleusercontent.com" } }),
    getURL: (path) => path,
    onInstalled: register("installed"),
    onStartup: register("startup"),
    onMessage: register("message"),
  },
  identity: {
    getAuthToken: async (options) => {
      tokenRequests.push(options);
      return { token: "fixture-token" };
    },
    removeCachedAuthToken: async ({ token }) => removedTokens.push(token),
    clearAllCachedAuthTokens: async () => {},
  },
  storage: {
    local: {
      get: async (key) => ({ [key]: data.get(key) }),
      set: async (values) => Object.entries(values).forEach(([key, value]) => data.set(key, value)),
      remove: async (key) => [key].flat().forEach((entry) => data.delete(entry)),
      clear: async () => data.clear(),
    },
  },
  alarms: { onAlarm: register("alarm"), create: async () => {} },
};

const { performSync } = await import("../scripts/background.js");
const { authenticate } = await import("../utils/oauth.js");
const { KEYS } = await import("../utils/storage.js");

function alertMessage(id) {
  return {
    id,
    internalDate: String(Date.now()),
    payload: {
      headers: [
        { name: "From", value: "alerts@sbi.co.in" },
        { name: "Subject", value: "SBI transaction alert" },
      ],
      mimeType: "text/plain",
      body: { data: Buffer.from("Account debited for INR 320 on 22-Nov-2026 by Cafe.").toString("base64url") },
    },
  };
}

test("scans Gmail search pages, saves only actual parsed rows, and avoids duplicate reads", async (t) => {
  data.clear();
  data.set(KEYS.GMAIL_CONNECTED, true);
  data.set(KEYS.TRANSACTIONS, [{ id: "sal-0" }, { id: "tx-0-1234567890123" }]);
  const requests = [];
  t.mock.method(globalThis, "fetch", async (href, options) => {
    const url = new URL(href);
    requests.push(url);
    assert.equal(options.headers.Authorization, "Bearer fixture-token");
    if (url.pathname.endsWith("/messages")) {
      assert.match(url.searchParams.get("q"), /from:sbi.*after:\d+/i);
      if (!url.searchParams.has("pageToken")) {
        return Response.json({ messages: [{ id: "a" }], nextPageToken: "page-2" });
      }
      assert.equal(url.searchParams.get("pageToken"), "page-2");
      return Response.json({ messages: [{ id: "b" }] });
    }
    return Response.json(alertMessage(url.pathname.split("/").at(-1)));
  });

  await authenticate();
  assert.deepEqual(await performSync(), { ok: true, added: 2 });
  assert.deepEqual(tokenRequests.slice(-2), [{ interactive: true }, { interactive: false }]);
  assert.deepEqual(data.get(KEYS.TRANSACTIONS).map(({ id }) => id), ["gmail:a", "gmail:b"]);
  assert.ok(data.get(KEYS.LAST_SCAN));
  assert.deepEqual(await performSync(), { ok: true, added: 0 });
  assert.equal(requests.filter((url) => url.searchParams.has("format")).length, 2);
});

test("reports expired access, clears cached token, and retains the previous scan checkpoint", async (t) => {
  data.clear();
  data.set(KEYS.GMAIL_CONNECTED, true);
  data.set(KEYS.LAST_SCAN, "2026-11-22T00:00:00.000Z");
  t.mock.method(globalThis, "fetch", async (href) => {
    const url = new URL(href);
    if (url.pathname.endsWith("/messages")) return Response.json({ messages: [{ id: "a" }] });
    return new Response(null, { status: 401 });
  });

  const result = await performSync();
  assert.equal(result.ok, false);
  assert.match(result.error, /Reconnect in Settings/);
  assert.equal(data.get(KEYS.GMAIL_CONNECTED), false);
  assert.equal(data.get(KEYS.LAST_SCAN), "2026-11-22T00:00:00.000Z");
  assert.equal(removedTokens.at(-1), "fixture-token");
});

test("installation cleanup preserves real records and drops old demo data and tokens", async () => {
  data.clear();
  const real = { id: "gmail:a" };
  data.set(KEYS.TRANSACTIONS, [real, { id: "sal-2" }]);
  data.set("ep_oauth_token", "old-token");
  await listeners.installed({ reason: "update" });
  assert.deepEqual(data.get(KEYS.TRANSACTIONS), [real]);
  assert.equal(data.has("ep_oauth_token"), false);
});
