# imagebitmap-getimagedata-demo

Demos for performance of capturing and processing webcam frames using several methods.

This repo serves to prove out the usefulness of adding a `ImageBitmap.getImageData` method
to the spec, with the option of reusing an existing `ArrayBuffer` to avoid allocating large
amounts of large size garbage.

It's worth noting that Firefox fails all versions of the current implementation due to
running the test machine out of memory in under 5 seconds.

## ImageBitmap Patches

There's a patch for both Chromium and Firefox. They can be found under the patches directory.

## Testing

All testing is done on a Raspberry Pi Model 3B+, which has 1 GB of memory. Camera is a Logitech
C920 Pro. Swapfile is disabled during testing to avoid the uncertainty that might cause with the
performance results.

Average CPU and memory usage data were gathered at 5 second intervals over a 2 minute period using `sar`.
Baseline memory usage for the system is 140-170 MB.

All test runs involved a fresh start of the browser.

## Results

As of the time of this testing (July 2019), Firefox is unable to run this test scenario on the Pi
without crashing the system due to OOM. On Chromium the new `ImageBitmap.getImageData` code path
offers superior performance to `OffscreenCanvas`, with the worker FPS clocking in at 60 FPS vs 5 FPS.
The improvement is significant enough that the bottleneck is moved to elsewhere in the Chromium code,
with the `getImageData` code path performing well enough to handle 1080p@30.

### Chromium

The `neuter` option appears to have little effect on either CPU or memory usage.

#### 1080p@30

The results for `ImageBitmap.getImageData` usage with `ImageCapture.grabFrame` seem to be
bottlenecked by `ImageCapture.grabFrame` converting the frame using `libyuv`. `chrome://tracing`
shows this takes ~25-35 MS per frame, which eats through most of the time needed to process a
frame at 30 FPS. If the bottleneck was alleviated, it looks like the FPS could likely hit the
30 FPS mark, given that the worker processes frames fast enough for 45+ FPS.

| ImageData Method         | Capture Method         | GetImageData Options | FPS | Avg CPU | Avg Memory |             Notes             |
|--------------------------|:----------------------:|:--------------------:|:---:|:-------:|:----------:|:-----------------------------:|
| CanvasRenderingContext2D | HTMLVideoElement       |          N/A         |  6  |  48.21  |   290 MB   | Memory usage peaked at 340 MB |
| CanvasRenderingContext2D | ImageCapture.grabFrame |          N/A         | 5-6 |  51.92  |   285 MB   | Memory usage peaked at 343 MB |
| OffscreenCanvas          | HTMLVideoElement       |          N/A         |  6  |  55.23  |   307 MB   | Memory usage peaked at 347 MB |
| OffscreenCanvas          | ImageCapture.grabFrame |          N/A         | 5-6 |  52.46  |   318 MB   | Memory usage peaked at 355 MB |
| ImageBitmap.getImageData | HTMLVideoElement       |          None        | 6-7 |  54.55  |   315 MB   | Memory usage peaked at 355 MB |
| ImageBitmap.getImageData | HTMLVideoElement       |       imageData      | 6-7 |  54.89  |   266 MB   | Memory range: 264 MB - 267 MB |
| ImageBitmap.getImageData | HTMLVideoElement       |  imageData + neuter  | 6-7 |  54.91  |   268 MB   | Memory range: 267 MB - 270 MB |
| ImageBitmap.getImageData | ImageCapture.grabFrame |          None        | 12  |  50.52  |   312 MB   | Memory usage peaked at 347 MB |
| ImageBitmap.getImageData | ImageCapture.grabFrame |       imageData      | 15  |  52.89  |   264 MB   | Fluctuated 13-22 FPS          |
| ImageBitmap.getImageData | ImageCapture.grabFrame |  imageData + neuter  | 15  |  50.25  |   263 MB   | Fluctuated 13-22 FPS          |

#### 720p@30

**NOTE**: The `ImageCapture.grabFrame` implementation seems to limit frame requests to the camera frame rate,
so an FPS of 30 using that capture method is effectively 'maxxed out'.

| ImageData Method         | Capture Method         | GetImageData Options | FPS | Avg CPU | Avg Memory |             Notes             |
|--------------------------|:----------------------:|:--------------------:|:---:|:-------:|:----------:|:-----------------------------:|
| CanvasRenderingContext2D | HTMLVideoElement       |          N/A         | 12  |  45.18  |   316 MB   | Memory usage peaked at 377 MB |
| OffscreenCanvas          | HTMLVideoElement       |          N/A         | 12  |  47.26  |   271 MB   | Memory usage peaked at XXX MB |
| ImageBitmap.getImageData | HTMLVideoElement       |       imageData      | 14  |  46.82  |   250 MB   | Fluctuated 13-16 FPS          | 
| ImageBitmap.getImageData | ImageCapture.grabFrame |       imageData      | 29  |  43.07  |   248 MB   | Fluctuated 28-30 FPS          |

### Firefox

Firefox implementation of `ImageCapture` is out of spec and only implements `takePhoto`, which returns
a `Blob`, so there's an extra step using `createImageBitmap`. It also only supports WebGL for `OffscreenCanvas`,
so we can't use that either.

Interestingly average memory usage is lower when the `neuter` option is not used.

**WARNING**: With Firefox the `CanvasRenderingContext2D` method tends to run off the rails quite quickly
and will use a lot of memory and likely lock up the process. It will crash a Raspberry Pi, or a low-memory
Android phone.

#### 1080p@30

| ImageData Method         | Capture Method         | GetImageData Options | FPS | Avg CPU | Avg Memory |           Notes          |
|--------------------------|:----------------------:|:--------------------:|:---:|:-------:|:----------:|:------------------------:|
| CanvasRenderingContext2D | HTMLVideoElement       |          N/A         |  X  |    X    |      X     | Runs OOM in under 5 secs |
| CanvasRenderingContext2D | ImageCapture.takePhoto |          N/A         |  X  |    X    |      X     | Runs OOM in under 5 secs |
| ImageBitmap.getImageData | HTMLVideoElement       |          None        |  X  |    X    |      X     | Runs OOM in under 5 secs |
| ImageBitmap.getImageData | HTMLVideoElement       |         buffer       | 20  |  73.24  |   326 MB   | Fluctuated 17-26 FPS     |
| ImageBitmap.getImageData | HTMLVideoElement       |    buffer + neuter   | 20  |  74.27  |   369 MB   | Fluctuated 17-26 FPS     |
| ImageBitmap.getImageData | ImageCapture.takePhoto |          None        |  X  |    X    |      X     | Runs OOM in under 5 secs |
| ImageBitmap.getImageData | ImageCapture.takePhoto |         buffer       | 3-4 |  63.77  |   377 MB   |                          |
| ImageBitmap.getImageData | ImageCapture.takePhoto |    buffer + neuter   | 3-4 |  63.52  |   396 MB   |                          |

#### 720p@30

| ImageData Method         | Capture Method         | GetImageData Options | FPS | Avg CPU | Avg Memory |           Notes          |
|--------------------------|:----------------------:|:--------------------:|:---:|:-------:|:----------:|:------------------------:|
| CanvasRenderingContext2D | HTMLVideoElement       |          N/A         |  X  |    X    |      X     | Runs OOM in under 5 secs |
| ImageBitmap.getImageData | HTMLVideoElement       |         buffer       | 40+ |  70.09  |   334 MB   | Fluctuated 30-45 FPS     |