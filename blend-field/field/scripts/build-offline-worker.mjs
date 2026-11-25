import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

async function files(directory) {
  const result = [];
  for (const entry of await readdir("dist" + directory, { withFileTypes: true })) {
    const path = directory + "/" + entry.name;
    if (entry.isDirectory()) result.push(...await files(path));
    else if (path !== "/offline-worker.js") result.push(path);
  }
  return result.sort();
}

const paths = await files("");
const hash = createHash("sha256");
for (const path of paths) hash.update(await readFile("dist" + path));
const cacheName = "blend-field-" + hash.digest("hex").slice(0, 16);
await writeFile("dist/offline-worker.js", `
const cacheName = ${JSON.stringify(cacheName)};
const files = ${JSON.stringify(paths)};
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(files)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("blend-field-") && key !== cacheName).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.open(cacheName).then((cache) => cache.match("/index.html"))));
  } else if (files.includes(url.pathname)) {
    event.respondWith(caches.open(cacheName).then((cache) => cache.match(url.pathname)).then((hit) => hit || fetch(event.request)));
  }
});
`);
