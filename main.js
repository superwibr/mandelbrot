// Create off-screen canvases
const fractalCanvas = document.createElement('canvas');
const fractalCtx = fractalCanvas.getContext('2d');

const uiCanvas = document.createElement('canvas');
const uiCtx = uiCanvas.getContext('2d');

// Create the on-screen render canvas
const renderCanvas = document.getElementById('canvas');
const renderCtx = renderCanvas.getContext('2d');

// Set initial sizes
function resizeCanvases() {
	const width = window.innerWidth;
	const height = window.innerHeight;

	// Resize all canvases
	fractalCanvas.width = width;
	fractalCanvas.height = height;

	uiCanvas.width = width;
	uiCanvas.height = height;

	renderCanvas.width = width;
	renderCanvas.height = height;

	// Re-render everything on resize
	renderFractal();
	drawViewfinder();
	compositeCanvases();
}

// Fractal Parameters
let centerX = -0.75; // Starting x-coordinate
let centerY = 0;     // Starting y-coordinate
let zoom = 200;      // Pixels per unit
let maxIterationsCap = 2000; // Default iteration count

let showUI = true;

// Worker Setup
const workerCount = navigator.hardwareConcurrency || 4; // Use available threads
const workers = [];
let pendingWorkers = 0;

for (let i = 0; i < workerCount; i++) {
	workers[i] = new Worker('worker.js');
}

// Fractal Rendering Function
function renderFractal() {
	const width = fractalCanvas.width;
	const height = fractalCanvas.height;
	const maxIterations = Math.min(maxIterationsCap, Math.floor(50 + zoom / 10));
	const imageData = fractalCtx.createImageData(width, height);

	// Divide work among workers
	const rowsPerWorker = Math.ceil(height / workerCount);
	pendingWorkers = workerCount;

	workers.forEach((worker, index) => {
		const startRow = index * rowsPerWorker;
		const endRow = Math.min(startRow + rowsPerWorker, height);

		worker.postMessage({
			centerX,
			centerY,
			zoom,
			width,
			height,
			startRow,
			endRow,
			maxIterations,
		});

		worker.onmessage = (e) => {
			for (const { row, data } of e.data) {
				// Copy computed data into imageData
				for (let i = 0; i < data.length; i++) {
					const pixelIndex = (row * width + i) * 4;
					imageData.data.set(data[i], pixelIndex);
				}
			}
			pendingWorkers--;
			if (pendingWorkers === 0) {
				fractalCtx.putImageData(imageData, 0, 0);
				drawViewfinder(); // Draw viewfinder on the rendered fractal
				compositeCanvases();
			}
		};
	});
}

function drawViewfinder() {
	// Clear the UI canvas
	uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

	if (!showUI) return; // Skip if UI is toggled off

	// Calculate viewfinder size and position
	const viewWidth = uiCanvas.width / zoom;
	const viewHeight = uiCanvas.height / zoom;
	const viewX = (uiCanvas.width - viewWidth) / 2;
	const viewY = (uiCanvas.height - viewHeight) / 2;

	// Draw central dot
	uiCtx.save();
	uiCtx.globalAlpha = 0.5; // Lower opacity

	const dotX = uiCanvas.width / 2;
	const dotY = uiCanvas.height / 2;
	uiCtx.fillStyle = 'red';
	uiCtx.beginPath();
	uiCtx.arc(dotX, dotY, 5, 0, Math.PI * 2); // Small circle in the center
	uiCtx.fill();
	uiCtx.restore();

	// Draw overlay text
	uiCtx.save();
	uiCtx.font = '16px Arial';
	uiCtx.fillStyle = 'white';
	uiCtx.textAlign = 'left';

	// Display zoom and position
	const textX = 10, textY = 20;
	uiCtx.fillText(`Steps: ${Math.min(maxIterationsCap, Math.floor(50 + zoom / 10)).toFixed(2)} (max ${maxIterationsCap})`, textX, textY);
	uiCtx.fillText(`Zoom: ${zoom.toFixed(2)}`, textX, textY + 20);
	uiCtx.fillText(`Center: (${centerX.toFixed(8)}, ${centerY.toFixed(8)})`, textX, textY + 40);

	// Display keybinds
	const keybinds = [
		'WASD: Move',
		'Q/E: Zoom Out/In',
		'Space: Render',
		'1/2: Remove/Add 100 steps',
		'Shift: Toggle UI'
	];
	keybinds.forEach((text, i) => {
		uiCtx.fillText(text, textX, textY + 70 + i * 20);
	});
	uiCtx.restore();
}

