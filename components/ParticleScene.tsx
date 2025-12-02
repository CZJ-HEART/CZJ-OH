import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ShapeType, HandData, ParticleConfig } from '../types';
import { generateShapePositions, PARTICLE_COUNT } from '../utils/shapes';

interface ParticleSceneProps {
  handData: HandData;
  config: ParticleConfig;
}

// Number of photos to attempt loading
const PHOTO_COUNT = 17; // 实际照片数量（public/photos/ 中的文件）

// Sub-component for individual photo ornaments
const PhotoOrnaments: React.FC<{ handData: HandData; isVisible: boolean }> = ({ handData, isVisible }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Generate positions specifically for the tiered tree structure
  const ornamentPositions = useMemo(() => {
    const positions: { position: THREE.Vector3, url: string }[] = [];
    const layers = 5;
    const treeHeight = 6;
    const maxRadius = 2.5;
    
    // Distribute photos on the "edges" of the tree branches
    for (let i = 0; i < PHOTO_COUNT; i++) {
      // Pick a layer (avoid top-most tip)
      const layerIdx = i % layers; 
      const layerProgress = layerIdx / (layers - 1);
      
      // Calculate Y position roughly at bottom of a layer where it hangs
      const layerBottomY = -treeHeight/2 + 1.5 + (layerIdx * (treeHeight - 1.5) / layers);
      const y = layerBottomY + 0.2; // Slightly up
      
      // Radius at this height
      const r = maxRadius * (1 - layerProgress * 0.8) + 0.1; // On the edge
      
      // Spiral angle
      const angle = (i * Math.PI * 2 * 0.618); // Golden ratio spiral
      
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      
      positions.push({
        position: new THREE.Vector3(x, y, z),
        url: `photos/${i + 1}.jpg`
      });
    }
    return positions;
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // 1. Visibility Transition
    const targetScale = isVisible ? 1 : 0;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 2);

    // 2. Hand Interaction
    // "Closed" (0.0) -> Ornaments (Small, on tree)
    // "Open" (1.0) -> Gallery (Large, floating out)
    
    const baseSize = 0.4; 
    const expandedSize = 1.8;
    
    groupRef.current.children.forEach((child, i) => {
      const sprite = child as THREE.Sprite;
      const originalPos = ornamentPositions[i].position;

      if (handData.isPresent) {
        // Expand Animation
        const expansion = handData.gestureValue; // 0 to 1
        
        // Target Size
        const targetSize = THREE.MathUtils.lerp(baseSize, expandedSize, expansion);
        const currentScale = sprite.scale.x;
        const newScale = THREE.MathUtils.lerp(currentScale, targetSize, delta * 3);
        sprite.scale.setScalar(newScale);

        // Target Position
        // Move outwards in spiral + slightly upwards
        const dir = originalPos.clone().setY(0).normalize(); // Horizontal direction
        const dist = originalPos.length();
        
        // Spiral out logic
        const spiralRadius = dist + (expansion * 3.5); // Move far out
        const spiralY = originalPos.y + (expansion * (i % 2 === 0 ? 1 : -1)); // Spread vertically
        
        const targetPos = new THREE.Vector3(
            dir.x * spiralRadius,
            spiralY,
            dir.z * spiralRadius
        );
        
        // Add gentle rotation to the gallery
        if (expansion > 0.5) {
             targetPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.clock.elapsedTime * 0.1);
        }

        sprite.position.lerp(targetPos, delta * 3);

        // Opacity/Brightness boost when expanding
        const material = sprite.material;
        material.opacity = THREE.MathUtils.lerp(0.8, 1.0, expansion);

      } else {
        // Return to tree
        sprite.scale.setScalar(THREE.MathUtils.lerp(sprite.scale.x, baseSize, delta * 3));
        sprite.position.lerp(originalPos, delta * 3);
        
        // "Ornament" gentle Bobbing
        sprite.position.y += Math.sin(state.clock.elapsedTime * 2 + i) * 0.002;
      }
    });

    // Rotation logic handled by parent ParticleScene now
  });

  return (
    <group ref={groupRef}>
      {ornamentPositions.map((item, index) => (
        <PhotoSprite key={index} url={item.url} position={item.position} />
      ))}
    </group>
  );
};

