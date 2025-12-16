import { Command, parseSVG, makeAbsolute } from 'svg-path-parser';

export interface PathPoint {
    type: 'M' | 'L' | 'C' | 'Z';
    x?: number;
    y?: number;
    cp1?: { x: number; y: number };
    cp2?: { x: number; y: number };
}

export const parsePathData = (d: string): PathPoint[] => {
    try {
        const commands = makeAbsolute(parseSVG(d));
        return normalizePath(commands);
    } catch (e) {
        console.error("Path parse error", e);
        return [];
    }
};

export const reconstructPathData = (points: PathPoint[] | any[]): string => {
    return points.map(pt => {
        if (pt.type === 'M') return `M ${pt.x} ${pt.y}`;
        if (pt.type === 'L') return `L ${pt.x} ${pt.y}`;
        if (pt.type === 'C') return `C ${pt.cp1.x} ${pt.cp1.y}, ${pt.cp2.x} ${pt.cp2.y}, ${pt.x} ${pt.y}`;
        if (pt.type === 'Z') return 'Z';
        return '';
    }).join(' ');
};

// Helper to reflect a point around a center
const reflect = (x: number, y: number, cx: number, cy: number) => ({
    x: 2 * cx - x,
    y: 2 * cy - y
});

// Helper to convert degrees to radians
const degToRad = (deg: number) => (deg * Math.PI) / 180;

// Arc to Cubic Bezier conversion
const arcToCubic = (
    px: number, py: number,
    rx: number, ry: number,
    xAxisRotation: number,
    largeArcFlag: number,
    sweepFlag: number,
    cx: number, cy: number
): PathPoint[] => {
    const curves: PathPoint[] = [];

    if (rx === 0 || ry === 0) {
        return [];
    }

    const sinPhi = Math.sin(degToRad(xAxisRotation));
    const cosPhi = Math.cos(degToRad(xAxisRotation));

    const pxp = cosPhi * (px - cx) / 2 + sinPhi * (py - cy) / 2;
    const pyp = -sinPhi * (px - cx) / 2 + cosPhi * (py - cy) / 2;

    if (pxp === 0 && pyp === 0) {
        return [];
    }

    rx = Math.abs(rx);
    ry = Math.abs(ry);

    const lambda = Math.pow(pxp, 2) / Math.pow(rx, 2) + Math.pow(pyp, 2) / Math.pow(ry, 2);

    if (lambda > 1) {
        rx *= Math.sqrt(lambda);
        ry *= Math.sqrt(lambda);
    }

    let rxsq = Math.pow(rx, 2);
    let rysq = Math.pow(ry, 2);
    let pxpsq = Math.pow(pxp, 2);
    let pypsq = Math.pow(pyp, 2);

    let radicant = (rxsq * rysq - rxsq * pypsq - rysq * pxpsq) / (rxsq * pypsq + rysq * pxpsq);

    if (radicant < 0) radicant = 0;

    radicant = Math.sqrt(radicant);

    if (largeArcFlag === sweepFlag) radicant = -radicant;

    const cxp = radicant * rx / ry * pyp;
    const cyp = radicant * -ry / rx * pxp;

    const centerx_real = cosPhi * cxp - sinPhi * cyp + (px + cx) / 2;
    const centery_real = sinPhi * cxp + cosPhi * cyp + (py + cy) / 2;

    const v1x = (pxp - cxp) / rx;
    const v1y = (pyp - cyp) / ry;
    const v2x = (-pxp - cxp) / rx;
    const v2y = (-pyp - cyp) / ry;

    const angle = (u: {x:number, y:number}, v: {x:number, y:number}) => {
        const sign = u.x * v.y - u.y * v.x < 0 ? -1 : 1;
        let dot = u.x * v.x + u.y * v.y;
        if (dot > 1) dot = 1;
        if (dot < -1) dot = -1;
        return sign * Math.acos(dot);
    };

    const theta1 = angle({x: 1, y: 0}, {x: v1x, y: v1y});
    let deltaTheta = angle({x: v1x, y: v1y}, {x: v2x, y: v2y});

    if (sweepFlag === 0 && deltaTheta > 0) deltaTheta -= 2 * Math.PI;
    if (sweepFlag === 1 && deltaTheta < 0) deltaTheta += 2 * Math.PI;

    const segments = Math.ceil(Math.abs(deltaTheta) / (Math.PI / 2));
    const delta = deltaTheta / segments;
    const t = 8 / 3 * Math.sin(delta / 4) * Math.sin(delta / 4) / Math.sin(delta / 2);

    let startX = px;
    let startY = py;

    for (let i = 0; i < segments; i++) {
        const cosTheta1 = Math.cos(theta1 + i * delta);
        const sinTheta1 = Math.sin(theta1 + i * delta);
        const cosTheta2 = Math.cos(theta1 + (i + 1) * delta);
        const sinTheta2 = Math.sin(theta1 + (i + 1) * delta);

        const epx = cosPhi * rx * cosTheta2 - sinPhi * ry * sinTheta2 + centerx_real;
        const epy = sinPhi * rx * cosTheta2 + cosPhi * ry * sinTheta2 + centery_real;

        const dx1 = t * (-cosPhi * rx * sinTheta1 - sinPhi * ry * cosTheta1);
        const dy1 = t * (-sinPhi * rx * sinTheta1 + cosPhi * ry * cosTheta1);

        const dx2 = t * (cosPhi * rx * sinTheta2 + sinPhi * ry * cosTheta2);
        const dy2 = t * (sinPhi * rx * sinTheta2 - cosPhi * ry * cosTheta2);

        curves.push({
            type: 'C',
            cp1: { x: startX + dx1, y: startY + dy1 },
            cp2: { x: epx + dx2, y: epy + dy2 },
            x: epx,
            y: epy
        });

        startX = epx;
        startY = epy;
    }

    return curves;
};

