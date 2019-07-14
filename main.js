// Feature detect
const hasImageCapture = Boolean(window.ImageCapture);

// takePhoto only supports the Firefox version
document.querySelector('input[name="captureMethod"][value="ImageCapture.takePhoto"]').disabled = !Boolean(hasImageCapture && Object.keys(ImageCapture.prototype).includes('onphoto'));
document.querySelector('input[name="captureMethod"][value="ImageCapture.grabFrame"]').disabled = !Boolean(hasImageCapture && ImageCapture.prototype.grabFrame);

let hasOffscreenCanvas = Boolean(window.OffscreenCanvas);

if (hasOffscreenCanvas) {
  try {
    new OffscreenCanvas(1, 1).getContext('2d')
  } catch {
    hasOffscreenCanvas = false;
  }
}

document.getElementById('OffscreenCanvas').disabled = !hasOffscreenCanvas;

const hasPatch = Boolean(window.ImageBitmap && ImageBitmap.prototype.getImageData);

document.getElementById('ImageBitmap-getImageData').disabled = !hasPatch;

document.getElementById('getImageDataMethods').disabled = true;

const videoEl = document.createElement('video');
videoEl.autoplay = true;

const canvasEl = document.createElement('canvas');
const ctx = canvasEl.getContext('2d');

let mediaStream;
let capturer = null;
let videoStarted = false;

document.getElementById('startVideo').onclick = async (event) => {
  document.getElementById('videoCaptureFieldset').disabled = true;
  event.target.disabled = true;

  let width, height;

  const captureResolution = document.querySelector('[name="captureResolution"]:checked').value;
  const captureFrameRate = parseInt(document.querySelector('[name="captureFrameRate"]:checked').value);

  switch (captureResolution) {
    case '1080p':
      width = 1920;
      height = 1080;
      break;
    
    case '720p':
      width = 1280;
      height = 720;
      break;

    case '480p':
      width = 640;
      height = 480;
      break;
  }

  canvasEl.width = width;
  canvasEl.height = height;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { exact: width },
        height: { exact: height },
        frameRate: { exact: captureFrameRate }
      }
    })
  } catch (err) {
    console.error(err);
    alert(err.name);
    return;
  }

  document.getElementById('captureMethods').disabled = false;
  document.getElementById('getImageDataOptions').disabled = !hasPatch;
  document.getElementById('getImageDataMethods').disabled = false;
}

function disableUI () {
  Array.from(document.querySelectorAll('fieldset')).map(fieldset => {
    fieldset.disabled = true
  });
}

async function takePhotoCapturer () {
  if (capturer === null) {
    capturer = new ImageCapture(mediaStream.getVideoTracks()[0]);
  }

  return new Promise(resolve => {
    capturer.takePhoto();
    capturer.onphoto = event => {
      resolve(createImageBitmap(event.data));
    };
  })
}

const frameCapturers = {
  'HTMLVideoElement': () => {
    if (!videoStarted) {
      videoEl.srcObject = mediaStream;
      videoStarted = true;

      return new Promise(resolve => {
        videoEl.oncanplay = () => {
          resolve(createImageBitmap(videoEl));
        }
      });
    }

    return createImageBitmap(videoEl);
  },
  'ImageCapture.takePhoto': takePhotoCapturer,
  'ImageCapture.grabFrame': () => {
    if (capturer === null) {
      capturer = new ImageCapture(mediaStream.getVideoTracks()[0]);
    }

    return capturer.grabFrame()
  }
}

document.getElementById('CanvasRenderingContext2D').onclick = () => {
  runForever('CanvasRenderingContext2D');
}

document.getElementById('OffscreenCanvas').onclick = () => {
  runForever('OffscreenCanvas');
}

document.getElementById('ImageBitmap-getImageData').onclick = () => {
  runForever('ImageBitmap-getImageData');
}

document.getElementById('workerNoOp').onclick = () => {
  runForever(null);
}

const worker = new Worker('./worker.js');

let pendingPromiseResolver = null;

worker.onmessage = event => {
  pendingPromiseResolver(event.data);
};

function sendImageDataAndWait (imageData) {
  worker.postMessage({
    type: 'ImageData',
    imageData: {
      width: imageData.width,
      height: imageData.height,
      buffer: imageData.data.buffer
    }
  }, [ imageData.data.buffer ]);

  return new Promise(resolve => {
    pendingPromiseResolver = resolve;
  });
}

function sendImageBitmapAndWait (imageBitmap, options) {
  worker.postMessage({
    type: 'ImageBitmap',
    imageBitmap,
    options
  }, [ imageBitmap ]);

  return new Promise(resolve => {
    pendingPromiseResolver = resolve;
  });
}

function sendWorkerNoOp (imageBitmap) {
  worker.postMessage({
    type: 'NoOp',
    imageBitmap
  }, [ imageBitmap ]);

  return new Promise(resolve => {
    pendingPromiseResolver = resolve;
  });
}

async function runForever (getImageDataMethod) {
  disableUI();

  const captureMethod = document.querySelector('[name="captureMethod"]:checked').value;
  const captureFrame = frameCapturers[captureMethod];

  let processFrame;

  switch (getImageDataMethod) {
    case null:
      processFrame = sendWorkerNoOp;
      break;

    case 'CanvasRenderingContext2D':
      processFrame = (frame) => {
        // getImageData happens on main thread
        ctx.drawImage(frame, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
        return sendImageDataAndWait(imageData);
      };
      break;

    case 'OffscreenCanvas':
      processFrame = (frame) => {
        return sendImageBitmapAndWait(frame, {
          method: 'OffscreenCanvas'
        });
      };
      break;

    case 'ImageBitmap-getImageData':
      const options = {
        reuseBuffer: document.querySelector('[name="reuseBuffer"]').checked,
        neuter: document.querySelector('[name="neuter"]').checked
      };

      processFrame = (frame) => {
        return sendImageBitmapAndWait(frame, {
          method: 'ImageBitmap',
          options
        });
      };
      break;
  }

  let runs = [];
  let workerTimings = [];

  const avgColor = document.getElementById('avgColor');
  const fpsCounter = document.getElementById('fps');
  const workerFPS = document.getElementById('workerFPS');

  const mean = (array) => array.reduce((a, b) => a + b) / array.length;

  let framePromise = captureFrame();

  while (true) {
    const resultPromise = processFrame(await framePromise);
    framePromise = captureFrame();

    // Measure the run time of the worker for the frame
    const start = performance.now();
    const result = await resultPromise;
    const now = performance.now();

    workerTimings.unshift(now - start);
    workerTimings = workerTimings.slice(0, 60);

    runs.push(now);
    
    const timeCutoff = now - 2000;
    runs = runs.filter(run => run >= timeCutoff);
    const fps = runs.length/2;

    avgColor.style.background = `rgb(${result.join(',')})`;
    fpsCounter.innerText = `Overall: ${fps.toFixed(0)} FPS`;

    if (getImageDataMethod === null) {
      workerFPS.innerText = '';
    } else {
      workerFPS.innerText = `Worker: ${(1000/mean(workerTimings)).toFixed(0)} FPS`;
    }
  }
}