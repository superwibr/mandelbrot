// Mandelbrot Iteration Function
function mandelbrot(cx, cy, maxIterations) {
    let x = 0, y = 0, iteration = 0;

    while (x * x + y * y <= 4 && iteration < maxIterations) {
        const xTemp = x * x - y * y + cx;
        y = 2 * x * y + cy;
        x = xTemp;
        iteration++;
    }

    return iteration;
}

// Color Mapping Function
function getColor(iteration, maxIterations) {
    if (iteration === maxIterations) {
        // Inside the set; render as black
        return [0, 0, 0, 255];
    }

    // Smooth coloring for fractional iterations
    const smoothIter = iteration + 1 - Math.log(Math.log2(Math.abs(iteration)));
    const hue = 360 * (smoothIter / maxIterations); // Map to full hue cycle
    const saturation = 100; // Full saturation
    const lightness = 50;   // Moderate lightness for contrast

    // Convert HSL to RGB
    const [r, g, b] = hslToRgb(hue / 360, saturation / 100, lightness / 100);
    return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255), 255];
}

// Convert HSL to RGB
function hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
        r = g = b = l; // Achromatic
    } else {
        const hueToRgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hueToRgb(p, q, h + 1 / 3);
        g = hueToRgb(p, q, h);
        b = hueToRgb(p, q, h - 1 / 3);
    }

    return [r, g, b];
}


// Worker Message Handler
onmessage = (e) => {
    const { centerX, centerY, zoom, width, height, startRow, endRow, maxIterations } = e.data;

    const rowData = [];
    for (let row = startRow; row < endRow; row++) {
        const rowPixels = [];
        for (let col = 0; col < width; col++) {
            const cx = centerX + (col - width / 2) / zoom;
            const cy = centerY + (row - height / 2) / zoom;

            const iteration = mandelbrot(cx, cy, maxIterations);
            rowPixels.push(getColor(iteration, maxIterations));
        }
        rowData.push({ row, data: rowPixels });
    }

    postMessage(rowData);
};
