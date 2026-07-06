import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {MASK_MODES} from '../mask.js';
import {
    MASK_MODE_LABELS,
    MASK_MODE_VALUES,
    maskModeIndex,
} from '../maskModes.js';

describe('mask mode preferences', () => {
    it('keeps labels and values aligned', () => {
        assert.equal(MASK_MODE_LABELS.length, MASK_MODE_VALUES.length);
    });

    it('covers every supported mask mode', () => {
        const exportedModes = new Set(Object.values(MASK_MODES));
        for (const value of MASK_MODE_VALUES)
            assert.ok(exportedModes.has(value), `missing mask mode ${value}`);
    });

    it('maps legacy none to wide', () => {
        assert.equal(maskModeIndex('none'), maskModeIndex('wide'));
    });

    it('falls back to circle for unknown values', () => {
        assert.equal(maskModeIndex('crescent'), 0);
        assert.equal(maskModeIndex('star'), 0);
        assert.equal(maskModeIndex('unknown-shape'), 0);
    });

    it('round-trips every preference value', () => {
        for (let index = 0; index < MASK_MODE_VALUES.length; index++)
            assert.equal(maskModeIndex(MASK_MODE_VALUES[index]), index);
    });
});
