/**
 * Client-side video compressor utilizing HTML5 Canvas and MediaRecorder API.
 */

export interface CompressionProgress {
  percent: number;
  status: string;
}

export async function compressVideo(
  file: File,
  onProgress?: (progress: CompressionProgress) => void
): Promise<File> {
  const MAX_LIMIT = 2 * 1024 * 1024; // 2MB target limit

  // If the file is already under 1.2MB, upload as-is to save time and battery
  if (file.size <= 1.2 * 1024 * 1024) {
    if (onProgress) onProgress({ percent: 100, status: "File size is optimal. Skipping compression." });
    return file;
  }

  const runCompression = async (): Promise<File> => {
    // Check if browser supports MediaRecorder and video captureStream
    const testVideo = document.createElement("video");
    const supportsStream = typeof (testVideo as any).captureStream === "function" || typeof (testVideo as any).mozCaptureStream === "function";
    if (!window.MediaRecorder || !supportsStream) {
      throw new Error("Browser does not support MediaRecorder or stream capture.");
    }

    return new Promise((resolve, reject) => {
      const videoUrl = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";

      // Position video offscreen
      video.style.position = "fixed";
      video.style.top = "-9999px";
      video.style.left = "-9999px";
      video.style.width = "480px"; // Compress resolution to 480p width
      video.style.height = "auto";
      document.body.appendChild(video);

      let mediaRecorder: MediaRecorder | null = null;
      const chunks: Blob[] = [];

      const cleanup = () => {
        try {
          if (video.parentNode) {
            document.body.removeChild(video);
          }
          URL.revokeObjectURL(videoUrl);
        } catch (err) {
          console.error("Cleanup error in video compressor:", err);
        }
      };

      video.onloadedmetadata = () => {
        const duration = video.duration;
        if (duration > 30) {
          cleanup();
          reject(new Error("Video duration cannot exceed 30 seconds for product previews."));
          return;
        }

        // Capture stream from video element at 24fps
        const stream = (video as any).captureStream ? (video as any).captureStream(24) : (video as any).mozCaptureStream(24);
        
        // Determine encoding options
        const options: MediaRecorderOptions = {
          videoBitsPerSecond: 800000, // 800 Kbps target
        };

        if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
          options.mimeType = "video/webm;codecs=vp9";
        } else if (MediaRecorder.isTypeSupported("video/webm")) {
          options.mimeType = "video/webm";
        } else if (MediaRecorder.isTypeSupported("video/mp4")) {
          options.mimeType = "video/mp4";
        }

        try {
          mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
          // Fallback to default options
          mediaRecorder = new MediaRecorder(stream);
        }

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          cleanup();
          const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || "video/webm" });
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + (mediaRecorder?.mimeType.includes("mp4") ? ".mp4" : ".webm"), {
            type: blob.type,
            lastModified: Date.now(),
          });

          if (compressedFile.size > MAX_LIMIT) {
            reject(
              new Error(
                `Even after compression, the video size (${(compressedFile.size / 1024 / 1024).toFixed(
                  2
                )}MB) exceeds the 2MB limit. Please upload a shorter or lower resolution video.`
              )
            );
          } else {
            resolve(compressedFile);
          }
        };

        // Set playbackRate to 3.0 to record at 3x speed
        video.playbackRate = 3.0;

        // Start recording
        mediaRecorder.start();
        video.play().catch((err) => {
          cleanup();
          reject(err);
        });

        // Track progress during playback
        const progressInterval = setInterval(() => {
          if (video.ended) {
            clearInterval(progressInterval);
            return;
          }
          const percent = Math.min(Math.round((video.currentTime / duration) * 100), 99);
          if (onProgress) {
            onProgress({ percent, status: `Optimizing video: ${percent}%` });
          }
        }, 100);

        video.onended = () => {
          clearInterval(progressInterval);
          if (onProgress) {
            onProgress({ percent: 100, status: "Optimization complete!" });
          }
          if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
          }
        };
      };

      video.onerror = () => {
        cleanup();
        reject(new Error("Failed to load video file. Please check if the file format is supported."));
      };
    });
  };

  try {
    return await runCompression();
  } catch (error: any) {
    console.warn("Client-side compression failed, falling back to original file upload:", error);
    const BACKEND_MAX_LIMIT = 50 * 1024 * 1024; // 50MB
    if (file.size <= BACKEND_MAX_LIMIT) {
      if (onProgress) onProgress({ percent: 100, status: "Uploading original file..." });
      return file;
    }
    throw new Error(
      error.message || `Failed to compress video, and the original file size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the 50MB limit.`
    );
  }
}
