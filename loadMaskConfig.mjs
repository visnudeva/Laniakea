import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const maskConfigPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'maskConfig.js',
);

export function loadMaskConfig() {
    const code = readFileSync(maskConfigPath, 'utf8');
    const sandbox = {globalThis: {}};
    sandbox.window = sandbox.globalThis;
    vm.runInNewContext(code, sandbox);
    return sandbox.globalThis.LaniakeaMask;
}
