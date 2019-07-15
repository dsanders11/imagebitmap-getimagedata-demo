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
| CanvasRenderingContext2D | HTMLVideoElement       |          N/A         |  6  |  55.49  |   326 MB   | Memory usage peaked at 362 MB |
| CanvasRenderingContext2D | ImageCapture.grabFrame |          N/A         | 5-6 |  53.89  |   301 MB   | Memory usage peaked at 357 MB |
| OffscreenCanvas          | HTMLVideoElement       |          N/A         |  8  |  69.06  |   283 MB   | Memory usage peaked at 309 MB |
| OffscreenCanvas          | ImageCapture.grabFrame |          N/A         | 6-7 |  60.11  |   283 MB   | Memory usage peaked at 307 MB |
| ImageBitmap.getImageData | HTMLVideoElement       |         None         | 8-9 |  68.69  |   284 MB   | Memory usage peaked at 312 MB |
| ImageBitmap.getImageData | HTMLVideoElement       |        buffer        | 10  |  70.79  |   250 MB   | Memory range: 245 MB - 254 MB |
| ImageBitmap.getImageData | HTMLVideoElement       |    buffer + neuter   | 10  |  71.31  |   250 MB   | Memory range: 248 MB - 255 MB |
| ImageBitmap.getImageData | ImageCapture.grabFrame |         None         | 19  |  72.95  |   275 MB   | Memory usage peaked at 301 MB |
| ImageBitmap.getImageData | ImageCapture.grabFrame |        buffer        | 23  |  67.16  |   244 MB   | Fluctuated 22-24 FPS          |
| ImageBitmap.getImageData | ImageCapture.grabFrame |    buffer + neuter   | 23  |  66.38  |   245 MB   | Fluctuated 22-24 FPS          |

#### 720p@30

**NOTE**: The `ImageCapture.grabFrame` implementation seems to limit frame requests to the camera frame rate,
so an FPS of 30 using that capture method is effectively 'maxxed out'.

| ImageData Method         | Capture Method         | GetImageData Options | FPS | Avg CPU | Avg Memory |             Notes             |
|--------------------------|:----------------------:|:--------------------:|:---:|:-------:|:----------:|:-----------------------------:|
| CanvasRenderingContext2D | HTMLVideoElement       |          N/A         | 12  |  65.97  |   308 MB   | Memory usage peaked at 349 MB |
| OffscreenCanvas          | HTMLVideoElement       |          N/A         | 17  |  64.78  |   266 MB   | Memory usage peaked at 293 MB |
| ImageBitmap.getImageData | HTMLVideoElement       |        buffer        | 20  |  65.69  |   231 MB   | Fluctuated 19-22 FPS          |
| ImageBitmap.getImageData | ImageCapture.grabFrame |        buffer        | 30  |  43.61  |   225 MB   |                               |

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