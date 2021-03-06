// Feature detect
const hasImageCapture = Boolean(window.ImageCapture);

// takePhoto only supports the Firefox version
document.querySelector('input[name="captureMethod"][value="ImageCapture.takePhoto"]').disabled = !Boolean(hasImageCapture && Object.keys(ImageCapture.prototype).includes('onphoto'));

// onframe is patched in
document.querySelector('input[name="captureMethod"][value="ImageCapture.onframe"]').disabled = !Boolean(hasImageCapture && Object.keys(ImageCapture.prototype).includes('onframe'));

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
let videoStarted = false;

let capturer = null;

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
  },
  // Use onframe to provide an implementation similar to how you'd
  // get frames directly from a video driver.
  //   * Dropped = We ran out of userland buffers
  //   * Discarded = Browser implementation discarded frame to save memory
  'ImageCapture.onframe': (function() {
    const bufferCount = 2;
    let buffers = [];

    let pendingOnFramePromiseResolver = null;

    return async () => {
      if (capturer === null) {
        capturer = new ImageCapture(mediaStream.getVideoTracks()[0]);
        capturer.onframe = async (event) => {
          // We got a new frame while the previous frame was unclaimed,
          // so that's a frame we had to drop due to being too slow
          // We ran out of buffers, so we had to drop a frame due to
          // being too slow
          if (buffers.length === bufferCount) {
            const frame = buffers.shift();
            frame.close();  // Dispose of memory
            console.log('Frame dropped');
          }

          try {
            buffers.push(await event.createImageBitmap());
          } catch {
            // JS execution was too slow and another frame was delivered
            // before we could grab the data from the browser
            console.log('Frame was discarded');
            return;
          }

          if (pendingOnFramePromiseResolver) {
            // Pending promise, consume the latest frame
            pendingOnFramePromiseResolver(buffers.shift());
            pendingOnFramePromiseResolver = null;
          }
        }
      }

      if (buffers.length) {
        // Frame available, so consume it
        return buffers.shift();
      }

      // No frame available, wait for next one
      return new Promise(resolve => {
        pendingOnFramePromiseResolver = resolve;
      });
    }
  })()
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

let pendingWorkerPromiseResolver = null;

worker.onmessage = event => {
  pendingWorkerPromiseResolver(event.data);
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
    pendingWorkerPromiseResolver = resolve;
  });
}

function sendImageBitmapAndWait (imageBitmap, options) {
  worker.postMessage({
    type: 'ImageBitmap',
    imageBitmap,
    options
  }, [ imageBitmap ]);

  return new Promise(resolve => {
    pendingWorkerPromiseResolver = resolve;
  });
}

function sendWorkerNoOp (imageBitmap) {
  worker.postMessage({
    type: 'NoOp',
    imageBitmap
  }, [ imageBitmap ]);

  return new Promise(resolve => {
    pendingWorkerPromiseResolver = resolve;
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
    try {
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
      fpsCounter.innerText = `Overall: ${Math.floor(fps)} FPS`;

      if (getImageDataMethod === null) {
        workerFPS.innerText = '';
      } else {
        workerFPS.innerText = `Worker: ${Math.floor(1000/mean(workerTimings))} FPS`;
      }
    } catch (err) {
      console.error('Unexpected error');
      console.error(err);
    }
  }
}