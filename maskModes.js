// SPDX-License-Identifier: GPL-3.0-or-later

export const MASK_MODE_LABELS = [
    'Circle',
    'Triangle up',
    'Triangle down',
    'Diamond',
    'Hexagon',
    'Vertical rectangle',
    'Horizontal rectangle',
    'Wide',
];

export const MASK_MODE_VALUES = [
    'circle',
    'triangle-up',
    'triangle-down',
    'diamond',
    'hexagon',
    'rectangle-vertical',
    'rectangle-horizontal',
    'wide',
];

export function maskModeIndex(value) {
    if (value === 'none')
        value = 'wide';

    const index = MASK_MODE_VALUES.indexOf(value);
    return index >= 0 ? index : 0;
}