function compositeCanvases() {
	// Clear the render canvas
	renderCtx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);

	// Draw the fractal first
	renderCtx.drawImage(fractalCanvas, 0, 0);

	// Draw the UI layer on top
	renderCtx.drawImage(uiCanvas, 0, 0);
}


// Helper: Transform Canvas for Movement and Zoom
function transformCanvas(moveX, moveY, scale) {
	const tempCanvas = document.createElement('canvas');
	const tempCtx = tempCanvas.getContext('2d');

	tempCanvas.width = fractalCanvas.width;
	tempCanvas.height = fractalCanvas.height;

	// Copy the current canvas content to a temporary canvas
	tempCtx.drawImage(fractalCanvas, 0, 0);

	// Clear the main canvas
	fractalCtx.clearRect(0, 0, fractalCanvas.width, fractalCanvas.height);

	// Apply transformations
	fractalCtx.save();

	// Scale the movement to canvas pixels (moveX and moveY are in fractal space)
	const pixelMoveX = moveX * zoom; // Convert to pixel coordinates
	const pixelMoveY = moveY * zoom;

	// Apply translations and scaling
	fractalCtx.translate(pixelMoveX, pixelMoveY); // Shift the canvas
	fractalCtx.scale(scale, scale);              // Apply zoom
	fractalCtx.drawImage(tempCanvas, 0, 0);      // Redraw the image

	fractalCtx.restore();

	// Update the composite view
	drawViewfinder(); // Ensure the viewfinder reflects changes
	compositeCanvases();
}

// Input Controls
const keys = {};
const zoomFactor = 1.5; // Constant zoom factor
const stepStep = 100;
document.addEventListener('keyup', e => delete keys[e.code]);
document.addEventListener('keydown', e => {
	keys[e.code] = true;
	console.log(e.code);

	if (keys.KeyQ) {
		// Zoom Out
		const zoomOutFactor = 1 / zoomFactor;
		const zoomOutMoveX = fractalCanvas.width * (1 - zoomOutFactor) / 2;  // Adjust for center focus
		const zoomOutMoveY = fractalCanvas.height * (1 - zoomOutFactor) / 2;
		transformCanvas(zoomOutMoveX / zoom, zoomOutMoveY / zoom, zoomOutFactor);
		zoom *= zoomOutFactor;
		drawViewfinder();
		compositeCanvases();
	}
	if (keys.KeyE) {
		// Zoom In
		const zoomInMoveX = fractalCanvas.width * (zoomFactor - 1) / 2;  // Adjust for center focus
		const zoomInMoveY = fractalCanvas.height * (zoomFactor - 1) / 2;
		transformCanvas(-zoomInMoveX / zoom, -zoomInMoveY / zoom, zoomFactor);
		zoom *= zoomFactor;
		drawViewfinder();
		compositeCanvases();
	}

	if (keys.Space) renderFractal(); // Recompute the fractal

	if(keys.Digit1){
		// Decrease steps
		maxIterationsCap -= stepStep;
		drawViewfinder();
		compositeCanvases();
	}
	if(keys.Digit2){
		// Increase steps
		maxIterationsCap += stepStep;
		drawViewfinder();
		compositeCanvases();
	}

	if (keys.ShiftLeft) {
		// Toggle UI
		showUI = !showUI;
		drawViewfinder();
		compositeCanvases();
	}
});
setInterval(() => {
	const moveSpeed = 1 / zoom; // Speed scales inversely with zoom level

	if (keys.KeyW) {
		transformCanvas(0, moveSpeed, 1); // Move up
		centerY -= moveSpeed;
	}
	if (keys.KeyS) {
		transformCanvas(0, -moveSpeed, 1); // Move down
		centerY += moveSpeed;
	}
	if (keys.KeyA) {
		transformCanvas(moveSpeed, 0, 1); // Move left
		centerX -= moveSpeed;
	}
	if (keys.KeyD) {
		transformCanvas(-moveSpeed, 0, 1); // Move right
		centerX += moveSpeed;
	}
}, 1000 / 100);

resizeCanvases(); // TODO auto resize
renderFractal(); // Initial rendering