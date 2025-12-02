import React, { useState, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Maximize2, Palette, Box, Info, Camera, CameraOff, Settings2, X } from 'lucide-react';
import HandTracker from './components/HandTracker';
import ParticleScene from './components/ParticleScene';
import { HandData, ParticleConfig, ShapeType } from './types';

const COLORS = [
  '#33FF57', // Green (Default for tree)
  '#FFD700', // Gold
  '#FF5733', // Red
  '#3357FF', // Blue
  '#FF33F6', // Pink
  '#33FFF6', // Cyan
  '#FFFFFF', // White
];

const SHAPES = Object.values(ShapeType);

const App: React.FC = () => {
  const [handData, setHandData] = useState<HandData>({
    isPresent: false,
    gestureValue: 0.5,
    tiltX: 0,
    tiltY: 0,
  });

  // 先初始化 isMobile 状态
  const [isMobile, setIsMobile] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  
  // config 依赖 isMobile，放在后面
  const [config, setConfig] = useState<ParticleConfig>({
    count: 3000, // 默认值，会在 useEffect 中根据设备调整
    color: '#33FF57', // Christmas Green
    shape: ShapeType.CHRISTMAS_TREE, // Default to Tree
  });

  // Detect mobile for initial state
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // 根据设备类型调整粒子数量
      setConfig(prev => ({
        ...prev,
        count: mobile ? 2000 : 3000
      }));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 监听 WebGL 上下文丢失
  useEffect(() => {
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.error('[WebGL] 上下文丢失！尝试恢复...');
      setWebglError('3D 渲染出现问题，正在尝试恢复...');
    };

    const handleContextRestored = () => {
      console.log('[WebGL] 上下文已恢复');
      setWebglError(null);
    };

    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);
      
      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      };
    }
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.log("Fullscreen blocked", e);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      {/* Hand Tracking Logic (Hidden/Overlay) */}
      <HandTracker onHandUpdate={setHandData} isEnabled={isCameraActive} />

      {/* WebGL 错误提示 */}
      {webglError && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-red-900/90 text-white px-6 py-4 rounded-lg shadow-lg">
          <p className="font-semibold mb-2">⚠️ {webglError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded text-sm"
          >
            刷新页面
          </button>
        </div>
      )}

      {/* 3D Scene */}
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, isMobile ? 1.5 : 2]} // 移动端降低像素比
        gl={{ 
          antialias: false, 
          alpha: false, 
          powerPreference: "high-performance",
          preserveDrawingBuffer: false, // 节省内存
          failIfMajorPerformanceCaveat: false, // 允许软件渲染
        }}
        className="w-full h-full block touch-none"
        onCreated={({ gl }) => {
          // 启用上下文恢复
          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            console.log('[Canvas] WebGL 上下文丢失，准备恢复');
          });
        }}
      >
        <color attach="background" args={['#050505']} />
        <fog attach="fog" args={['#050505', 5, 20]} />
        
        {/* 基础光照 - 不依赖外部资源 */}
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} color="#4080ff" />
        
        <Suspense fallback={null}>
           <ParticleScene handData={handData} config={config} />
           <OrbitControls 
             enableZoom={!handData.isPresent} 
             enableRotate={!handData.isPresent} 
             enablePan={false}
             autoRotate={!handData.isPresent}
             autoRotateSpeed={0.5}
             rotateSpeed={0.5}
           />
        </Suspense>
      </Canvas>

      {/* --- Mobile/Desktop Responsive UI --- */}

      {/* Main Toggle Button (Always visible) */}
      <button 
        onClick={() => setShowUI(!showUI)}
        className="absolute top-6 right-6 z-50 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
      >
        {showUI ? <X size={20} /> : <Settings2 size={20} />}
      </button>

      {/* Camera Toggle Button (Top Right, Next to settings) */}
      <button 
        onClick={() => setIsCameraActive(!isCameraActive)}
        className={`absolute top-6 right-20 z-50 p-2 rounded-full backdrop-blur-md transition-colors flex items-center gap-2 px-4 ${
          isCameraActive ? 'bg-red-500/20 text-red-200 hover:bg-red-500/30' : 'bg-green-500/20 text-green-200 hover:bg-green-500/30'
        }`}
      >
        {isCameraActive ? <CameraOff size={20} /> : <Camera size={20} />}
        <span className="text-xs font-semibold hidden md:inline">
          {isCameraActive ? 'STOP CAM' : 'START CAM'}
        </span>
      </button>

      {/* UI Container */}
      <div 
        className={`absolute transition-all duration-500 ease-in-out z-40
          ${showUI ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 md:translate-y-0 md:translate-x-full md:opacity-0'}
          
          /* Mobile: Bottom Sheet */
          bottom-0 left-0 right-0 w-full 
          bg-gradient-to-t from-black/90 via-black/80 to-transparent
          p-6 pb-8 flex flex-col gap-4

          /* Desktop: Right Sidebar */
          md:top-0 md:bottom-auto md:left-auto md:right-0 md:w-80 md:h-full md:bg-black/40 md:bg-none
          md:justify-center md:pb-6
        `}
      >
        {/* Desktop Background Blur wrapper */}
        <div className="hidden md:block absolute inset-0 bg-black/40 backdrop-blur-md -z-10" />

        {/* Panel Content */}
        <div className="flex flex-col gap-4 md:gap-6 overflow-y-auto no-scrollbar max-h-[60vh] md:max-h-full">
          
          {/* Status Panel (Mobile condensed) */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 md:p-4">
             <div className="flex items-center gap-2 mb-2 text-white/80">
               <Info size={14} className="md:w-4 md:h-4" />
               <span className="text-xs md:text-sm font-semibold tracking-wider">STATUS</span>
             </div>
             
             {isCameraActive ? (
               <div className="space-y-2">
                 <div className="flex justify-between text-[10px] md:text-xs text-white/60">
                    <span>Hand Tracking</span>
                    <span className={handData.isPresent ? "text-green-400" : "text-yellow-500"}>
                      {handData.isPresent ? "Active" : "Scanning..."}
                    </span>
                 </div>
                 {handData.isPresent && (
                   <div className="w-full bg-white/10 rounded-full h-1">
                     <div 
                        className="bg-green-400 h-1 rounded-full transition-all duration-100" 
                        style={{ width: `${handData.gestureValue * 100}%`}}
                     />
                   </div>
                 )}
                 <p className="text-[10px] text-white/40 pt-1 leading-tight">
                   {handData.isPresent 
                     ? "Open hand to reveal photos." 
                     : "Bring hand into view."}
                 </p>
               </div>
             ) : (
               <p className="text-[10px] md:text-xs text-white/40">Camera is off. Enable camera to interact.</p>
             )}
          </div>

          {/* Shape Selector */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 md:p-4">
            <div className="flex items-center gap-2 mb-3 text-white/80">
              <Box size={14} className="md:w-4 md:h-4" />
              <span className="text-xs md:text-sm font-semibold tracking-wider">GEOMETRY</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SHAPES.map((shape) => (
                <button
                  key={shape}
                  onClick={() => setConfig(c => ({ ...c, shape }))}
                  className={`text-[10px] md:text-xs px-2 py-2 rounded-md transition-all duration-300 text-center truncate ${
                    config.shape === shape 
                      ? 'bg-white text-black font-bold shadow-lg scale-105' 
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {shape === ShapeType.CHRISTMAS_TREE ? '🎄 Tree' : shape}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selector */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 md:p-4">
            <div className="flex items-center gap-2 mb-3 text-white/80">
              <Palette size={14} className="md:w-4 md:h-4" />
              <span className="text-xs md:text-sm font-semibold tracking-wider">COLOR</span>
            </div>
            <div className="flex flex-wrap gap-3 justify-start">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setConfig(c => ({ ...c, color }))}
                  className={`w-6 h-6 md:w-8 md:h-8 rounded-full transition-transform duration-300 border-2 ${
                    config.color === color ? 'border-white scale-110' : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}40` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Toggle (Desktop only mainly, mobile uses browser UI usually) */}
      <button 
        onClick={toggleFullscreen}
        className="hidden md:flex absolute bottom-6 left-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
        title="Toggle Fullscreen"
      >
        <Maximize2 size={20} />
      </button>

      {/* Title */}
      <div 
        className={`absolute top-6 left-6 md:left-1/2 md:-translate-x-1/2 pointer-events-none transition-opacity duration-500 z-30
        ${(handData.isPresent && isCameraActive) ? 'opacity-20' : 'opacity-100'}`}
      >
        <h1 className="text-white font-light text-xl md:text-2xl tracking-[0.2em] uppercase opacity-90 drop-shadow-lg">Zen Particles</h1>
      </div>
    </div>
  );
};

export default App;