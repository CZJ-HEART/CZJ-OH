import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandData } from '../types';
import { Camera, RefreshCw, VideoOff, RotateCcw } from 'lucide-react';

interface HandTrackerProps {
  onHandUpdate: (data: HandData) => void;
  isEnabled: boolean;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onHandUpdate, isEnabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Initialize AI Model (only once)
  useEffect(() => {
    const initHandLandmarker = async () => {
      try {
        setError(null);
        console.log('[HandTracker] 开始初始化 AI 模型...');
        console.log('[HandTracker] 浏览器信息:', navigator.userAgent);
        console.log('[HandTracker] 网络状态:', navigator.onLine ? '在线' : '离线');
        
        // 使用本地 WASM 文件（完全本地化）
        const wasmPath = '/wasm';
        console.log('[HandTracker] 加载本地 WASM 文件:', wasmPath);
        console.log('[HandTracker] 开始加载 FilesetResolver...');
        
        const visionStartTime = performance.now();
        const vision = await FilesetResolver.forVisionTasks(wasmPath);
        const visionLoadTime = (performance.now() - visionStartTime) / 1000;
        console.log(`[HandTracker] ✓ WASM 运行时加载完成 (${visionLoadTime.toFixed(2)}秒)`);
        
        // 使用本地模型文件
        const modelPath = '/hand_landmarker.task';
        console.log('[HandTracker] 模型文件路径:', modelPath);

        const baseOptions = {
          modelAssetPath: modelPath,
          delegate: "CPU" as const,
        };

        const options = {
          baseOptions,
          runningMode: "VIDEO" as const,
          numHands: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        };
        
        console.log('[HandTracker] 开始加载 AI 模型（使用 CPU）...');
        console.log('[HandTracker] 配置:', JSON.stringify(options, null, 2));
        
        // 延长超时到 90 秒，添加重试机制
        let retryCount = 0;
        const maxRetries = 2;
        let lastError: Error | null = null;
        
        while (retryCount <= maxRetries) {
          try {
            console.log(`[HandTracker] 尝试初始化 AI 模型 (${retryCount + 1}/${maxRetries + 1})...`);
            const modelStartTime = performance.now();
            
            const initPromise = HandLandmarker.createFromOptions(vision, options);
            const timeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('AI 模型加载超时（90秒）')), 90000)
            );
            
            handLandmarkerRef.current = await Promise.race([initPromise, timeoutPromise]) as HandLandmarker;
            
            const modelLoadTime = (performance.now() - modelStartTime) / 1000;
            console.log(`[HandTracker] ✓ AI 模型加载成功 (${modelLoadTime.toFixed(2)}秒)`);
            console.log(`[HandTracker] ✓ 总耗时: ${((performance.now() - visionStartTime) / 1000).toFixed(2)}秒`);
            break; // 成功，退出重试循环
            
          } catch (retryError: any) {
            lastError = retryError;
            retryCount++;
            
            if (retryCount <= maxRetries) {
              console.warn(`[HandTracker] ⚠️ 第 ${retryCount} 次尝试失败:`, retryError.message);
              console.log(`[HandTracker] 等待 2 秒后重试...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              throw lastError; // 所有重试都失败，抛出错误
            }
          }
        }
        
        setIsModelReady(true);
        console.log('[HandTracker] ✓ AI 模型准备完毕，可以开始使用');
      } catch (e: any) {
        console.error('[HandTracker] ✗ AI 模型初始化失败:', e);
        console.error('[HandTracker] 错误详情:', {
          name: e.name,
          message: e.message,
          stack: e.stack?.slice(0, 200)
        });
        
        const msg = e.message || e.toString();
        if (msg.includes("超时")) {
          setError("AI 模型加载超时。请刷新页面重试");
        } else if (msg.includes("fetch") || msg.includes("NetworkError")) {
          setError("网络错误：无法加载 AI 模型，请检查网络连接");
        } else if (msg.includes("CORS")) {
          setError("跨域错误：请确保网站使用 HTTPS");
        } else if (msg.includes("WASM") || msg.includes("WebAssembly")) {
          setError("浏览器不支持 WASM。请更新浏览器");
        } else {
          setError(`AI 加载失败: ${msg.slice(0, 60)}...`);
        }
      }
    };

    initHandLandmarker();

    return () => {
      if (handLandmarkerRef.current) handLandmarkerRef.current.close();
    };
  }, []);

  // 2. Manage Camera Stream based on isEnabled prop
  useEffect(() => {
    if (!isModelReady) return;

    if (isEnabled) {
      startWebcam();
    } else {
      stopWebcam();
    }

    return () => {
      stopWebcam();
    };
  }, [isEnabled, isModelReady]);

  const startWebcam = async () => {
    if (!videoRef.current) return;
    if (streamRef.current) return; // Already running

    try {
      console.log('[HandTracker] 请求摄像头权限...');
      console.log('[HandTracker] 当前 URL:', window.location.href);
      console.log('[HandTracker] 安全上下文:', window.isSecureContext);
      console.log('[HandTracker] navigator.mediaDevices 可用:', !!navigator.mediaDevices);
      
      // 检查是否在安全上下文中（HTTPS 或 localhost）
      const isSecureContext = window.isSecureContext;
      const hostname = window.location.hostname;
      const isLocalhost = hostname === 'localhost' || 
                          hostname === '127.0.0.1' ||
                          hostname === '';
      
      // 优先检查安全上下文
      if (!isSecureContext && !isLocalhost) {
        const errorMsg = `当前地址 (${window.location.hostname}) 不是安全上下文。` +
                        `摄像头访问需要 HTTPS 或 localhost。\n\n` +
                        `请改用 http://localhost:5173 或部署到 Netlify。`;
        throw new Error(errorMsg);
      }
      
      // 检查浏览器是否支持摄像头 API
      if (!navigator.mediaDevices) {
        const userAgent = navigator.userAgent;
        let browserInfo = '未知浏览器';
        
        if (userAgent.includes('Chrome')) browserInfo = 'Chrome';
        else if (userAgent.includes('Firefox')) browserInfo = 'Firefox';
        else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browserInfo = 'Safari';
        else if (userAgent.includes('Edge')) browserInfo = 'Edge';
        
        throw new Error(`浏览器 (${browserInfo}) 不支持摄像头 API 或未在安全上下文中。\n` +
                       `请确保使用 HTTPS 或 localhost。`);
      }
      
      if (!navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia API 不可用。请更新浏览器到最新版本。');
      }
      
      // 降低分辨率和帧率，减少 GPU 和内存压力
      const constraints = {
        video: { 
          width: { ideal: 480 }, // 从 640 降低到 480
          height: { ideal: 360 }, // 从 480 降低到 360
          facingMode: 'user',
          frameRate: { ideal: 20, max: 24 } // 从 30 降低到 24
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', predictWebcam);
      }
      console.log('[HandTracker] ✓ 摄像头启动成功');
      setError(null);
    } catch (e: any) {
      console.error('[HandTracker] ✗ 摄像头访问失败:', e);
      const errorName = e.name || '';
      const errorMsg = e.message || '';
      
      // 优先显示自定义的详细错误信息
      if (errorMsg.includes('不是安全上下文') || errorMsg.includes('HTTPS') || errorMsg.includes('localhost')) {
        setError('⚠️ 请使用 http://localhost:5173 访问，或部署到 Netlify');
      } else if (errorMsg.includes('不支持摄像头') || errorMsg.includes('getUserMedia')) {
        setError('浏览器不支持。请使用最新版 Chrome/Firefox/Edge');
      } else if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        setError('摄像头权限被拒绝，请点击地址栏左侧允许访问');
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        setError('未检测到摄像头设备');
      } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
        setError('摄像头被占用，请关闭其他使用摄像头的程序');
      } else {
        setError(`摄像头错误: ${errorMsg.slice(0, 60)}`);
      }
    }
  };

  const stopWebcam = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = undefined;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.removeEventListener('loadeddata', predictWebcam);
    }

