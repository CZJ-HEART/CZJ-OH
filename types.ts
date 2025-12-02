export enum ShapeType {
  SPHERE = 'Sphere',
  HEART = 'Heart',
  FLOWER = 'Flower',
  SATURN = 'Saturn',
  BUDDHA = 'Buddha',
  FIREWORKS = 'Fireworks',
  CHRISTMAS_TREE = 'Christmas Tree'
}

export interface HandData {
  isPresent: boolean;
  gestureValue: number; // 0.0 (closed) to 1.0 (open)
  tiltX: number;
  tiltY: number;
}

export interface ParticleConfig {
  count: number;
  color: string;
  shape: ShapeType;
}