// SPDX-License-Identifier: GPL-3.0-or-later
// Shared mask geometry for index.html (loaded via script tag).

(function (global) {
    const MASK_MODES = {
        CIRCLE: 'circle',
        TRIANGLE_UP: 'triangle-up',
        TRIANGLE_DOWN: 'triangle-down',
        DIAMOND: 'diamond',
        HEXAGON: 'hexagon',
        RECTANGLE_VERTICAL: 'rectangle-vertical',
        RECTANGLE_HORIZONTAL: 'rectangle-horizontal',
        WIDE: 'wide',
    };

    function getCentralAreaDivisor(width) {
        return width > 768 ? 3 : 4.5;
    }

    function getMaskRadius(height, width) {
        return height / getCentralAreaDivisor(width);
    }

    function sign(px, py, x1, y1, x2, y2) {
        return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
    }

    function pointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
        const d1 = sign(px, py, x1, y1, x2, y2);
        const d2 = sign(px, py, x2, y2, x3, y3);
        const d3 = sign(px, py, x3, y3, x1, y1);
        const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
        const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
        return !(hasNeg && hasPos);
    }

    function pointInPolygon(px, py, vertices) {
        let inside = false;

        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const [xi, yi] = vertices[i];
            const [xj, yj] = vertices[j];

            if (((yi > py) !== (yj > py)) &&
                px < (xj - xi) * (py - yi) / (yj - yi) + xi)
                inside = !inside;
        }

        return inside;
    }

    function regularPolygonVertices(cx, cy, radius, sides, startAngle = -Math.PI / 2) {
        const vertices = [];

        for (let i = 0; i < sides; i++) {
            const angle = startAngle + i * (2 * Math.PI / sides);
            vertices.push([
                cx + radius * Math.cos(angle),
                cy + radius * Math.sin(angle),
            ]);
        }

        return vertices;
    }

    function pointInDiamond(px, py, cx, cy, radius) {
        return Math.abs(px - cx) + Math.abs(py - cy) < radius;
    }

    function pointInRectangle(px, py, cx, cy, halfWidth, halfHeight) {
        return Math.abs(px - cx) <= halfWidth && Math.abs(py - cy) <= halfHeight;
    }

    function isInsideMask(x, y, width, height, mode) {
        if (mode === MASK_MODES.WIDE || mode === 'none')
            return true;

        const cx = width / 2;
        const cy = height / 2;
        const radius = getMaskRadius(height, width);

        switch (mode) {
        case MASK_MODES.TRIANGLE_UP:
            return pointInTriangle(
                x, y,
                cx, cy - radius,
                cx - radius, cy + radius,
                cx + radius, cy + radius,
            );
        case MASK_MODES.TRIANGLE_DOWN:
            return pointInTriangle(
                x, y,
                cx, cy + radius,
                cx - radius, cy - radius,
                cx + radius, cy - radius,
            );
        case MASK_MODES.DIAMOND:
            return pointInDiamond(x, y, cx, cy, radius);
        case MASK_MODES.HEXAGON:
            return pointInPolygon(
                x, y,
                regularPolygonVertices(cx, cy, radius, 6),
            );
        case MASK_MODES.RECTANGLE_VERTICAL:
            return pointInRectangle(x, y, cx, cy, radius * 0.5, radius);
        case MASK_MODES.RECTANGLE_HORIZONTAL:
            return pointInRectangle(x, y, cx, cy, radius, radius * 0.5);
        default:
            return Math.hypot(x - cx, y - cy) < radius;
        }
    }

    global.LaniakeaMask = {
        MASK_MODES,
        getCentralAreaDivisor,
        getMaskRadius,
        isInsideMask,
    };
})(typeof window !== 'undefined' ? window : globalThis);
