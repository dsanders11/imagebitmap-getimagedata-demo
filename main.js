// Feature detect
const hasImageCapture = Boolean(window.ImageCapture);

document.querySelector('input[name="captureMethod"][value="ImageCapture.takePhoto"]').disabled = !Boolean(hasImageCapture && ImageCapture.prototype.takePhoto);
document.querySelector('input[name="captureMethod"][value="ImageCapture.grabFrame"]').disabled = !Boolean(hasImageCapture && ImageCapture.prototype.grabFrame);

document.getElementById('OffscreenCanvas').disabled = !Boolean(OffscreenCanvas);

const hasPatch = Boolean(window.ImageBitmap && ImageBitmap.prototype.getImageData);

document.getElementById('ImageBitmap-getImageData').disabled = !hasPatch;
document.getElementById('getImageDataOptions').disabled = !hasPatch;

document.getElementById('getImageDataMethods').disabled = true;

const videoEl = document.createElement('video');
const canvasEl = document.createElement('canvas');
const ctx = canvasEl.getContext('2d');

let capturer = null;

document.getElementById('startVideo').onclick = async (event) => {
  document.getElementById('getImageDataMethods').disabled = false;
  document.getElementById('captureResolutions').disabled = true;
  event.target.disabled = true;

  let width, height;

  const captureResolution = document.querySelector('[name="captureResolution"]:checked').value;

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

  let mediaStream;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { exact: width }, height: { exact: height } }
    })
  } catch (err) {
    console.error(err);
    alert(err.name);
    return;
  }

  if (hasImageCapture) {
    capturer = new ImageCapture(mediaStream.getVideoTracks()[0]);
  }

  videoEl.srcObject = mediaStream;
}

function disableUI () {
  Array.from(document.querySelectorAll('fieldset')).map(fieldset => {
    fieldset.disabled = true
  });
}

async function takePhotoCapturer () {
  return new Promise(resolve => {
    capturer.takePhoto();
    capturer.onphoto = blob => {
      resolve(createImageBitmap(blob));
    };
  })
}

const capturers = {
  'HTMLVideoElement': () => createImageBitmap(videoEl),
  'ImageCapture.takePhoto': takePhotoCapturer,
  'ImageCapture.grabFrame': () => capturer.grabFrame()
}

document.getElementById('CanvasRenderingContext2D').onclick = () => {
  disableUI();

  const captureMethod = document.querySelector('[name="captureMethod"]:checked').value;
  const capturer = capturers[captureMethod];

  runForever(capturer, 'CanvasRenderingContext2D');
}

document.getElementById('OffscreenCanvas').onclick = () => {
  disableUI();

  const captureMethod = document.querySelector('[name="captureMethod"]:checked').value;
  const capturer = capturers[captureMethod];

  runForever(capturer, 'OffscreenCanvas');
}

document.getElementById('ImageBitmap-getImageData').onclick = () => {
  disableUI();

  const captureMethod = document.querySelector('[name="captureMethod"]:checked').value;
  const capturer = capturers[captureMethod];

  runForever(capturer, 'ImageBitmap-getImageData');
}

const worker = new Worker('./worker.js');

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
    worker.onmessage = resolve;
  });
}

function sendImageBitmapAndWait (imageBitmap, options) {
  worker.postMessage({
    type: 'ImageBitmap',
    imageBitmap,
    options
  }, [ imageBitmap ]);

  return new Promise(resolve => {
    worker.onmessage = resolve;
  });
}

async function runForever (capturer, getImageDataMethod) {
  let getAndProcess;

  switch (getImageDataMethod) {
    case 'CanvasRenderingContext2D':
      getAndProcess = (frame) => {
        // getImageData happens on main thread
        ctx.drawImage(frame, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
        return sendImageDataAndWait(imageData);
      };
      break;

    case 'OffscreenCanvas':
      getAndProcess = (frame) => {
        return sendImageBitmapAndWait(frame, {
          method: 'OffscreenCanvas'
        });
      };
      break;

    case 'ImageBitmap-getImageData':
      getAndProcess = (frame) => {
        const options = {
          reuseImageData: document.querySelector('[name="reuseImageData"]').checked,
          neuter: document.querySelector('[name="neuter"]').checked
        }
        return sendImageBitmapAndWait(frame, {
          method: 'ImageBitmap',
          options
        });
      };
      break;
  }

  let runs = [];

  const avgColor = document.getElementById('avgColor');
  const fpsCounter = document.getElementById('fps');

  while (true) {
    const frame = await capturer()
    const result = await getAndProcess(frame)
    runs.push(performance.now());
    
    const secondAgo = performance.now() - 1000;
    runs = runs.filter(run => run >= secondAgo);
    const fps = runs.length;

    avgColor.style.background = `rgb(${result.join(',')})`;
    fpsCounter.innerText = `${fps} FPS`;
  }
}