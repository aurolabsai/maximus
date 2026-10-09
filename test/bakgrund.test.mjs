import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plist, etikett, plistVag } from '../lib/bakgrund.mjs';

test('etiketten är per datakatalog, så att ett prov aldrig rör användarens jobb', () => {
  assert.notEqual(etikett('/Users/x/Library/Application Support/Maximus', 'bakgrund'), etikett('/tmp/maximus-prov', 'bakgrund'));
  assert.match(plistVag('/tmp/a', 'bakgrund', '/Users/x'), /^\/Users\/x\/Library\/LaunchAgents\/ai\.aurolabs\.maximus\.bakgrund\.[0-9a-f]{10}\.plist$/);
});

test('bakgrunden: node kör servern med samma miljö, väntar på porten, startas om bara vid fel', () => {
  const x = plist({ sort: 'bakgrund', data: '/tmp/d & e', node: '/a/node', server: '/a/backend', resurser: '/a/res', port: 3261, stig: '/usr/bin', app: '/A.app/Contents/MacOS/maximus' });
  assert.match(x, /<string>\/a\/node<\/string>\s*<string>\/a\/backend\/server\.mjs<\/string>\s*<string>--tyst<\/string>/);
  assert.match(x, /<key>MAXIMUS_LAUNCHD<\/key><string>1<\/string>/);
  assert.match(x, /<key>MAXIMUS_DATA<\/key><string>\/tmp\/d &amp; e<\/string>/, 'XML-rymt');
  assert.match(x, /<key>KeepAlive<\/key><dict><key>SuccessfulExit<\/key><false\/><\/dict>/);
  assert.match(x, /<key>RunAtLoad<\/key><true\/>/);
});

test('inloggningen: en .app öppnas med open, dold med --dold', () => {
  const x = plist({ sort: 'inloggning', data: '/d', port: 3261, app: '/Applications/Maximus.app/Contents/MacOS/maximus', dold: true });
  assert.match(x, /<string>\/usr\/bin\/open<\/string>\s*<string>-a<\/string>\s*<string>\/Applications\/Maximus\.app<\/string>\s*<string>--args<\/string>\s*<string>--dold<\/string>/);
  assert.match(x, /<key>KeepAlive<\/key><false\/>/, 'appen startas inte om när du stänger den');
});
