import { PostureMetrics, PostureState, BaselineProfile } from '../types';

export interface PoseKeypoints {
  nose: { x: number; y: number; confidence: number };
  leftEye: { x: number; y: number; confidence: number };
  rightEye: { x: number; y: number; confidence: number };
  leftEar: { x: number; y: number; confidence: number };
  rightEar: { x: number; y: number; confidence: number };
  leftShoulder: { x: number; y: number; confidence: number };
  rightShoulder: { x: number; y: number; confidence: number };
  neck: { x: number; y: number; confidence: number };
  midShoulder: { x: number; y: number; confidence: number };
  torsoCenter: { x: number; y: number; confidence: number };
}

export interface ValidationStatus {
  isPersonDetected: boolean;
  isCentered: boolean;
  areShouldersVisible: boolean;
  isHeadVisible: boolean;
  isLightingAdequate: boolean;
  isSinglePerson: boolean;
  stabilityScore: number; // 0 to 100
  feedbackMessage: string;
  shoulderTilt?: number;
  shoulderWidth?: number;
  leftShoulderDetected?: boolean;
  rightShoulderDetected?: boolean;
  shouldersLevel?: boolean;
  detectedFaceBounds?: { x: number; y: number; width: number; height: number };
}

export class PoseDetector {
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private lastMetrics: PostureMetrics | null = null;
  private lastKeypoints: PoseKeypoints | null = null;
  private lastValidation: ValidationStatus | null = null;
  private onMetricsCallback: ((metrics: PostureMetrics, keypoints: PoseKeypoints, validation: ValidationStatus) => void) | null = null;

  // Smoothing buffers
  private scoreBuffer: number[] = [];
  private headAngleBuffer: number[] = [];
  private shoulderAngleBuffer: number[] = [];
  private neckAngleBuffer: number[] = [];
  private distanceBuffer: number[] = [];
  private readonly bufferSize = 6;

  // Simulation mode support
  private isSimulated = false;
  private simTime = 0;
  private simDeviationType: 'none' | 'forward_head' | 'shoulder_slump' | 'slouch' = 'none';

  // Manual Tracking Anchor (user can click on video to pin their position)
  private manualAnchor: { x: number; y: number } | null = null;

  // Ergonomic fine-tuning offsets (in normalized coordinate space)
  private shoulderYOffset = 0;
  private neckYOffset = 0;
  private shoulderSpanFactor = 1.0;
  private headTiltCalibrationOffset = 0;

  // Temporal EMA for smoothly tracked face & shoulder landmarks
  private smoothedFace: { x: number; y: number; width: number; height: number; rollAngle: number } | null = null;
  private smoothedLeftShoulder: { x: number; y: number } | null = null;
  private smoothedRightShoulder: { x: number; y: number } | null = null;

