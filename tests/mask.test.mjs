import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {
    MASK_MODES,
    getCentralAreaDivisor,
    getMaskRadius,
    getOverlayGeometry,
    isInsideMask,
} from '../mask.js';

const WIDTH = 1920;
const HEIGHT = 1080;
const CENTER = [WIDTH / 2, HEIGHT / 2];

describe('mask geometry', () => {
    it('uses a smaller divisor on narrow screens', () => {
        assert.equal(getCentralAreaDivisor(1920), 3);
        assert.equal(getCentralAreaDivisor(768), 4.5);
    });

    it('computes mask radius from monitor size', () => {
        assert.equal(getMaskRadius(1080, 1920), 360);
        assert.equal(getMaskRadius(900, 700), 200);
    });

    it('treats wide and legacy none modes as full-screen', () => {
        assert.equal(isInsideMask(0, 0, WIDTH, HEIGHT, MASK_MODES.WIDE), true);
        assert.equal(isInsideMask(WIDTH - 1, HEIGHT - 1, WIDTH, HEIGHT, 'none'), true);
    });

    it('includes center and excludes far corners for circle', () => {
        const [cx, cy] = CENTER;
        assert.equal(isInsideMask(cx, cy, WIDTH, HEIGHT, MASK_MODES.CIRCLE), true);
        assert.equal(isInsideMask(0, 0, WIDTH, HEIGHT, MASK_MODES.CIRCLE), false);
    });

    it('matches triangle, diamond, hexagon, and rectangle modes', () => {
        const [cx, cy] = CENTER;

        assert.equal(isInsideMask(cx, cy, WIDTH, HEIGHT, MASK_MODES.TRIANGLE_UP), true);
        assert.equal(isInsideMask(cx, cy + 400, WIDTH, HEIGHT, MASK_MODES.TRIANGLE_UP), false);

        assert.equal(isInsideMask(cx, cy, WIDTH, HEIGHT, MASK_MODES.TRIANGLE_DOWN), true);
        assert.equal(isInsideMask(cx, cy - 400, WIDTH, HEIGHT, MASK_MODES.TRIANGLE_DOWN), false);

        assert.equal(isInsideMask(cx, cy, WIDTH, HEIGHT, MASK_MODES.DIAMOND), true);
        assert.equal(isInsideMask(0, 0, WIDTH, HEIGHT, MASK_MODES.DIAMOND), false);

        assert.equal(isInsideMask(cx, cy, WIDTH, HEIGHT, MASK_MODES.HEXAGON), true);
        assert.equal(isInsideMask(0, 0, WIDTH, HEIGHT, MASK_MODES.HEXAGON), false);

        assert.equal(
            isInsideMask(cx, cy, WIDTH, HEIGHT, MASK_MODES.RECTANGLE_VERTICAL),
            true,
        );
        assert.equal(
            isInsideMask(cx + 300, cy, WIDTH, HEIGHT, MASK_MODES.RECTANGLE_VERTICAL),
            false,
        );

        assert.equal(
            isInsideMask(cx, cy, WIDTH, HEIGHT, MASK_MODES.RECTANGLE_HORIZONTAL),
            true,
        );
        assert.equal(
            isInsideMask(cx, cy + 300, WIDTH, HEIGHT, MASK_MODES.RECTANGLE_HORIZONTAL),
            false,
        );
    });

    it('returns full monitor geometry for wide overlay', () => {
        const monitor = {x: 100, y: 50, width: WIDTH, height: HEIGHT};
        assert.deepEqual(getOverlayGeometry(monitor, MASK_MODES.WIDE), monitor);
        assert.deepEqual(getOverlayGeometry(monitor, 'none'), monitor);
    });

    it('returns centered square overlay for shaped masks', () => {
        const monitor = {x: 0, y: 0, width: WIDTH, height: HEIGHT};
        const radius = getMaskRadius(HEIGHT, WIDTH);
        const size = radius * 2;

        assert.deepEqual(getOverlayGeometry(monitor, MASK_MODES.CIRCLE), {
            x: (WIDTH - size) / 2,
            y: (HEIGHT - size) / 2,
            width: size,
            height: size,
        });
    });
});
