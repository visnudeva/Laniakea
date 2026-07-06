import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {
    getCentralAreaDivisor,
    getMaskRadius,
    getOverlayGeometry,
    isInsideMask,
    MASK_MODES,
} from '../mask.js';
import {loadMaskConfig} from './loadMaskConfig.mjs';

const WIDTH = 1920;
const HEIGHT = 1080;
const POINTS = [
    [WIDTH / 2, HEIGHT / 2],
    [0, 0],
    [WIDTH - 1, HEIGHT - 1],
    [120, 540],
    [1800, 540],
];

describe('maskConfig parity', () => {
    const browserMask = loadMaskConfig();

    it('exports the same mode names as mask.js', () => {
        assert.equal(
            JSON.stringify(browserMask.MASK_MODES),
            JSON.stringify(MASK_MODES),
        );
    });

    it('matches mask.js helpers', () => {
        assert.equal(
            browserMask.getCentralAreaDivisor(WIDTH),
            getCentralAreaDivisor(WIDTH),
        );
        assert.equal(
            browserMask.getMaskRadius(HEIGHT, WIDTH),
            getMaskRadius(HEIGHT, WIDTH),
        );
    });

    it('matches mask.js hit testing for every mode', () => {
        for (const mode of Object.values(MASK_MODES)) {
            for (const [x, y] of POINTS) {
                assert.equal(
                    browserMask.isInsideMask(x, y, WIDTH, HEIGHT, mode),
                    isInsideMask(x, y, WIDTH, HEIGHT, mode),
                    `mismatch for mode ${mode} at (${x}, ${y})`,
                );
            }
        }
    });
});
