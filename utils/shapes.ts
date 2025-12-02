import * as THREE from 'three';
import { ShapeType } from '../types';

export const PARTICLE_COUNT = 8000;

const getRandomPointInSphere = (radius: number) => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = Math.cbrt(Math.random()) * radius;
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    r * sinPhi * Math.cos(theta),
    r * sinPhi * Math.sin(theta),
    r * Math.cos(phi)
  );
};

export const generateShapePositions = (type: ShapeType): Float32Array => {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const tempVec = new THREE.Vector3();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    let x = 0, y = 0, z = 0;

    switch (type) {
      case ShapeType.SPHERE: {
        const p = getRandomPointInSphere(4);
        x = p.x; y = p.y; z = p.z;
        break;
      }
      case ShapeType.HEART: {
        // Parametric Heart
        const t = Math.random() * Math.PI * 2;
        // x = 16sin^3(t)
        // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
        const scale = 0.25;
        // Spread particles inside the volume
        const r = Math.sqrt(Math.random()); 
        
        x = scale * 16 * Math.pow(Math.sin(t), 3);
        y = scale * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
        z = (Math.random() - 0.5) * 2; // Thickness
        
        // Pull slightly towards center for volume
        x *= r;
        y *= r;
        z *= Math.random() * 2; 
        break;
      }
      case ShapeType.FLOWER: {
        // Rose curve / Polar
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const k = 3; // Petals
        const r = 3 * Math.cos(k * theta) + 1; // Basic rose
        
        // Convert to 3D with some volume
        const dist = Math.random() * 2;
        x = r * Math.cos(theta) * Math.sin(phi);
        z = r * Math.sin(theta) * Math.sin(phi);
        y = r * Math.cos(phi) * 0.5;
        break;
      }
      case ShapeType.SATURN: {
        const rand = Math.random();
        if (rand < 0.4) {
          // Planet body
          const p = getRandomPointInSphere(2.5);
          x = p.x; y = p.y; z = p.z;
        } else {
          // Rings
          const angle = Math.random() * Math.PI * 2;
          const dist = 3.5 + Math.random() * 2.5; // Ring radius 3.5 to 6
          x = Math.cos(angle) * dist;
          z = Math.sin(angle) * dist;
          y = (Math.random() - 0.5) * 0.2; // Thin rings
        }
        
        // Tilt the whole planet
        tempVec.set(x, y, z);
        tempVec.applyAxisAngle(new THREE.Vector3(1, 0, 1).normalize(), Math.PI / 6);
        x = tempVec.x; y = tempVec.y; z = tempVec.z;
        break;
      }
      case ShapeType.BUDDHA: {
        // Abstract Meditating Figure Construction
        const rand = Math.random();
        
        if (rand < 0.2) {
          // Head
          const p = getRandomPointInSphere(0.9);
          x = p.x; y = p.y + 2.5; z = p.z;
        } else if (rand < 0.6) {
          // Body (Cone-ish)
          const h = Math.random() * 3; // Height 0 to 3
          const r = 1.5 * (1 - h/3.5) + 0.2; // Radius gets smaller at top
          const angle = Math.random() * Math.PI * 2;
          x = Math.cos(angle) * r;
          z = Math.sin(angle) * r;
          y = h - 0.5;
        } else {
           // Legs (Base Oval/Torus)
           const angle = Math.random() * Math.PI * 2;
           const r = 2.0 + Math.random() * 0.8;
           const tubeR = 0.8 * Math.random();
           // Torus approximation
           x = (r + tubeR * Math.cos(angle * 5)) * Math.cos(angle);
           z = (r + tubeR * Math.cos(angle * 5)) * Math.sin(angle);
           y = tubeR * Math.sin(angle * 5) - 1.0;
        }
        break;
      }
      case ShapeType.FIREWORKS: {
        // Explosion burst - just a large sphere with concentration at center
        const u = Math.random();
        // Inverse square distribution for burst effect
        const r = 6 * (1 - Math.pow(Math.random(), 4)); 
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);
        break;
      }
      case ShapeType.CHRISTMAS_TREE: {
        // Tiered Pine Tree Structure
        const layers = 5; // Number of distinct branches/layers
        const treeHeight = 6;
        const maxRadius = 2.5;
        
        const rand = Math.random();
        
        if (rand > 0.95) {
          // Star at top
          x = (Math.random() - 0.5) * 0.4;
          z = (Math.random() - 0.5) * 0.4;
          y = treeHeight / 2 + Math.random() * 0.5;
        } else if (rand < 0.1) {
          // Trunk
          const trunkH = 1.5;
          const trunkR = 0.4;
          const angle = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * trunkR;
          x = Math.cos(angle) * r;
          z = Math.sin(angle) * r;
          y = -treeHeight/2 + Math.random() * trunkH;
        } else {
          // Leaves / Branches
          // Pick a random layer
          const layerIdx = Math.floor(Math.random() * layers);
          const layerProgress = layerIdx / (layers - 1); // 0 (bottom) to 1 (top)
          
          // Height of this specific particle within the layer
          const hInLayer = Math.random(); 
          
          // Overall Y position
          // Bottom of tree is -2.5, Top is 2.5
          // We distribute layers along this
          const layerBottomY = -treeHeight/2 + 1.5 + (layerIdx * (treeHeight - 1.5) / layers);
          y = layerBottomY + hInLayer * (treeHeight / layers);
          
          // Radius logic: Wide at bottom, narrow at top
          // Each layer is itself a cone
          const layerBaseRadius = maxRadius * (1 - layerProgress * 0.8);
          const r = layerBaseRadius * (1 - hInLayer) * Math.sqrt(Math.random());
          
          const angle = Math.random() * Math.PI * 2;
          
          x = Math.cos(angle) * r;
          z = Math.sin(angle) * r;
        }
        break;
      }
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }

  return positions;
};