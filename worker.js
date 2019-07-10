const xStride = 10;
const yStride = 10;

let imageData = null;
let offscreenCanvas = null;
let offscreenCtx = null;

onmessage = async (event) => {
  const { type: payloadType, workerNoOp } = event.data;

  if (workerNoOp) {
    postMessage([ 0, 0, 0 ]);
  } else if (payloadType === 'ImageData') {
    const { width, height, buffer } = event.data.imageData;
    const data = new Uint8ClampedArray(buffer);

    postMessage(getAverageColor(new ImageData(data, width, height)));
  } else if (payloadType === 'ImageBitmap') {
    const imageBitmap = event.data.imageBitmap;
    const { width, height } = imageBitmap;
    const { method, options } = event.data.options;

    if (method === 'OffscreenCanvas') {
      if (offscreenCanvas === null) {
        offscreenCanvas = new OffscreenCanvas(width, height);
        offscreenCtx = offscreenCanvas.getContext('2d');
      }

      offscreenCtx.drawImage(imageBitmap, 0, 0);
      imageBitmap.close();
      postMessage(getAverageColor(offscreenCtx.getImageData(0, 0, width, height)));
    } else if (method === 'ImageBitmap') {
      imageData = await imageBitmap.getImageData(0, 0, width, height, {
        imageData: options.reuseImageData ? imageData : null,
        neuter: options.neuter,
      });

      if (!options.neuter) {
        imageBitmap.close();
      }

      postMessage(getAverageColor(imageData));
    }
  }
}

function getAverageColor (imageData) {
  const { data, width, height } = imageData;

  let red = 0;
  let green = 0;
  let blue = 0;

  for (let y = 0; y < height; y += yStride) {
    for (let x = 0; x < width; x += xStride) {
      const startIdx = (y*width*4) + x*4;

      red += data[startIdx];
      green += data[startIdx + 1];
      blue += data[startIdx + 2];
    }
  }

  const pixelCount = (width/xStride) * (height/yStride);

  return [
    red/pixelCount,
    green/pixelCount,
    blue/pixelCount
  ];
}