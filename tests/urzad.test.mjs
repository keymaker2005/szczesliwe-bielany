import assert from 'node:assert/strict';
import test from 'node:test';
import { URZAD, urzadMode, PEDESTRIAN_CONTACT } from '../js/city-config.js';

test('?urzad in the address switches the district office version on', () => {
  assert.equal(urzadMode('?urzad'), true);
  assert.equal(urzadMode('?urzad=1&x=2'), true);
  assert.equal(urzadMode('?x=2'), false);
  assert.equal(urzadMode(''), false);
});

test('outside a browser the game runs as usual: no office version, pedestrians are solid', () => {
  assert.equal(URZAD, false);
  assert.equal(PEDESTRIAN_CONTACT, true);
});