const PhotoSprite: React.FC<{ url: string, position: THREE.Vector3 }> = ({ url, position }) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url, 
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      },
      undefined,
      () => { /* Ignore missing, will use fallback */ }
    );
  }, [url]);

  // Dynamic canvas texture for "Ornament" look (fallback or background)
  const ornamentTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Golden glow orb
      const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255, 223, 0, 1)'); // Gold center
      grad.addColorStop(0.5, 'rgba(255, 180, 0, 0.8)');
      grad.addColorStop(1, 'rgba(255, 100, 0, 0)'); // Fade out
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <sprite position={position}>
      {/* If photo loads, use it. If not, use generated gold ornament texture */}
      <spriteMaterial 
        map={texture || ornamentTexture} 
        transparent={true} 
        blending={THREE.NormalBlending}
      />
    </sprite>
  );
};


const ParticleScene: React.FC<ParticleSceneProps> = ({ handData, config }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const rootGroupRef = useRef<THREE.Group>(null);
  
  const currentPositions = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const targetPositions = useRef(new Float32Array(PARTICLE_COUNT * 3));
  
  const currentColor = useRef(new THREE.Color(config.color));
  const targetColor = useRef(new THREE.Color(config.color));

  useEffect(() => {
    // Cast to 'any' to bypass TypeScript build error about Float32Array mismatches
    targetPositions.current = generateShapePositions(config.shape) as any;
    targetColor.current.set(config.color);
  }, [config.shape, config.color]);

  useEffect(() => {
    const initialPos = generateShapePositions(ShapeType.SPHERE);
    currentPositions.current.set(initialPos);
    if (pointsRef.current) {
      pointsRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions.current, 3));
    }
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current || !rootGroupRef.current) return;

    // --- 1. Infinite Rotation Interaction ---
    if (handData.isPresent) {
      // Use tiltX (which is hand's horizontal position from center, -1 to 1) as Velocity
      // Deadzone in the middle to allow stopping
      let rotationSpeed = handData.tiltX; 
      if (Math.abs(rotationSpeed) < 0.1) rotationSpeed = 0; // Deadzone
      
      // Rotate the entire group
      rootGroupRef.current.rotation.y += rotationSpeed * delta * 2.5; 
      
      // Optional: Tilt X axis slightly for 3D feel based on vertical hand pos
      rootGroupRef.current.rotation.x = THREE.MathUtils.lerp(rootGroupRef.current.rotation.x, handData.tiltY * 0.5, delta * 2);

    } else {
      // Auto-spin slowly when idle
      rootGroupRef.current.rotation.y += delta * 0.1;
      rootGroupRef.current.rotation.x = THREE.MathUtils.lerp(rootGroupRef.current.rotation.x, 0, delta);
    }

    // --- 2. Particle Morphing ---
    const geometry = pointsRef.current.geometry;
    const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = positionAttribute.array as Float32Array;
    
    const morphSpeed = handData.isPresent ? 4.0 : 2.0;
    const dt = Math.min(delta * morphSpeed, 1);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      let cx = positions[ix];
      let cy = positions[iy];
      let cz = positions[iz];

      const tx = targetPositions.current[ix];
      const ty = targetPositions.current[iy];
      const tz = targetPositions.current[iz];

      cx += (tx - cx) * dt;
      cy += (ty - cy) * dt;
      cz += (tz - cz) * dt;

      positions[ix] = cx;
      positions[iy] = cy;
      positions[iz] = cz;
    }
    
    positionAttribute.needsUpdate = true;

    // --- 3. Scale Interaction (Pinch/Spread) ---
    if (handData.isPresent) {
      const targetScale = 0.8 + (handData.gestureValue * 1.0); // 0.8 to 1.8
      pointsRef.current.scale.setScalar(THREE.MathUtils.lerp(pointsRef.current.scale.x, targetScale, 0.1));
    } else {
      const breathe = 1 + Math.sin(state.clock.elapsedTime) * 0.05;
      pointsRef.current.scale.setScalar(THREE.MathUtils.lerp(pointsRef.current.scale.x, breathe, 0.05));
    }

    // --- 4. Color Update ---
    currentColor.current.lerp(targetColor.current, delta * 2);
    (pointsRef.current.material as THREE.PointsMaterial).color.set(currentColor.current);
  });

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    if (context) {
      context.beginPath();
      context.arc(16, 16, 14, 0, Math.PI * 2);
      context.fillStyle = 'white';
      context.fill();
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <group ref={rootGroupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={PARTICLE_COUNT}
            array={currentPositions.current}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.12}
          map={texture}
          transparent
          opacity={0.8}
          vertexColors={false}
          color={config.color}
          sizeAttenuation={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <PhotoOrnaments 
        handData={handData} 
        isVisible={config.shape === ShapeType.CHRISTMAS_TREE} 
      />
    </group>
  );
};

export default ParticleScene;