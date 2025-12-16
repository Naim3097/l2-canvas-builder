import { Shape, RectShape, CircleShape, PathShape, TextShape, GroupShape, ImageShape, ArtboardShape } from '../types/shapes';

/**
 * Represents the bounding box of a shape
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate the bounding box of any shape
 * Handles all shape types: rect, circle, path, text, image, group, artboard
 */
export function getShapeBounds(shape: Shape): Bounds {
  switch (shape.type) {
    case 'rect':
      return getRectBounds(shape as RectShape);
    case 'circle':
      return getCircleBounds(shape as CircleShape);
    case 'path':
      return getPathBounds(shape as PathShape);
    case 'text':
      return getTextBounds(shape as TextShape);
    case 'image':
      return getImageBounds(shape as ImageShape);
    case 'group':
      return getGroupBounds(shape as GroupShape);
    case 'artboard':
      return getArtboardBounds(shape as ArtboardShape);
    default:
      return { x: shape.x, y: shape.y, width: 0, height: 0 };
  }
}

/**
 * Get bounds of a rectangle shape
 */
function getRectBounds(shape: RectShape): Bounds {
  return {
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height
  };
}

/**
 * Get bounds of a circle shape
 */
function getCircleBounds(shape: CircleShape): Bounds {
  return {
    x: shape.x - shape.radius,
    y: shape.y - shape.radius,
    width: shape.radius * 2,
    height: shape.radius * 2
  };
}

/**
 * Get bounds of a path shape
 * Calculates by finding min/max coordinates in the path data
 */
function getPathBounds(shape: PathShape): Bounds {
  if (!shape.data && (!shape.points || shape.points.length === 0)) {
    return { x: shape.x, y: shape.y, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Parse path data string (SVG path format)
  if (shape.data) {
    const pathPoints = parsePathData(shape.data);
    pathPoints.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  }

  // Parse points array [x1, y1, x2, y2, ...]
  if (shape.points && shape.points.length > 0) {
    for (let i = 0; i < shape.points.length; i += 2) {
      const x = shape.points[i];
      const y = shape.points[i + 1];
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const width = maxX === -Infinity ? 0 : maxX - minX;
  const height = maxY === -Infinity ? 0 : maxY - minY;

  return {
    x: minX === Infinity ? shape.x : minX + shape.x,
    y: minY === Infinity ? shape.y : minY + shape.y,
    width,
    height
  };
}

/**
 * Get bounds of a text shape
 */
function getTextBounds(shape: TextShape): Bounds {
  // Estimate text bounds based on fontSize, text length, and fontFamily
  const text = shape.text || '';
  const fontSize = shape.fontSize || 16;
  const fontFamily = shape.fontFamily || 'Arial';

  // Rough estimation: average character width is ~0.5 * fontSize
  const estimatedWidth = text.length * fontSize * 0.5;
  // Height is approximately fontSize
  const estimatedHeight = fontSize;

  return {
    x: shape.x,
    y: shape.y,
    width: estimatedWidth,
    height: estimatedHeight
  };
}

/**
 * Get bounds of an image shape
 */
function getImageBounds(shape: ImageShape): Bounds {
  return {
    x: shape.x,
    y: shape.y,
    width: shape.width || 0,
    height: shape.height || 0
  };
}

/**
 * Get bounds of a group shape (bounding box of all children)
 */
function getGroupBounds(shape: GroupShape): Bounds {
  if (!shape.children || shape.children.length === 0) {
    return { x: shape.x, y: shape.y, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  shape.children.forEach(child => {
    const childBounds = getShapeBounds(child);
    minX = Math.min(minX, childBounds.x);
    minY = Math.min(minY, childBounds.y);
    maxX = Math.max(maxX, childBounds.x + childBounds.width);
    maxY = Math.max(maxY, childBounds.y + childBounds.height);
  });

  return {
    x: minX === Infinity ? shape.x : minX,
    y: minY === Infinity ? shape.y : minY,
    width: maxX === -Infinity ? 0 : maxX - minX,
    height: maxY === -Infinity ? 0 : maxY - minY
  };
}

/**
 * Get bounds of an artboard shape
 */
function getArtboardBounds(shape: ArtboardShape): Bounds {
  return {
    x: shape.x,
    y: shape.y,
    width: shape.width || 0,
    height: shape.height || 0
  };
}

/**
 * Parse SVG path data string to extract coordinates
 * Handles basic path commands: M (moveto), L (lineto), C (curveto), Z (closepath)
 */
function parsePathData(pathData: string): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const regex = /([MLCQHVSZmlcqhvsz])|(-?\d+\.?\d*)/g;
  const segments: string[] = [];

  let match;
  while ((match = regex.exec(pathData)) !== null) {
    segments.push(match[0]);
  }

  let i = 0;
  let currentX = 0;
  let currentY = 0;

  while (i < segments.length) {
    const cmd = segments[i];
    const isRelative = /[a-z]/.test(cmd);

    switch (cmd.toUpperCase()) {
      case 'M': // moveto
      case 'L': // lineto
        currentX = parseFloat(segments[i + 1]);
        currentY = parseFloat(segments[i + 2]);
        if (isRelative && points.length > 0) {
          currentX += points[points.length - 1].x;
          currentY += points[points.length - 1].y;
        }
        points.push({ x: currentX, y: currentY });
        i += 3;
        break;

      case 'C': // cubic bezier
        // C x1 y1 x2 y2 x y
        points.push({ x: parseFloat(segments[i + 1]), y: parseFloat(segments[i + 2]) }); // cp1
        points.push({ x: parseFloat(segments[i + 3]), y: parseFloat(segments[i + 4]) }); // cp2
        currentX = parseFloat(segments[i + 5]);
        currentY = parseFloat(segments[i + 6]);
        if (isRelative) {
          currentX += points[points.length - 2].x;
          currentY += points[points.length - 2].y;
        }
        points.push({ x: currentX, y: currentY });
        i += 7;
        break;

      case 'H': // horizontal line
        currentX = parseFloat(segments[i + 1]);
        if (isRelative) currentX += (points.length > 0 ? points[points.length - 1].x : 0);
        points.push({ x: currentX, y: currentY });
        i += 2;
        break;

      case 'V': // vertical line
        currentY = parseFloat(segments[i + 1]);
        if (isRelative) currentY += (points.length > 0 ? points[points.length - 1].y : 0);
        points.push({ x: currentX, y: currentY });
        i += 2;
        break;

      case 'Z': // closepath
        i += 1;
        break;

      default:
        i += 1;
        break;
    }
  }

  return points.length > 0 ? points : [{ x: 0, y: 0 }];
}

/**
 * Expand bounds by a padding amount
 */
export function expandBounds(bounds: Bounds, padding: number): Bounds {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2
  };
}

/**
 * Check if a point is inside bounds
 */
export function isPointInBounds(point: { x: number; y: number }, bounds: Bounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/**
 * Check if two bounds intersect
 */
export function boundIntersect(bounds1: Bounds, bounds2: Bounds): boolean {
  return !(
    bounds1.x + bounds1.width < bounds2.x ||
    bounds2.x + bounds2.width < bounds1.x ||
    bounds1.y + bounds1.height < bounds2.y ||
    bounds2.y + bounds2.height < bounds1.y
  );
}

/**
 * Get the center point of bounds
 */
export function getBoundsCenter(bounds: Bounds): { x: number; y: number } {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  };
}
