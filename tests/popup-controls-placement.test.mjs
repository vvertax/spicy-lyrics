import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('src/components/Utils/NowBar.ts', 'utf8');
const start = source.indexOf('function shouldPlacePlaybackControlsOutsideMediaContent()');
const end = source.indexOf('function PositionTimelineElement(', start);
test('popup and compact controls stay in the queued media content under every pinned-controls preference', () => {
  for (const preference of ['None', 'Time', 'Controls', 'Both', 'All']) {
    for (const pip of [false, true]) for (const compact of [false, true]) {
      const context = vm.createContext({ IsPIP: pip, IsCompactMode: () => compact, $alwaysShowInFullscreen: { get: () => preference } });
      const actual = vm.runInContext(source.slice(start, end) + '\nshouldPlacePlaybackControlsOutsideMediaContent();', context);
      assert.equal(actual, !pip && !compact && ['Controls', 'Both', 'All'].includes(preference), `${preference}, popup=${pip}, compact=${compact}`);
    }
  }
});
