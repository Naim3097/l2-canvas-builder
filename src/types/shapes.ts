export type ShapeType = 'rect' | 'path' | 'image' | 'group' | 'artboard' | 'text' | 'instance' | 'circle';

export interface GradientStop {
    offset: number;
    color: string;
}

export interface Fill {
    id: string;
    type: 'solid' | 'linear-gradient' | 'radial-gradient' | 'image';
    color?: string;
    gradientStops?: GradientStop[];
    gradientStart?: { x: number; y: number };
    gradientEnd?: { x: number; y: number };
    image?: string;
    opacity?: number;
    visible?: boolean;
}

export interface Stroke {
    id: string;
    color: string;
    width: number;
    dash?: number[];
    cap?: 'butt' | 'round' | 'square';
    join?: 'miter' | 'round' | 'bevel';
    opacity?: number;
    visible?: boolean;
}

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  transform?: [number, number, number, number, number, number]; // Affine Matrix [a, b, c, d, tx, ty]
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
  strokeAlign?: 'center' | 'inside' | 'outside';
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';
  shadowBlur?: number;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  blur?: number;
  blurRadius?: number;
  visible?: boolean;
  locked?: boolean;
  name?: string;
  interaction?: { 
      type: 'navigate' | 'overlay' | 'back'; 
      targetId?: string; 
      transition?: 'instant' | 'dissolve' | 'slide_left' | 'slide_right' | 'push';
  };
  layoutSizingHorizontal?: 'fixed' | 'fill' | 'hug';
  layoutSizingVertical?: 'fixed' | 'fill' | 'hug';
  clipData?: string;
  
  // New Appearance Model
  fills?: Fill[];
  strokes?: Stroke[];
}

export interface RectShape extends BaseShape {
  type: 'rect';
  width: number;
  height: number;
  fill: string;
  fillType?: 'solid' | 'image' | 'linear-gradient' | 'radial-gradient';
  fillImage?: string;
  fillGradientStops?: Array<{ offset: number; color: string }>;
  fillGradientStart?: { x: number; y: number };
  fillGradientEnd?: { x: number; y: number };
  stroke?: string;
  strokeWidth?: number;
  strokeDash?: number[];
  cornerRadius?: number;
}

export interface CircleShape extends BaseShape {
    type: 'circle';
    radius: number;
    fill: string;
    stroke?: string;
    strokeWidth?: number;
    strokeDash?: number[];
}

export interface PathShape extends BaseShape {
  type: 'path';
  width?: number;
  height?: number;
  points?: number[];
  data?: string;
  stroke: string;
  strokeWidth: number;
  strokeDash?: number[];
  strokeCap?: 'butt' | 'round' | 'square';
  strokeJoin?: 'miter' | 'round' | 'bevel';
  fill?: string;
  fillType?: 'solid' | 'linear-gradient' | 'radial-gradient';
  fillGradientStops?: Array<{ offset: number; color: string }>;
  fillGradientStart?: { x: number; y: number };
  fillGradientEnd?: { x: number; y: number };
  fillRule?: 'nonzero' | 'evenodd';
  cornerRadius?: number;
}

export interface ImageShape extends BaseShape {
  type: 'image';
  width: number;
  height: number;
  src: string;
  imageElement?: HTMLImageElement; // Runtime only
  stroke?: string;
  strokeWidth?: number;
  strokeDash?: number[];
  cornerRadius?: number;
  
  // Image Adjustments
  brightness?: number; // -1 to 1
  contrast?: number;   // -100 to 100
  saturation?: number; // -10 to 10
  hue?: number;        // 0 to 360
  blur?: number;       // 0 to 100
}

export interface GroupShape extends BaseShape {
    type: 'group';
    children: Shape[];
    width?: number;
    height?: number;
    clip?: boolean;
    layoutMode?: 'none' | 'horizontal' | 'vertical';
    gap?: number;
    padding?: number;
    alignItems?: 'start' | 'center' | 'end';
    justifyContent?: 'start' | 'center' | 'end' | 'space-between';
}

export interface ArtboardShape extends BaseShape {
    type: 'artboard';
    width: number;
    height: number;
    fill: string;
    children: Shape[];
    name: string;
}

export interface TextShape extends BaseShape {
    type: 'text';
    text: string;
    fontSize: number;
    fontFamily: string;
    fontWeight: string;
    fontStyle?: string;
    textDecoration?: string;
    fill: string;
    fillType?: 'solid' | 'linear-gradient' | 'radial-gradient';
    fillGradientStops?: Array<{ offset: number; color: string }>;
    fillGradientStart?: { x: number; y: number };
    fillGradientEnd?: { x: number; y: number };
    stroke?: string;
    strokeWidth?: number;
    align: 'left' | 'center' | 'right' | 'justify';
    letterSpacing?: number;
    lineHeight?: number;
    width?: number;
    pathData?: string;
}

export interface InstanceShape extends BaseShape {
    type: 'instance';
    componentId: string;
    width: number;
    height: number;
    overrides?: Record<string, Partial<Shape>>;
}

export type Shape = RectShape | PathShape | ImageShape | GroupShape | ArtboardShape | TextShape | InstanceShape | CircleShape;
