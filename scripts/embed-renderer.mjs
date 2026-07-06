import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = readFileSync(join(root, 'renderer', 'laniakea-renderer.gs'), 'utf8');
const lines = script.split('\n').map(line => `    ${JSON.stringify(line)}`).join(',\n');

writeFileSync(
    join(root, 'rendererScript.js'),
    [
        '// SPDX-License-Identifier: GPL-3.0-or-later',
        '// Generated from renderer/laniakea-renderer.gs',
        '',
        'export const RENDERER_VERSION = \'2\';',
        'export const RENDERER_SCRIPT = [',
        lines,
        '].join(\'\\n\');',
        '',
    ].join('\n'),
);
