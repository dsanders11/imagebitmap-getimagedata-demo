# imagebitmap-getimagedata-demo

Demos for performance of capturing and processing webcam frames using several methods.

# ImageBitmap Patches

There's a patch for both Chromium and Firefox. They can be found under the patches directory.

# Results

All testing is done on a Raspberry Pi Model 3B+, which has 1 GB of memory. Swap is disabled during testing to
avoid the uncertainty that might cause with the performance results.

## Chromium

TODO

| Capture Method         |     ImageData Method     | GetImageData Options | FPS | Avg CPU | Avg Memory | Notes |
|------------------------|:------------------------:|:--------------------:|:---:|:-------:|:----------:|:-----:|
| HTMLVideoElement       | CanvasRenderingContext2D |          N/A         |     |         |            |       |
| HTMLVideoElement       |      OffscreenCanvas     |          N/A         |     |         |            |       |
| HTMLVideoElement       | ImageBitmap.getImageData |          None        |     |         |            |       |
| HTMLVideoElement       | ImageBitmap.getImageData |       imageData      |     |         |            |       |
| HTMLVideoElement       | ImageBitmap.getImageData |  imageData + neuter  |     |         |            |       |
| ImageCapture.grabFrame | CanvasRenderingContext2D |          N/A         |     |         |            |       |
| ImageCapture.grabFrame |      OffscreenCanvas     |          N/A         |     |         |            |       |
| ImageCapture.grabFrame | ImageBitmap.getImageData |          None        |     |         |            |       |
| ImageCapture.grabFrame | ImageBitmap.getImageData |       imageData      |     |         |            |       |
| ImageCapture.grabFrame | ImageBitmap.getImageData |  imageData + neuter  |     |         |            |       |

## Firefox

TODO

Firefox implementation of `ImageCapture` is out of spec and only implements `takePhoto`, which returns
a `Blob`, so there's an extra step using `createImageBitmap`. It also only supports WebGL for `OffscreenCanvas`,
so we can't use that either.

**WARNING**: With Firefox the `CanvasRenderingContext2D` method tends to run off the rails quite quickly
and will use a lot of memory and likely lock up the process.

| Capture Method         |     ImageData Method     | GetImageData Options | FPS | Avg CPU | Avg Memory | Notes |
|------------------------|:------------------------:|:--------------------:|:---:|:-------:|:----------:|:-----:|
| HTMLVideoElement       | CanvasRenderingContext2D |          N/A         |     |         |            |       |
| HTMLVideoElement       | ImageBitmap.getImageData |          None        |     |         |            |       |
| HTMLVideoElement       | ImageBitmap.getImageData |       imageData      |     |         |            |       |
| HTMLVideoElement       | ImageBitmap.getImageData |  imageData + neuter  |     |         |            |       |
| ImageCapture.takePhoto | CanvasRenderingContext2D |          N/A         |     |         |            |       |
| ImageCapture.takePhoto | ImageBitmap.getImageData |          None        |     |         |            |       |
| ImageCapture.takePhoto | ImageBitmap.getImageData |       imageData      |     |         |            |       |
| ImageCapture.takePhoto | ImageBitmap.getImageData |  imageData + neuter  |     |         |            |       |