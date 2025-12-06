let paper: any;
let isInitialized = false;

const initPaper = () => {
    if (typeof window === 'undefined') return;
    
    if (!paper) {
        paper = require('paper/dist/paper-core.js');
    }

    if (!isInitialized && paper) {
        paper.setup(new paper.Size(1000, 1000));
        isInitialized = true;
    }
};

const createPaperPath = (shape: any): any => {
    if (!paper) return null;
    
    let item: any = null;
    if (shape.type === 'path' && shape.data) {
        item = new paper.Path(shape.data);
    } else if (shape.type === 'rect') {
        item = new paper.Path.Rectangle(new paper.Point(0, 0), new paper.Size(shape.width, shape.height));
    } else if (shape.type === 'circle') {
        item = new paper.Path.Circle(new paper.Point(shape.radius, shape.radius), shape.radius);
    }
    
    if (item) {
         item.position = new paper.Point(shape.x + item.bounds.width/2, shape.y + item.bounds.height/2);
         if (shape.rotation) item.rotate(shape.rotation);
    }
    return item;
};

export const performBooleanOperation = (
    shapes: any[], 
    operation: 'unite' | 'subtract' | 'intersect' | 'exclude'
): { data: string, x: number, y: number, width: number, height: number } | null => {
    initPaper();
    if (!paper || shapes.length < 2) return null;

    const items = shapes.map(s => createPaperPath(s)).filter(i => i);
    if (items.length < 2) {
        items.forEach(i => i.remove());
        return null;
    }

    let result = items[0];

    for (let i = 1; i < items.length; i++) {
        const nextItem = items[i];
        let tempResult;

        switch (operation) {
            case 'unite':
                tempResult = result.unite(nextItem);
                break;
            case 'subtract':
                // Subtract current item (front) from result (back)
                tempResult = result.subtract(nextItem);
                break;
            case 'intersect':
                tempResult = result.intersect(nextItem);
                break;
            case 'exclude':
                tempResult = result.exclude(nextItem);
                break;
            default:
                tempResult = result;
        }
        
        // Remove old result if it wasn't one of the original items (except the first one which we started with)
        if (result !== items[0]) result.remove();
        result = tempResult;
    }

    // Cleanup original items
    items.forEach(item => item.remove());

    const bounds = result.bounds;
    const x = bounds.x;
    const y = bounds.y;
    const width = bounds.width;
    const height = bounds.height;

    result.translate(new paper.Point(-x, -y));
    const resultData = result.pathData;

    result.remove();

    return { data: resultData, x, y, width, height };
};

export const createCompoundPath = (shapes: any[]): { data: string, x: number, y: number, width: number, height: number } | null => {
    initPaper();
    if (!paper) return null;
    
    const items = shapes.map(s => createPaperPath(s)).filter(i => i);
    if (items.length < 2) return null;
    
    const compound = new paper.CompoundPath({
        children: items,
        fillRule: 'evenodd'
    });
    
    const bounds = compound.bounds;
    const x = bounds.x;
    const y = bounds.y;
    const width = bounds.width;
    const height = bounds.height;
    
    compound.translate(new paper.Point(-x, -y));
    const data = compound.pathData;
    
    compound.remove();
    
    return { data, x, y, width, height };
};

export const getShapePathData = (shape: any, relativeTo?: {x: number, y: number}): string | null => {
    initPaper();
    if (!paper) return null;
    
    const item = createPaperPath(shape);
    if (!item) return null;
    
    if (relativeTo) {
        item.translate(new paper.Point(-relativeTo.x, -relativeTo.y));
    }
    
    const data = item.pathData;
    item.remove();
    return data;
};
