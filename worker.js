const xStride = 10;
const yStride = 10;

let imageData = null;
let offscreenCanvas = null;
let offscreenCtx = null;

onmessage = async (event) => {
  if (event.data.type === 'ImageData') {
    const { width, height, buffer } = event.data.imageData;
    const data = new Uint8ClampedArray(buffer);

    postMessage(getAverageColor(new Image(data, width, height)));
  } else if (event.data.type === 'ImageBitmap') {
    const imageBitmap = event.data.imageBitmap;
    const { method, options } = event.data.options;

    if (method === 'OffscreenCanvas') {
      const { width, height } = imageBitmap;

      if (offscreenCanvas === null) {
        offscreenCanvas = new OffscreenCanvas(width, height);
        offscreenCtx = offscreenCanvas.getContext('2d');
      }

      offscreenCtx.drawImage(imageBitmap, 0, 0);
      postMessage(getAverageColor(offscreenCtx.getImageData(0, 0, width, height)));
    } else if (method === 'ImageBitmap') {
      imageData = await imageBitmap.getImageData(0, 0, width, height, {
        imageData: options.reuseImageData ? imageData : null,
        neuter: options.neuter,
      });

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