  // Browser Native FaceDetector API (when available in Chromium)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private nativeFaceDetector: any = null;
  private isNativeFaceDetectorAvailable = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 320;
    this.canvas.height = 240;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.nativeFaceDetector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        this.isNativeFaceDetectorAvailable = true;
      } catch {
        this.isNativeFaceDetectorAvailable = false;
      }
    }
  }

  public setManualAnchor(x: number, y: number) {
    this.manualAnchor = {
      x: Math.max(0.15, Math.min(0.85, x)),
      y: Math.max(0.20, Math.min(0.80, y))
    };
    // Seed smoothed face around user clicked anchor
    this.smoothedFace = {
      x: this.manualAnchor.x,
      y: this.manualAnchor.y,
      width: 0.24,
      height: 0.36,
      rollAngle: 0
    };
  }

  public clearManualAnchor() {
    this.manualAnchor = null;
  }

  public getManualAnchor(): { x: number; y: number } | null {
    return this.manualAnchor;
  }

  public setShoulderOffset(offset: number) {
    this.shoulderYOffset = Math.max(-0.25, Math.min(0.25, offset));
  }

  public getShoulderOffset(): number {
    return this.shoulderYOffset;
  }

  public setNeckOffset(offset: number) {
    this.neckYOffset = Math.max(-0.20, Math.min(0.20, offset));
  }

  public getNeckOffset(): number {
    return this.neckYOffset;
  }

  public setShoulderSpanFactor(factor: number) {
    this.shoulderSpanFactor = Math.max(0.7, Math.min(1.4, factor));
  }

  public getShoulderSpanFactor(): number {
    return this.shoulderSpanFactor;
  }

  public setHeadTiltCalibrationOffset(offset: number) {
    this.headTiltCalibrationOffset = offset;
  }

  public setSimulated(sim: boolean, deviationType: 'none' | 'forward_head' | 'shoulder_slump' | 'slouch' = 'none') {
    this.isSimulated = sim;
    this.simDeviationType = deviationType;
  }

  public getIsSimulated(): boolean {
    return this.isSimulated;
  }

  public async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'videoinput');
    } catch {
      return [];
    }
  }

  public async startCamera(videoElement?: HTMLVideoElement | null, deviceId?: string): Promise<{ success: boolean; error?: string; errorType?: string }> {
    try {
      if (this.stream) {
        this.stopCamera();
      }

      if (videoElement) {
        this.videoElement = videoElement;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser or environment.');
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.isSimulated = false;

      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        try {
          await this.videoElement.play();
        } catch {
          // Play request might be deferred by browser
        }
      }

      return { success: true };
    } catch (err: unknown) {
      const error = err as Error;
      let errorType = 'UNKNOWN';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorType = 'PERMISSION_DENIED';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorType = 'DEVICE_NOT_FOUND';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorType = 'DEVICE_BUSY';
      }

      return {
        success: false,
        error: error.message || 'Camera access failed',
        errorType
      };
    }
  }

  public attachVideo(video: HTMLVideoElement) {
    this.videoElement = video;
    if (this.stream) {
      this.videoElement.srcObject = this.stream;
      this.videoElement.play().catch(() => {});
    }
  }

  public stopCamera() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  public startDetection(
    baseline: BaselineProfile | null,
    onMetrics: (metrics: PostureMetrics, keypoints: PoseKeypoints, validation: ValidationStatus) => void
  ) {
    this.onMetricsCallback = onMetrics;
    let isProcessing = false;
    const processLoop = async () => {
      if (!isProcessing) {
        isProcessing = true;
        try {
          await this.processFrame(baseline);
        } catch {
          // frame catch
        } finally {
          isProcessing = false;
        }
      }
      this.animationFrameId = requestAnimationFrame(processLoop);
    };
    processLoop();
  }

  public stopDetection() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.onMetricsCallback = null;
  }

  public stop() {
    this.stopDetection();
    this.stopCamera();
  }

  public getStream(): MediaStream | null {
    return this.stream;
  }

  public getLastMetrics(): PostureMetrics | null {
    return this.lastMetrics;
  }

  public getLastKeypoints(): PoseKeypoints | null {
    return this.lastKeypoints;
  }

  public getLastValidation(): ValidationStatus | null {
    return this.lastValidation;
  }

  public captureCurrentAngles(): {
    headAngle: number;
    neckAngle: number;
    shoulderAngle: number;
    torsoAngle: number;
    cameraDistance: number;
    shoulderWidth: number;
    earShoulderDist: number;
  } {
    if (this.lastMetrics && this.lastKeypoints) {
      const shWidth = Math.hypot(
        this.lastKeypoints.rightShoulder.x - this.lastKeypoints.leftShoulder.x,
        this.lastKeypoints.rightShoulder.y - this.lastKeypoints.leftShoulder.y
      );
      const earDist = (
        Math.hypot(this.lastKeypoints.leftEar.x - this.lastKeypoints.leftShoulder.x, this.lastKeypoints.leftEar.y - this.lastKeypoints.leftShoulder.y) +
        Math.hypot(this.lastKeypoints.rightEar.x - this.lastKeypoints.rightShoulder.x, this.lastKeypoints.rightEar.y - this.lastKeypoints.rightShoulder.y)
      ) / 2;

      return {
        headAngle: this.lastMetrics.headAngle,
        neckAngle: this.lastMetrics.neckAngle,
        shoulderAngle: this.lastMetrics.shoulderAngle,
        torsoAngle: this.lastMetrics.torsoAngle,
        cameraDistance: this.lastMetrics.cameraDistance,
        shoulderWidth: Math.round(shWidth * 100) / 100,
        earShoulderDist: Math.round(earDist * 100) / 100
      };
    }
    return {
      headAngle: 0.0,
      neckAngle: 3.5,
      shoulderAngle: 0.0,
      torsoAngle: 0.0,
      cameraDistance: 1.0,
      shoulderWidth: 0.52,
      earShoulderDist: 0.24
    };
  }

  private async processFrame(baseline: BaselineProfile | null) {
    const timestamp = Date.now();

    if (this.isSimulated) {
      this.simTime += 0.05;
      const simData = this.generateSimulatedData(timestamp, baseline);
      this.lastMetrics = simData.metrics;
      this.lastKeypoints = simData.keypoints;
      this.lastValidation = simData.validation;
      if (this.onMetricsCallback) {
        this.onMetricsCallback(simData.metrics, simData.keypoints, simData.validation);
      }
      return;
    }

    if (!this.videoElement || this.videoElement.readyState < 2) {
      return;
    }

    if (!this.ctx) return;

    // Draw video frame to canvas for computer vision processing
    this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    // 1. Try Hardware Native FaceDetector first if supported in browser
    let nativeFace: { x: number; y: number; width: number; height: number; rollAngle?: number } | null = null;
    if (this.isNativeFaceDetectorAvailable && this.nativeFaceDetector) {
      try {
        const detected = await this.nativeFaceDetector.detect(this.videoElement);
        if (detected && detected.length > 0) {
          const f = detected[0];
          const bb = f.boundingBox;
          const vw = this.videoElement.videoWidth || 640;
          const vh = this.videoElement.videoHeight || 480;
          nativeFace = {
            x: (bb.x + bb.width / 2) / vw,
            y: (bb.y + bb.height / 2) / vh,
            width: Math.max(0.16, bb.width / vw),
            height: Math.max(0.24, bb.height / vh)
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const landmarks = (f as any).landmarks as Array<{ type: string; locations: Array<{ x: number; y: number }> }> | undefined;
          if (landmarks) {
            const eyes = landmarks.filter(l => l.type === 'eye');
            if (eyes.length >= 2 && eyes[0].locations[0] && eyes[1].locations[0]) {
              const p1 = eyes[0].locations[0];
              const p2 = eyes[1].locations[0];
              const leftP = p1.x < p2.x ? p1 : p2;
              const rightP = p1.x < p2.x ? p2 : p1;
              const dx = rightP.x - leftP.x;
              const dy = rightP.y - leftP.y;
              nativeFace.rollAngle = Math.atan2(dy, Math.max(1, dx)) * (180 / Math.PI);
            }
          }
        }
      } catch {
        // Fallback to computer vision pipeline
      }
    }

    // 2. High-Precision Spatial Computer Vision Analysis (Accurate anthropometric shoulders & neck)
    const visionAnalysis = this.analyzeFrameVision(imageData, nativeFace);
    const keypoints = this.extractPoseKeypoints(visionAnalysis);
    const validation = this.validatePose(visionAnalysis, keypoints);
    const metrics = this.computeMetricsFromKeypoints(keypoints, baseline, timestamp);

    this.lastMetrics = metrics;
    this.lastKeypoints = keypoints;
    this.lastValidation = validation;

    if (this.onMetricsCallback) {
      this.onMetricsCallback(metrics, keypoints, validation);
    }
  }

  /**
   * Spatial Grid Clustering & Accurate Anthropometric Body Segmentation
   * - Eliminates plain curtains & blank walls using local texture variance
   * - Detects true head position ($y \approx 0.45\text{--}0.55$) and jawline/chin ($y \approx 0.70$)
   * - Places cervical neck at $y \approx 0.78$ and clavicle shoulder bar down at $y \approx 0.85$
   * - Eliminates hair-parting false head roll tilt with eye-socket socket minima search
   */
  private analyzeFrameVision(
    imageData: ImageData,
    nativeFace: { x: number; y: number; width: number; height: number; rollAngle?: number } | null
  ) {
    const { data, width, height } = imageData;
    let totalBrightness = 0;

    // Spatial Grid Division: 32 columns x 24 rows
    const cols = 32;
    const rows = 24;
    const cellW = width / cols;
    const cellH = height / rows;

    interface GridCell {
      skinCount: number;
      darkHairCount: number;
      variance: number;
      avgLum: number;
    }

    const grid: GridCell[][] = [];

    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        let skin = 0;
        let dark = 0;
        let lumSum = 0;
        let lumSqSum = 0;
        let sampleCount = 0;

        const startX = Math.floor(c * cellW);
        const endX = Math.floor((c + 1) * cellW);
        const startY = Math.floor(r * cellH);
        const endY = Math.floor((r + 1) * cellH);

        for (let y = startY; y < endY; y += 2) {
          for (let x = startX; x < endX; x += 2) {
            const idx = (y * width + x) * 4;
            const red = data[idx];
            const green = data[idx + 1];
            const blue = data[idx + 2];
            const sum = red + green + blue;
            const lum = 0.299 * red + 0.587 * green + 0.114 * blue;
            totalBrightness += lum;
            lumSum += lum;
            lumSqSum += lum * lum;
            sampleCount++;

            // Dark hair / eyebrow / beard pixel
            if (lum < 65 || (red < 75 && green < 70 && blue < 70)) {
              dark++;
            }

            // Skin Chromaticity filter
            if (sum > 60) {
              const nr = red / sum;
              const ng = green / sum;
              if (
                nr >= 0.35 && nr <= 0.60 &&
                ng >= 0.26 && ng <= 0.39 &&
                red > green && red > blue &&
                (red - green) >= 10
              ) {
                skin++;
              }
            }
          }
        }

        const avgLum = sampleCount > 0 ? lumSum / sampleCount : 0;
        const variance = sampleCount > 0 ? (lumSqSum / sampleCount) - (avgLum * avgLum) : 0;
        grid[r][c] = {
          skinCount: skin,
          darkHairCount: dark,
          variance,
          avgLum
        };
      }
    }

    const avgBrightness = totalBrightness / ((width * height) / 4);

    let rawFaceX = 0.52;
    let rawFaceY = 0.50;
    let rawFaceW = 0.24;
    let rawFaceH = 0.36;
    let hasHead = false;
    let headRollAngle = 0;

    if (nativeFace) {
      rawFaceX = nativeFace.x;
      rawFaceY = nativeFace.y;
      rawFaceW = nativeFace.width;
      rawFaceH = nativeFace.height * 1.25; // Include full chin/jawline
      hasHead = true;
      headRollAngle = nativeFace.rollAngle ?? 0;
    } else {
      // Robust Candidate Window Evaluation with Strong Center Prior
      const winW = 8; // ~25% width
      const winH = 9; // ~37% height
      let bestScore = -99999;
      let bestR = 6;
      let bestC = 12;

      const targetAnchorX = this.manualAnchor?.x ?? (this.smoothedFace?.x ?? 0.50);
      const targetAnchorY = this.manualAnchor?.y ?? (this.smoothedFace?.y ?? 0.42);

      for (let r = 2; r <= rows - winH; r++) {
        for (let c = 2; c <= cols - winW; c++) {
          let skinSum = 0;
          let varSum = 0;
          let hairAbove = 0;

          // Inner face region
          for (let dy = 0; dy < winH; dy++) {
            for (let dx = 0; dx < winW; dx++) {
              const cell = grid[r + dy][c + dx];
              if (cell.variance >= 10 || cell.darkHairCount > 2) {
                skinSum += cell.skinCount;
                varSum += cell.variance;
              }
            }
          }

          // Top hair check: Directly above the forehead
          for (let dy = -2; dy <= 0; dy++) {
            if (r + dy >= 0) {
              for (let dx = 1; dx < winW - 1; dx++) {
                hairAbove += grid[r + dy][c + dx].darkHairCount;
              }
            }
          }

          const centerXNorm = ((c + winW / 2) * cellW) / width;
          const centerYNorm = ((r + winH / 2) * cellH) / height;

          // Strong center prior: Laptop/desktop users sit centered in front of the camera
          const distFromCenter = Math.abs(centerXNorm - 0.50);
          const edgePenalty = distFromCenter > 0.20 ? (distFromCenter - 0.20) * 1200 : 0;
          const distToAnchor = Math.hypot(centerXNorm - targetAnchorX, centerYNorm - targetAnchorY);
          const anchorBonus = Math.max(0, 1.0 - distToAnchor * 1.5) * 600;
          const centerBonus = Math.max(0, 1.0 - distFromCenter * 2.0) * 300;

          // Skin chromaticity is the primary signature of a human face (not background texture)
          const candidateScore = skinSum * 3.5 + varSum * 0.15 + hairAbove * 4.0 + anchorBonus + centerBonus - edgePenalty;

          if (candidateScore > bestScore) {
            bestScore = candidateScore;
            bestR = r;
            bestC = c;
          }
        }
      }

      if (bestScore > 100) {
        hasHead = true;
        rawFaceX = ((bestC + winW / 2) * cellW) / width;
        rawFaceY = ((bestR + winH / 2) * cellH) / height;
        rawFaceW = (winW * cellW) / width;
        rawFaceH = (winH * cellH) / height;

        // Continuous Sub-Pixel Eye Socket Intensity Barycenter (Zero Grid Discretization Error)
        const eyeZoneYStart = Math.max(0, Math.floor((rawFaceY - rawFaceH * 0.22) * height));
        const eyeZoneYEnd = Math.min(height - 1, Math.floor((rawFaceY + rawFaceH * 0.05) * height));

        // Left eye box in pixels
        const leftEyeXStart = Math.max(0, Math.floor((rawFaceX - rawFaceW * 0.40) * width));
        const leftEyeXEnd = Math.min(width - 1, Math.floor((rawFaceX - rawFaceW * 0.08) * width));
        let leftWeightSum = 0;
        let leftYWeighted = 0;

        for (let y = eyeZoneYStart; y <= eyeZoneYEnd; y += 2) {
          for (let x = leftEyeXStart; x <= leftEyeXEnd; x += 2) {
            const idx = (y * width + x) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            // Darker pixels (pupils, iris, eye-sockets) have higher weight
            const darkness = Math.max(0, 140 - lum);
            const w = darkness * darkness;
            leftWeightSum += w;
            leftYWeighted += y * w;
          }
        }

        // Right eye box in pixels
        const rightEyeXStart = Math.max(0, Math.floor((rawFaceX + rawFaceW * 0.08) * width));
        const rightEyeXEnd = Math.min(width - 1, Math.floor((rawFaceX + rawFaceW * 0.40) * width));
        let rightWeightSum = 0;
        let rightYWeighted = 0;

        for (let y = eyeZoneYStart; y <= eyeZoneYEnd; y += 2) {
          for (let x = rightEyeXStart; x <= rightEyeXEnd; x += 2) {
            const idx = (y * width + x) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            const darkness = Math.max(0, 140 - lum);
            const w = darkness * darkness;
            rightWeightSum += w;
            rightYWeighted += y * w;
          }
        }

        if (leftWeightSum > 1000 && rightWeightSum > 1000) {
          const leftCentroidY = leftYWeighted / leftWeightSum;
          const rightCentroidY = rightYWeighted / rightWeightSum;
          const deltaY = rightCentroidY - leftCentroidY;
          const eyeDistX = (rightEyeXStart + rightEyeXEnd) / 2 - (leftEyeXStart + leftEyeXEnd) / 2;
          let computedRoll = Math.atan2(deltaY, Math.max(10, eyeDistX)) * (180 / Math.PI);

          // Apply 3.5° deadband so natural slight micro-expressions don't jump
          if (Math.abs(computedRoll) <= 3.5) {
            computedRoll = 0.0;
          }
          headRollAngle = Math.max(-15, Math.min(15, computedRoll));
        } else {
          headRollAngle = 0.0;
        }
      }
    }

    // Apply head tilt calibration offset if user manually zeroed it
    headRollAngle = Math.round((headRollAngle - this.headTiltCalibrationOffset) * 10) / 10;

    // Temporal Exponential Moving Average for smooth face tracking
    const alpha = 0.30;
    if (!this.smoothedFace || !hasHead) {
      this.smoothedFace = {
        x: rawFaceX,
        y: rawFaceY,
        width: rawFaceW,
        height: rawFaceH,
        rollAngle: headRollAngle
      };
    } else {
      this.smoothedFace = {
        x: this.smoothedFace.x * (1 - alpha) + rawFaceX * alpha,
        y: this.smoothedFace.y * (1 - alpha) + rawFaceY * alpha,
        width: this.smoothedFace.width * (1 - alpha) + rawFaceW * alpha,
        height: this.smoothedFace.height * (1 - alpha) + rawFaceH * alpha,
        rollAngle: this.smoothedFace.rollAngle * (1 - alpha) + headRollAngle * alpha
      };
    }

    const faceX = this.smoothedFace.x;
    const faceY = this.smoothedFace.y;
    const faceW = this.smoothedFace.width;
    const faceH = this.smoothedFace.height;

    // 3. True Anthropometric Shoulder & Clavicle Bar Computation
    // In human anatomy:
    // - Chin is at bottom of face: faceY + faceH * 0.48
    // - Cervical neck base (C7 / suprasternal notch): chinY + faceH * 0.28
    // - Clavicle / Acromion shoulder joint plane: chinY + faceH * 0.54 (typically y ≈ 0.72 - 0.82)
    const chinY = faceY + faceH * 0.48;
    const nominalShoulderY = Math.min(0.92, Math.max(0.68, chinY + faceH * 0.54 + this.shoulderYOffset));

    const halfSpan = (faceW * 1.25 * this.shoulderSpanFactor);
    const nominalLeftShX = Math.max(0.08, faceX - halfSpan);
    const nominalRightShX = Math.min(0.92, faceX + halfSpan);

    // Search for actual shoulder slope strictly BELOW the cervical neck
    const scanTop = Math.floor((chinY + faceH * 0.32) * height);
    const scanBottom = Math.min(height - 2, Math.floor(0.94 * height));

    // Left shoulder zone column scan
    const leftColStart = Math.max(2, Math.floor((nominalLeftShX - 0.04) * width));
    const leftColEnd = Math.min(width - 2, Math.floor((nominalLeftShX + 0.04) * width));
    let leftEdgeSum = 0;
    let leftEdgeCount = 0;

    for (let x = leftColStart; x <= leftColEnd; x += 4) {
      let maxGrad = 0;
      let bestY = 0;
      for (let y = scanTop; y <= scanBottom; y += 2) {
        const idxAbove = ((y - 3) * width + x) * 4;
        const idxBelow = ((y + 3) * width + x) * 4;
        const lumAbove = 0.299 * data[idxAbove] + 0.587 * data[idxAbove + 1] + 0.114 * data[idxAbove + 2];
        const lumBelow = 0.299 * data[idxBelow] + 0.587 * data[idxBelow + 1] + 0.114 * data[idxBelow + 2];
        const grad = Math.abs(lumBelow - lumAbove);
        // Valid shoulder edge must be close to anthropometric expectation
        const distFromNominal = Math.abs((y / height) - nominalShoulderY);
        if (grad > maxGrad && grad >= 18 && distFromNominal < 0.10) {
          maxGrad = grad;
          bestY = y;
        }
      }
      if (bestY > 0) {
        leftEdgeSum += bestY;
        leftEdgeCount++;
      }
    }

    // Right shoulder zone column scan
    const rightColStart = Math.max(2, Math.floor((nominalRightShX - 0.04) * width));
    const rightColEnd = Math.min(width - 2, Math.floor((nominalRightShX + 0.04) * width));
    let rightEdgeSum = 0;
    let rightEdgeCount = 0;

    for (let x = rightColStart; x <= rightColEnd; x += 4) {
      let maxGrad = 0;
      let bestY = 0;
      for (let y = scanTop; y <= scanBottom; y += 2) {
        const idxAbove = ((y - 3) * width + x) * 4;
        const idxBelow = ((y + 3) * width + x) * 4;
        const lumAbove = 0.299 * data[idxAbove] + 0.587 * data[idxAbove + 1] + 0.114 * data[idxAbove + 2];
        const lumBelow = 0.299 * data[idxBelow] + 0.587 * data[idxBelow + 1] + 0.114 * data[idxBelow + 2];
        const grad = Math.abs(lumBelow - lumAbove);
        const distFromNominal = Math.abs((y / height) - nominalShoulderY);
        if (grad > maxGrad && grad >= 18 && distFromNominal < 0.10) {
          maxGrad = grad;
          bestY = y;
        }
      }
      if (bestY > 0) {
        rightEdgeSum += bestY;
        rightEdgeCount++;
      }
    }

    const rawLeftShY = leftEdgeCount >= 2 ? (leftEdgeSum / leftEdgeCount) / height : nominalShoulderY;
    const rawRightShY = rightEdgeCount >= 2 ? (rightEdgeSum / rightEdgeCount) / height : nominalShoulderY;

    // Smooth shoulders with EMA
    const shAlpha = 0.25;
    if (!this.smoothedLeftShoulder) {
      this.smoothedLeftShoulder = { x: nominalLeftShX, y: rawLeftShY };
      this.smoothedRightShoulder = { x: nominalRightShX, y: rawRightShY };
    } else {
      this.smoothedLeftShoulder = {
        x: this.smoothedLeftShoulder.x * (1 - shAlpha) + nominalLeftShX * shAlpha,
        y: this.smoothedLeftShoulder.y * (1 - shAlpha) + rawLeftShY * shAlpha
      };
      this.smoothedRightShoulder = {
        x: this.smoothedRightShoulder.x * (1 - shAlpha) + nominalRightShX * shAlpha,
        y: this.smoothedRightShoulder.y * (1 - shAlpha) + rawRightShY * shAlpha
      };
    }

    // Bi-Acromial Shoulder Level Angle with 2.0° deadband
    const shDx = this.smoothedRightShoulder.x - this.smoothedLeftShoulder.x;
    const shDy = this.smoothedRightShoulder.y - this.smoothedLeftShoulder.y;
    let shoulderTiltAngle = Math.atan2(shDy, Math.max(0.01, shDx)) * (180 / Math.PI);
    if (Math.abs(shoulderTiltAngle) < 2.0) {
      shoulderTiltAngle = 0.0;
    }

    return {
      avgBrightness,
      centerX: faceX,
      centerY: faceY,
      hasHead,
      headWidth: faceW,
      headHeight: faceH,
      headRollAngle: this.smoothedFace.rollAngle,
      headBounds: {
        x: faceX,
        y: faceY,
        width: faceW,
        height: faceH
      },
      shoulders: {
        hasLeftShoulder: true,
        hasRightShoulder: true,
        leftX: this.smoothedLeftShoulder.x,
        leftY: this.smoothedLeftShoulder.y,
        rightX: this.smoothedRightShoulder.x,
        rightY: this.smoothedRightShoulder.y,
        shoulderTiltAngle: Math.round(shoulderTiltAngle * 10) / 10,
        leftConfidence: 0.95,
        rightConfidence: 0.95
      }
    };
  }

  private extractPoseKeypoints(analysis: ReturnType<typeof this.analyzeFrameVision>): PoseKeypoints {
    const headX = analysis.centerX;
    const headY = analysis.centerY;
    const headW = analysis.headWidth;
    const headH = analysis.headHeight;

    const rad = (analysis.headRollAngle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const eyeSpanX = headW * 0.22;
    const eyeOffsetY = -headH * 0.12;

    const leftEye = {
      x: headX - (eyeSpanX * cos - eyeOffsetY * sin),
      y: headY - (eyeSpanX * sin + eyeOffsetY * cos),
      confidence: 0.95
    };

    const rightEye = {
      x: headX + (eyeSpanX * cos + eyeOffsetY * sin),
      y: headY + (eyeSpanX * sin - eyeOffsetY * cos),
      confidence: 0.95
    };

    const earSpanX = headW * 0.44;
    const leftEar = {
      x: headX - (earSpanX * cos),
      y: headY - (earSpanX * sin),
      confidence: 0.90
    };
    const rightEar = {
      x: headX + (earSpanX * cos),
      y: headY + (earSpanX * sin),
      confidence: 0.90
    };

    // Nose located at optical center of the face
    const nose = { x: headX, y: headY + headH * 0.08, confidence: analysis.hasHead ? 0.98 : 0.70 };

    const leftShoulder = {
      x: analysis.shoulders.leftX,
      y: analysis.shoulders.leftY,
      confidence: analysis.shoulders.leftConfidence
    };
    const rightShoulder = {
      x: analysis.shoulders.rightX,
      y: analysis.shoulders.rightY,
      confidence: analysis.shoulders.rightConfidence
    };

    const midShoulder = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
      confidence: 0.95
    };

    // Cervical neck node along spinal column between nose and mid-shoulder
    const chinY = headY + headH * 0.48;
    const neck = {
      x: (nose.x * 0.30 + midShoulder.x * 0.70),
      y: Math.min(midShoulder.y - 0.05, chinY + (midShoulder.y - chinY) * 0.40 + this.neckYOffset),
      confidence: 0.95
    };

    const torsoCenter = {
      x: midShoulder.x,
      y: Math.min(0.98, midShoulder.y + 0.18),
      confidence: 0.88
    };

    return {
      nose,
      leftEye,
      rightEye,
      leftEar,
      rightEar,
      leftShoulder,
      rightShoulder,
      neck,
      midShoulder,
      torsoCenter
    };
  }

  private validatePose(analysis: ReturnType<typeof this.analyzeFrameVision>, keypoints: PoseKeypoints): ValidationStatus {
    const isLightingAdequate = analysis.avgBrightness > 35 && analysis.avgBrightness < 245;
    const isHeadVisible = analysis.hasHead;
    const isCentered = Math.abs(keypoints.nose.x - 0.5) < 0.28;

    const areShouldersVisible = keypoints.leftShoulder.x >= 0.04 && keypoints.rightShoulder.x <= 0.96;
    const shoulderDx = keypoints.rightShoulder.x - keypoints.leftShoulder.x;
    const shoulderDy = keypoints.rightShoulder.y - keypoints.leftShoulder.y;
    const shoulderTilt = Math.atan2(shoulderDy, Math.max(0.01, shoulderDx)) * (180 / Math.PI);
    const shoulderWidth = Math.hypot(shoulderDx, shoulderDy);
    const shouldersLevel = Math.abs(shoulderTilt) <= 4.0;

    const isPersonDetected = isHeadVisible;
    const isSinglePerson = true;

    let stabilityScore = 95;
    let feedback = 'Optimal head and shoulder alignment. Tracking active.';

    if (!isPersonDetected) {
      stabilityScore = 0;
      feedback = 'No person detected. Position head and shoulders facing the webcam.';
    } else if (!isLightingAdequate) {
      stabilityScore = 40;
      feedback = analysis.avgBrightness <= 35 ? 'Ambient lighting is dark. Turn on desk light.' : 'Lighting is overexposed.';
    } else if (!isHeadVisible) {
      stabilityScore = 50;
      feedback = 'Head / face not centered. Look forward at the top of your display.';
    } else if (!areShouldersVisible) {
      stabilityScore = 60;
      feedback = 'Position both shoulders inside frame. Step back slightly if needed.';
    } else if (!isCentered) {
      stabilityScore = 75;
      feedback = keypoints.nose.x < 0.5 ? 'Center position: Move slightly to the right.' : 'Center position: Move slightly to the left.';
    } else if (!shouldersLevel) {
      stabilityScore = 80;
      feedback = shoulderTilt > 0 ? 'Right shoulder lower. Level your clavicle.' : 'Left shoulder lower. Level your clavicle.';
    }

    return {
      isPersonDetected,
      isCentered,
      areShouldersVisible,
      isHeadVisible,
      isLightingAdequate,
      isSinglePerson,
      stabilityScore,
      feedbackMessage: feedback,
      shoulderTilt: Math.round(shoulderTilt * 10) / 10,
      shoulderWidth: Math.round(shoulderWidth * 100) / 100,
      leftShoulderDetected: true,
      rightShoulderDetected: true,
      shouldersLevel,
      detectedFaceBounds: analysis.headBounds
    };
  }

  private computeMetricsFromKeypoints(
    keypoints: PoseKeypoints,
    baseline: BaselineProfile | null,
    timestamp: number
  ): PostureMetrics {
    // 1. Head Roll Tilt (angle between eyes in degrees)
    const eyeDx = keypoints.rightEye.x - keypoints.leftEye.x;
    const eyeDy = keypoints.rightEye.y - keypoints.leftEye.y;
    let rawHeadAngle = Math.atan2(eyeDy, Math.max(0.01, eyeDx)) * (180 / Math.PI);
    if (Math.abs(rawHeadAngle) < 2.5) {
      rawHeadAngle = 0.0;
    }

    // 2. Shoulder Angle (tilt between shoulders)
    const shoulderDx = keypoints.rightShoulder.x - keypoints.leftShoulder.x;
    const shoulderDy = keypoints.rightShoulder.y - keypoints.leftShoulder.y;
    let rawShoulderAngle = Math.atan2(shoulderDy, Math.max(0.01, shoulderDx)) * (180 / Math.PI);
    if (Math.abs(rawShoulderAngle) < 2.0) {
      rawShoulderAngle = 0.0;
    }

    // 3. Neck Slouch / Craniovertebral Angle (normalized distance between nose and mid-shoulder)
    const eyeDist = Math.hypot(eyeDx, eyeDy);
    const scaleFactor = Math.max(0.5, eyeDist / 0.11);
    const neckDistance = (keypoints.midShoulder.y - keypoints.nose.y) / scaleFactor;
    const rawNeckAngle = Math.max(0, (0.32 - neckDistance) * 50);

    // 4. Torso alignment
    const torsoDx = keypoints.torsoCenter.x - keypoints.neck.x;
    const rawTorsoAngle = Math.abs(torsoDx) * 40;

    // 5. Distance ratio
    const rawDistance = eyeDist / 0.11;

    // Apply moving average smoothing
    const headAngle = this.smoothValue(this.headAngleBuffer, rawHeadAngle);
    const shoulderAngle = this.smoothValue(this.shoulderAngleBuffer, rawShoulderAngle);
    const neckAngle = this.smoothValue(this.neckAngleBuffer, rawNeckAngle);
    const torsoAngle = Math.round(rawTorsoAngle * 10) / 10;
    const cameraDistance = this.smoothValue(this.distanceBuffer, rawDistance);

    // Compare with baseline
    const baseHead = baseline ? baseline.headAngle : 0;
    const baseShoulder = baseline ? baseline.shoulderAngle : 0;
    const baseNeck = baseline ? baseline.neckAngle : 3.5;
    const baseTorso = baseline ? baseline.torsoAngle : 0;
    const baseDist = baseline ? baseline.cameraDistance : 1.0;

    const headDiff = Math.abs(headAngle - baseHead);
    const shoulderDiff = Math.abs(shoulderAngle - baseShoulder);
    const neckDiff = Math.abs(neckAngle - baseNeck);
    const torsoDiff = Math.abs(torsoAngle - baseTorso);
    const distDiff = Math.abs(cameraDistance - baseDist);

    // Tolerance multipliers
    const tolerance = baseline?.toleranceLevel === 'strict' ? 1.3 : baseline?.toleranceLevel === 'lenient' ? 0.75 : 1.0;

    // Ear-to-Shoulder Spinal Compression
    const currentEarShoulderDist = (
      Math.hypot(keypoints.leftEar.x - keypoints.leftShoulder.x, keypoints.leftEar.y - keypoints.leftShoulder.y) +
      Math.hypot(keypoints.rightEar.x - keypoints.rightShoulder.x, keypoints.rightEar.y - keypoints.rightShoulder.y)
    ) / 2;
    const baseEarDist = baseline?.earShoulderDist ?? 0.24;
    const earDistRatio = currentEarShoulderDist / Math.max(0.05, baseEarDist);
    const slouchPenalty = earDistRatio < 0.85 ? Math.min(25, (0.85 - earDistRatio) * 75 * tolerance) : 0;

    // Penalty calculations with realistic thresholds
    const headPenalty = Math.min(25, (headDiff / 5.0) * 10 * tolerance);
    const shoulderPenalty = Math.min(25, (shoulderDiff / 4.0) * 10 * tolerance);
    const neckPenalty = Math.min(30, (neckDiff / 5.5) * 12 * tolerance);
    const torsoPenalty = Math.min(18, (torsoDiff / 5.0) * 8 * tolerance);
    const distPenalty = Math.min(15, (distDiff / 0.40) * 6 * tolerance);

    const rawScore = Math.max(20, Math.min(100, Math.round(100 - (headPenalty + shoulderPenalty + neckPenalty + torsoPenalty + distPenalty + slouchPenalty))));
    const smoothedScore = Math.round(this.smoothValue(this.scoreBuffer, rawScore));

    let state: PostureState = 'good';
    if (smoothedScore < 75) {
      state = 'poor';
    } else if (smoothedScore < 90) {
      state = 'warning';
    }

    return {
      headAngle: Math.round(headAngle * 10) / 10,
      neckAngle: Math.round(neckAngle * 10) / 10,
      shoulderAngle: Math.round(shoulderAngle * 10) / 10,
      torsoAngle: Math.round(torsoAngle * 10) / 10,
      cameraDistance: Math.round(cameraDistance * 100) / 100,
      postureScore: smoothedScore,
      state,
      timestamp
    };
  }

  private smoothValue(buffer: number[], nextVal: number): number {
    buffer.push(nextVal);
    if (buffer.length > this.bufferSize) {
      buffer.shift();
    }
    const sum = buffer.reduce((acc, val) => acc + val, 0);
    return sum / buffer.length;
  }

  private generateSimulatedData(timestamp: number, baseline: BaselineProfile | null) {
    let headOffset = Math.sin(this.simTime * 0.8) * 1.5;
    let shoulderOffset = Math.cos(this.simTime * 0.6) * 1.2;
    let neckOffset = Math.sin(this.simTime * 0.4) * 1.8;
    let torsoOffset = Math.sin(this.simTime * 0.3) * 1.0;

    let simScore = 95 - Math.abs(headOffset) * 2 - Math.abs(shoulderOffset) * 2;

    if (this.simDeviationType === 'forward_head') {
      neckOffset += 8.5;
      simScore = 68;
    } else if (this.simDeviationType === 'shoulder_slump') {
      shoulderOffset += 7.2;
      simScore = 72;
    } else if (this.simDeviationType === 'slouch') {
      neckOffset += 11.0;
      torsoOffset += 6.5;
      simScore = 58;
    }

    const baseHead = baseline?.headAngle ?? 0;
    const baseShoulder = baseline?.shoulderAngle ?? 0;
    const baseNeck = baseline?.neckAngle ?? 3.5;

    const headAngle = Math.round((baseHead + headOffset) * 10) / 10;
    const shoulderAngle = Math.round((baseShoulder + shoulderOffset) * 10) / 10;
    const neckAngle = Math.round((baseNeck + neckOffset) * 10) / 10;
    const torsoAngle = Math.round((torsoOffset) * 10) / 10;

    const score = Math.max(45, Math.min(99, Math.round(simScore)));
    const state: PostureState = score >= 90 ? 'good' : score >= 75 ? 'warning' : 'poor';

    const metrics: PostureMetrics = {
      headAngle,
      neckAngle,
      shoulderAngle,
      torsoAngle,
      cameraDistance: 1.02,
      postureScore: score,
      state,
      timestamp
    };

    const headX = 0.52 + (torsoOffset * 0.005);
    const headY = 0.50 + (neckOffset * 0.006);
    const shoulderTilt = shoulderAngle * (Math.PI / 180);

    const keypoints: PoseKeypoints = {
      nose: { x: headX, y: headY + 0.03, confidence: 0.98 },
      leftEye: { x: headX - 0.05, y: headY - 0.04, confidence: 0.98 },
      rightEye: { x: headX + 0.05, y: headY - 0.04, confidence: 0.98 },
      leftEar: { x: headX - 0.1, y: headY - 0.02, confidence: 0.95 },
      rightEar: { x: headX + 0.1, y: headY - 0.02, confidence: 0.95 },
      neck: { x: headX, y: 0.76, confidence: 0.97 },
      leftShoulder: { x: 0.26, y: 0.85 - Math.sin(shoulderTilt) * 0.08, confidence: 0.95 },
      rightShoulder: { x: 0.82, y: 0.85 + Math.sin(shoulderTilt) * 0.08, confidence: 0.95 },
      midShoulder: { x: 0.54, y: 0.85, confidence: 0.96 },
      torsoCenter: { x: 0.54 + torsoOffset * 0.01, y: 0.98, confidence: 0.92 }
    };

    const validation: ValidationStatus = {
      isPersonDetected: true,
      isCentered: true,
      areShouldersVisible: true,
      isHeadVisible: true,
      isLightingAdequate: true,
      isSinglePerson: true,
      stabilityScore: 95,
      feedbackMessage: state === 'good' ? 'Great posture! Balanced and centered.' : 'Slouching detected. Align your neck and shoulders.'
    };

    return { metrics, keypoints, validation };
  }
}

export const poseDetector = new PoseDetector();
