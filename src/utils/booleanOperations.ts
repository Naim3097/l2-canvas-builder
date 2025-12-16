
import { Shape } from '../types/shapes';

let paper: any;
let isInitialized = false;

// Worker Management
class WorkerManager {
    private worker: Worker | null = null;
    private workerReady: boolean = false;
    private pendingMessages: Map<string, { resolve: (value: any) => void, reject: (reason: any) => void }> = new Map();

    constructor() {
        if (typeof window !== 'undefined') {
            try {
                this.worker = new Worker('/vectorWorker.js');
                this.worker.onmessage = this.handleMessage.bind(this);
                this.worker.onerror = (e) => {
                    console.warn('Worker error, will use main thread:', e);
                    this.worker = null;
                    this.workerReady = false;
                };
                this.workerReady = true;
            } catch (e) {
                console.warn('Worker not available, will use main thread for boolean operations:', e);
                this.worker = null;
                this.workerReady = false;
            }
        }
    }

    private handleMessage(event: MessageEvent) {
        const { id, success, result, error } = event.data;
        if (this.pendingMessages.has(id)) {
            const { resolve, reject } = this.pendingMessages.get(id)!;
            if (success) {
                resolve(result);
            } else {
                reject(new Error(error));
            }
            this.pendingMessages.delete(id);
        }
    }

    public isAvailable(): boolean {
        return this.worker !== null && this.workerReady;
    }

    public execute(type: string, payload: any): Promise<any> {
        if (!this.worker || !this.workerReady) {
            return Promise.reject(new Error('Worker not available'));
        }
        const id = `${Date.now()}-${Math.random()}`;
        return new Promise((resolve, reject) => {
            this.pendingMessages.set(id, { resolve, reject });
            try {
                this.worker!.postMessage({ id, type, payload });
            } catch (e) {
                this.pendingMessages.delete(id);
                reject(e);
            }
        });
    }
}

const workerManager = new WorkerManager();

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

const createPaperPath = (shape: Shape): any => {
    if (!paper) return null;
    
    let item: any = null;
    if (shape.type === 'path' && shape.data) {
        item = new paper.Path(shape.data);
    } else if (shape.type === 'rect') {
        item = new paper.Path.Rectangle(new paper.Point(0, 0), new paper.Size((shape as any).width, (shape as any).height));
    } else if (shape.type === 'circle') {
        item = new paper.Path.Circle(new paper.Point((shape as any).radius, (shape as any).radius), (shape as any).radius);
    }
    
    if (item) {
         // Calculate center based on bounds, not just x/y which might be top-left
         const width = item.bounds.width;
         const height = item.bounds.height;
         item.position = new paper.Point(shape.x + width/2, shape.y + height/2);
         if (shape.rotation) item.rotate(shape.rotation);
    }
    return item;
};

export const performBooleanOperation = (
    shapes: Shape[], 
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

export const performBlobBrush = async (
    shapes: any[],
    pathData: string,
    strokeWidth: number,
    color: string,
    selectedIds: string[]
): Promise<any[] | null> => {
    try {
        return await workerManager.execute('blob-brush', {
            shapes,
            pathData,
            strokeWidth,
            color,
            selectedIds
        });
    } catch (error) {
        console.error('Blob brush error:', error);
        return null;
    }
};

export const performEraser = async (
    shapes: any[],
    pathData: string,
    strokeWidth: number
): Promise<any[] | null> => {
    try {
        return await workerManager.execute('eraser', {
            shapes,
            pathData,
            strokeWidth
        });
    } catch (error) {
        console.error('Eraser error:', error);
        return null;
    }
};

export const performTrim = async (
    shapes: any[],
    point: {x: number, y: number},
    tolerance: number = 5
): Promise<any[] | null> => {
    try {
        return await workerManager.execute('trim', {
            shapes,
            point,
            tolerance
        });
    } catch (error) {
        console.error('Trim error:', error);
        return null;
    }
};
