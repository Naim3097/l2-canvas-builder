export type Matrix = [number, number, number, number, number, number];

export const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];

export const multiplyMatrices = (m1: Matrix, m2: Matrix): Matrix => {
    const [a1, b1, c1, d1, tx1, ty1] = m1;
    const [a2, b2, c2, d2, tx2, ty2] = m2;

    return [
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * tx2 + c1 * ty2 + tx1,
        b1 * tx2 + d1 * ty2 + ty1
    ];
};

export const createTranslation = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
export const createRotation = (angleRad: number): Matrix => {
    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);
    return [c, s, -s, c, 0, 0];
};
export const createScale = (sx: number, sy: number): Matrix => [sx, 0, 0, sy, 0, 0];
export const createSkew = (skx: number, sky: number): Matrix => [1, Math.tan(sky), Math.tan(skx), 1, 0, 0];

// Decompose matrix into Konva-compatible attributes
// Konva transform = T * R * Sk * S (Translate, Rotate, Skew, Scale)
// But Konva's skew is separate skewX and skewY.
// This is a simplified decomposition assuming standard SRT order.
export const decomposeMatrix = (m: Matrix) => {
    const [a, b, c, d, tx, ty] = m;
    
    // Translation
    const x = tx;
    const y = ty;
    
    // Rotation (from a and b)
    // This assumes no skew for rotation calculation, or handles it.
    // QR decomposition is better.
    // Let's use a standard method.
    
    const delta = a * d - b * c;
    
    // Scale
    // This is an approximation if there is skew.
    // But for standard UI transforms (Rotate + Scale), this works.
    let rotation = 0;
    let scaleX = Math.sqrt(a * a + b * b);
    let scaleY = Math.sqrt(c * c + d * d);
    let skewX = 0;
    let skewY = 0;

    if (a !== 0 || b !== 0) {
        const r = Math.atan2(b, a);
        rotation = r * (180 / Math.PI); // Degrees
    }
    
    // If determinant is negative, one scale is negative
    if (delta < 0) {
        if (a < d) scaleX = -scaleX;
        else scaleY = -scaleY;
    }
    
    // This decomposition is "lossy" if the matrix was formed with complex skew.
    // But it's enough to render "correctly" if we re-compose it in the same order.
    // Ideally, we should pass the matrix directly to Konva if possible.
    
    return {
        x,
        y,
        rotation,
        scaleX,
        scaleY,
        skewX,
        skewY
    };
};

// Helper to apply transform to a point
export const applyTransform = (p: {x: number, y: number}, m: Matrix) => {
    return {
        x: m[0] * p.x + m[2] * p.y + m[4],
        y: m[1] * p.x + m[3] * p.y + m[5]
    };
};