    // Reset hand data when camera turns off
    onHandUpdate({
      isPresent: false,
      gestureValue: 0.5,
      tiltX: 0,
      tiltY: 0
    });
  };

  const predictWebcam = () => {
    if (!handLandmarkerRef.current || !videoRef.current || !streamRef.current) return;

    // Safety check if video is actually playing and has valid data
    if (videoRef.current.paused || videoRef.current.ended || videoRef.current.readyState < 2) {
      requestRef.current = requestAnimationFrame(predictWebcam);
      return;
    }

    const startTimeMs = performance.now();
    
    if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
      try {
        const result = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
        
        if (result.landmarks && result.landmarks.length > 0) {
          const landmarks = result.landmarks[0];
          
          // Calculate Thumb Tip (4) to Index Tip (8) distance
          const thumbTip = landmarks[4];
          const indexTip = landmarks[8];
          
          const distance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2) +
            Math.pow(thumbTip.z - indexTip.z, 2)
          );

          // Normalize distance approx (0.05 is close, 0.3 is open)
          const normalizedGesture = Math.min(Math.max((distance - 0.05) / 0.2, 0), 1);
          
          // Calculate palm center for Tilt (using wrist 0 and middle finger base 9)
          const middleBase = landmarks[9];
          
          // Simple tilt mapping
          const tiltX = (middleBase.x - 0.5) * 2; // -1 to 1
          const tiltY = (middleBase.y - 0.5) * 2;

          onHandUpdate({
            isPresent: true,
            gestureValue: normalizedGesture,
            tiltX: -tiltX, 
            tiltY: -tiltY
          });
        } else {
           onHandUpdate({
            isPresent: false,
            gestureValue: 0.5, 
            tiltX: 0,
            tiltY: 0
          });
        }
      } catch (e) {
        // console.warn("Prediction error", e);
      }
    }

    if (streamRef.current) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
  };

  if (!isEnabled) return null;

  return (
    <div className="absolute top-4 left-4 z-40 pointer-events-none">
      <div className="relative w-28 h-20 md:w-64 md:h-48 rounded-lg overflow-hidden border border-white/20 bg-black/50 shadow-lg transition-all pointer-events-auto">
        <video 
          ref={videoRef}
          className="w-full h-full object-cover transform scale-x-[-1]" 
          autoPlay 
          playsInline
          muted
        />
        
        {/* Loading Overlay */}
        {!isModelReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white text-[10px] md:text-xs z-10">
            <RefreshCw className="w-4 h-4 animate-spin mr-1" />
            Loading AI...
          </div>
        )}
        
        {/* Error Overlay with Retry */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/90 text-white text-[10px] text-center p-1 leading-tight z-20">
            <span className="mb-1">{error}</span>
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider mt-1"
            >
              <RotateCcw size={8} /> Retry
            </button>
          </div>
        )}
        
        <div className="absolute bottom-1 right-1 z-10">
          {error ? <VideoOff className="w-3 h-3 text-white/50" /> : <Camera className="w-3 h-3 text-white/50" />}
        </div>
      </div>
    </div>
  );
};

export default HandTracker;