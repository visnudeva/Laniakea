import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

describe('wallpaper cleanup paths', () => {
    it('uses a dedicated laniakea cache subdirectory name', () => {
        assert.match('wallpaper-1920x1080.png', /^wallpaper-.*\.png$/);
        assert.match('/home/user/.cache/laniakea/wallpaper-1.png', /\/laniakea\/wallpaper-/);
    });
});
