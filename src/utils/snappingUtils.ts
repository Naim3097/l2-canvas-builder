import Konva from 'konva';

export interface SnapResult {
    x: number | null;
    y: number | null;
    guides: {
        vertical: number[];
        horizontal: number[];
    };
}

export const SNAP_DIST = 10;

export function getSnapGuides(
    layer: Konva.Layer, 
    skipNode: Konva.Node, 
    transformer: Konva.Transformer | null,
    stageWidth: number,
    stageHeight: number
) {
    const guideStops = {
        vertical: [0, stageWidth / 2, stageWidth],
        horizontal: [0, stageHeight / 2, stageHeight]
    };

    layer.children.forEach(child => {
        if (child === skipNode || child === transformer || child.name() === 'guide-layer' || !child.listening()) return;
        
        const box = child.getClientRect({ skipTransform: false }); // Use absolute client rect
        
        guideStops.vertical.push(box.x, box.x + box.width / 2, box.x + box.width);
        guideStops.horizontal.push(box.y, box.y + box.height / 2, box.y + box.height);
    });

    return guideStops;
}

export function calculateSnap(
    node: Konva.Node,
    guideStops: { vertical: number[], horizontal: number[] }
): SnapResult {
    const box = node.getClientRect({ skipTransform: false });
    const absPos = node.absolutePosition();
    const offsetX = box.x - absPos.x;
    const offsetY = box.y - absPos.y;

    const result: SnapResult = {
        x: null,
        y: null,
        guides: { vertical: [], horizontal: [] }
    };

    // Vertical Snapping (X)
    const vEdges = [
        { guide: box.x, offset: offsetX }, // Left
        { guide: box.x + box.width / 2, offset: offsetX + box.width / 2 }, // Center
        { guide: box.x + box.width, offset: offsetX + box.width } // Right
    ];

    let minV = SNAP_DIST;
    vEdges.forEach(edge => {
        guideStops.vertical.forEach(stop => {
            const diff = Math.abs(stop - edge.guide);
            if (diff < minV) {
                minV = diff;
                result.x = stop - edge.offset;
                result.guides.vertical = [stop];
            }
        });
    });

    // Horizontal Snapping (Y)
    const hEdges = [
        { guide: box.y, offset: offsetY }, // Top
        { guide: box.y + box.height / 2, offset: offsetY + box.height / 2 }, // Middle
        { guide: box.y + box.height, offset: offsetY + box.height } // Bottom
    ];

    let minH = SNAP_DIST;
    hEdges.forEach(edge => {
        guideStops.horizontal.forEach(stop => {
            const diff = Math.abs(stop - edge.guide);
            if (diff < minH) {
                minH = diff;
                result.y = stop - edge.offset;
                result.guides.horizontal = [stop];
            }
        });
    });

    return result;
}

export function drawGuides(layer: Konva.Layer, guides: { vertical: number[], horizontal: number[] }) {
    let guideLayer = layer.findOne('.guide-layer') as Konva.Group;
    if (!guideLayer) {
        guideLayer = new Konva.Group({ name: 'guide-layer', listening: false });
        layer.add(guideLayer);
    } else {
        guideLayer.destroyChildren();
    }

    guides.vertical.forEach(g => {
        guideLayer.add(new Konva.Line({
            points: [g, -50000, g, 50000],
            stroke: '#ff00ff',
            strokeWidth: 1,
            dash: [4, 4]
        }));
    });

    guides.horizontal.forEach(g => {
        guideLayer.add(new Konva.Line({
            points: [-50000, g, 50000, g],
            stroke: '#ff00ff',
            strokeWidth: 1,
            dash: [4, 4]
        }));
    });

    guideLayer.moveToTop();
}

export function clearGuides(layer: Konva.Layer) {
    const guideLayer = layer.findOne('.guide-layer');
    if (guideLayer) guideLayer.destroy();
}