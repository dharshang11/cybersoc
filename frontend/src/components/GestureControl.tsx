"use client";

import { useEffect, useRef, useState } from "react";

interface GestureControlProps {
  onGesture: (gesture: string) => void;
}

export default function GestureControl({ onGesture }: GestureControlProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastGestureRef = useRef(0);

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    if (!videoElement || !canvasElement) return;

    const canvasCtx = canvasElement.getContext("2d");
    if (!canvasCtx) return;

    const handsModule = require('@mediapipe/hands');
    const { Hands, HAND_CONNECTIONS } = handsModule;
    const { Camera } = require('@mediapipe/camera_utils');
    const drawingUtils = require('@mediapipe/drawing_utils');

    const hands = new Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.75,
      minTrackingConfidence: 0.75,
    });

    hands.onResults((results: any) => {
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        drawingUtils.drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
          color: "#ff2a2a",
          lineWidth: 2,
        });
        drawingUtils.drawLandmarks(canvasCtx, landmarks, { color: "#ffffff", lineWidth: 1, radius: 2 });

        let gesture = "None";
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];

        const isFingersUp = indexTip.y < landmarks[5].y && middleTip.y < landmarks[9].y && ringTip.y < landmarks[13].y && pinkyTip.y < landmarks[17].y;
        const isFist = indexTip.y > landmarks[5].y && middleTip.y > landmarks[9].y && ringTip.y > landmarks[13].y && pinkyTip.y > landmarks[17].y;
        const isThumbUp = thumbTip.y < indexTip.y && isFist;
        const isIndexUp = indexTip.y < landmarks[5].y && middleTip.y > landmarks[9].y && ringTip.y > landmarks[13].y && pinkyTip.y > landmarks[17].y;

        if (isFingersUp) gesture = "Open Palm";
        else if (isIndexUp) gesture = "Index Finger";
        else if (isThumbUp) gesture = "Thumbs Up";
        else if (isFist) gesture = "Fist";

        const now = Date.now();
        if (gesture !== "None" && now - lastGestureRef.current > 2500) {
          onGesture(gesture);
          lastGestureRef.current = now;
        }
      }
      canvasCtx.restore();
    });

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await hands.send({ image: videoElement });
      },
      width: 320,
      height: 240,
    });

    camera.start();

    return () => {
      camera.stop();
      hands.close();
    };
  }, [onGesture]);

  return (
    <div style={{
      position: "fixed", bottom: 15, right: 15, zIndex: 50,
      width: 200, height: 150, borderRadius: 8,
      border: "1px solid rgba(255,26,26,0.2)",
      overflow: "hidden", opacity: 0.7,
      background: "rgba(0,0,0,0.6)"
    }}>
      <video ref={videoRef} style={{ display: "none" }} autoPlay playsInline></video>
      <canvas ref={canvasRef} width="200" height="150" style={{ display: "block" }}></canvas>
    </div>
  );
}
