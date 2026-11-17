import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('builds/main/entrypoint.mjs', 'utf8');
function fixture() {
  const loaded = [], requests = [];
  const context = vm.createContext({
    window: {}, AbortController, setTimeout, clearTimeout,
    FORK_RELEASE_HOST: 'lrc.vvrtx.lol',
    DEFAULT_API_HOST: 'api.spicylyrics.org', DEFAULT_STORAGE_HOST: 'public.storage.spicylyrics.org',
    REQUEST_TIMEOUT_MS: 5000, VERSION_PATTERN: /^[0-9A-Za-z.+-]+$/, IMPORT_ATTEMPTS: 3,
    withRetries: async (_count, task) => task(), isModuleFetchFailure: () => false,
    loadModule: async url => { loaded.push(url); },
    fetch: async url => {
      requests.push(url);
      return new Response(url.endsWith('grabClientInfo')
        ? JSON.stringify({ branches: [{tag: 'inDev', version: 'private'}, {tag: 'public', version: '6.5.10'}] })
        : '1.11.1');
    },
  });
  vm.runInContext(source.slice(source.indexOf('const usesOfficialStatus ='), source.indexOf('const STATUS_URL =')) +
    source.slice(source.indexOf('const fetchVersion ='), source.indexOf('const attemptLoad =')).replaceAll('import(', 'loadModule('), context);
  return { loaded, requests, context, run: code => vm.runInContext(code, context) };
}
const official = { apiHost: 'api.spicylyrics.org', storageHost: 'public.storage.spicylyrics.org', fixedVersion: null };
test('official channel resolves public metadata and loads through the upstream entry point', async () => {
  const f = fixture(); f.context.channel = official;
  assert.equal(await f.run('fetchVersion(channel)'), '6.5.10');
  await f.run('importExtension("6.5.10", channel, () => true)');
  assert.deepEqual(f.requests, ['https://api.spicylyrics.org/bp/loader/grabClientInfo']);
  assert.deepEqual(f.loaded, ['https://api.spicylyrics.org/bp/loader/grabPluginFile']);
  assert.equal(f.context.window._spicy_lyrics_metadata.LoadedVersion, '6.5.10');
});
test('fork and custom channels preserve their explicit version and bundle hosts', async () => {
  for (const host of ['lrc.vvrtx.lol', 'custom.example']) {
    const f = fixture(); f.context.channel = {apiHost: host, storageHost: host, fixedVersion: null};
    assert.equal(await f.run('fetchVersion(channel)'), '1.11.1');
    await f.run('importExtension("1.11.1", channel, () => true)');
    assert.deepEqual(f.requests, [`https://${host}/version`]);
    assert.deepEqual(f.loaded, [`https://${host}/spicy-lyrics@1.11.1.mjs`]);
  }
});
test('a pinned official-host channel never silently substitutes the latest official build', async () => {
  const f = fixture(); f.context.channel = {...official, fixedVersion: '6.4.70'};
  await f.run('importExtension("6.4.70", channel, () => true)');
  assert.deepEqual(f.loaded, ['https://public.storage.spicylyrics.org/spicy-lyrics@6.4.70.mjs']);
});