export const normalizePath = (commands: Command[]): PathPoint[] => {
    const result: PathPoint[] = [];
    let lastX = 0;
    let lastY = 0;
    let lastControlX = 0;
    let lastControlY = 0;
    let lastCommandType = '';

    for (const cmd of commands) {
        // svg-path-parser makeAbsolute returns commands with x0, y0 (start) and x, y (end)
        // But for the first command M, x0/y0 might be 0.
        
        if (cmd.code === 'M') {
            result.push({ type: 'M', x: cmd.x, y: cmd.y });
            lastX = cmd.x;
            lastY = cmd.y;
            lastControlX = cmd.x;
            lastControlY = cmd.y;
        } else if (cmd.code === 'L') {
            result.push({ type: 'L', x: cmd.x, y: cmd.y });
            lastX = cmd.x;
            lastY = cmd.y;
            lastControlX = cmd.x;
            lastControlY = cmd.y;
        } else if (cmd.code === 'H') {
            // makeAbsolute usually provides y, but fallback to lastY just in case
            const y = (cmd as any).y !== undefined ? (cmd as any).y : lastY;
            result.push({ type: 'L', x: cmd.x, y }); 
            lastX = cmd.x;
            lastY = y;
            lastControlX = cmd.x;
            lastControlY = y;
        } else if (cmd.code === 'V') {
            // makeAbsolute usually provides x, but fallback to lastX just in case
            const x = (cmd as any).x !== undefined ? (cmd as any).x : lastX;
            result.push({ type: 'L', x, y: cmd.y }); 
            lastX = x;
            lastY = cmd.y;
            lastControlX = x;
            lastControlY = cmd.y;
        } else if (cmd.code === 'C') {
            result.push({
                type: 'C',
                cp1: { x: cmd.x1, y: cmd.y1 },
                cp2: { x: cmd.x2, y: cmd.y2 },
                x: cmd.x,
                y: cmd.y
            });
            lastX = cmd.x;
            lastY = cmd.y;
            lastControlX = cmd.x2;
            lastControlY = cmd.y2;
        } else if (cmd.code === 'S') {
            // Smooth Cubic: reflect last control point
            let cp1x = lastX;
            let cp1y = lastY;
            if (lastCommandType === 'C' || lastCommandType === 'S') {
                const r = reflect(lastControlX, lastControlY, lastX, lastY);
                cp1x = r.x;
                cp1y = r.y;
            }
            result.push({
                type: 'C',
                cp1: { x: cp1x, y: cp1y },
                cp2: { x: cmd.x2, y: cmd.y2 },
                x: cmd.x,
                y: cmd.y
            });
            lastX = cmd.x;
            lastY = cmd.y;
            lastControlX = cmd.x2;
            lastControlY = cmd.y2;
        } else if (cmd.code === 'Q') {
            // Quadratic to Cubic
            // CP1 = start + 2/3 * (control - start)
            // CP2 = end + 2/3 * (control - end)
            const cp1x = lastX + (2/3) * (cmd.x1 - lastX);
            const cp1y = lastY + (2/3) * (cmd.y1 - lastY);
            const cp2x = cmd.x + (2/3) * (cmd.x1 - cmd.x);
            const cp2y = cmd.y + (2/3) * (cmd.y1 - cmd.y);
            
            result.push({
                type: 'C',
                cp1: { x: cp1x, y: cp1y },
                cp2: { x: cp2x, y: cp2y },
                x: cmd.x,
                y: cmd.y
            });
            lastX = cmd.x;
            lastY = cmd.y;
            lastControlX = cmd.x1; // Keep quadratic control for next T if needed? No, T reflects quadratic control.
            // Wait, for T support, we need the original quadratic control point.
            // But we are converting to C.
            // If the next command is T, it expects the previous command to be Q.
            // If we convert Q to C, T handling becomes tricky if we don't track the "virtual" quadratic control point.
            // But T is defined as reflection of the previous control point.
            // If we convert everything to C, we should convert T to S? Or just calculate the reflection and convert to C.
            // Let's store the "effective" control point for reflection.
            lastControlX = cmd.x1;
            lastControlY = cmd.y1;
        } else if (cmd.code === 'T') {
            // Smooth Quadratic to Cubic
            let qCpX = lastX;
            let qCpY = lastY;
            if (lastCommandType === 'Q' || lastCommandType === 'T') {
                const r = reflect(lastControlX, lastControlY, lastX, lastY);
                qCpX = r.x;
                qCpY = r.y;
            }
            
            // Now convert this implied Q to C
            const cp1x = lastX + (2/3) * (qCpX - lastX);
            const cp1y = lastY + (2/3) * (qCpY - lastY);
            const cp2x = cmd.x + (2/3) * (qCpX - cmd.x);
            const cp2y = cmd.y + (2/3) * (qCpY - cmd.y);

            result.push({
                type: 'C',
                cp1: { x: cp1x, y: cp1y },
                cp2: { x: cp2x, y: cp2y },
                x: cmd.x,
                y: cmd.y
            });
            
            lastX = cmd.x;
            lastY = cmd.y;
            lastControlX = qCpX;
            lastControlY = qCpY;
        } else if (cmd.code === 'A') {
            // Arc to Cubic
            const curves = arcToCubic(
                lastX, lastY,
                cmd.rx, cmd.ry,
                cmd.xAxisRotation,
                cmd.largeArc ? 1 : 0,
                cmd.sweep ? 1 : 0,
                cmd.x, cmd.y
            );
            result.push(...curves);
            
            lastX = cmd.x;
            lastY = cmd.y;
            
            if (curves.length > 0) {
                const lastCurve = curves[curves.length - 1];
                lastControlX = lastCurve.cp2!.x;
                lastControlY = lastCurve.cp2!.y;
            } else {
                lastControlX = cmd.x;
                lastControlY = cmd.y;
            }
        } else if (cmd.code === 'Z') {
            result.push({ type: 'Z' });
            // Z doesn't change point, but usually goes back to start of subpath.
            // We don't track subpath start here easily without more state.
            // But for reflection purposes, Z usually resets control points?
            // Let's assume it does.
        }
        
        lastCommandType = cmd.code;
    }
    
    return result;
};


