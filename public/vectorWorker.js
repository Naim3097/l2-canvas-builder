/**
 * Vector Worker for Offloading Heavy Boolean Operations
 * Handles Union, Subtract, Intersect operations using paper.js
 */

// Import paper.js in worker context
// Note: This is handled via importScripts in the main thread
let paper = null;

// Try to initialize paper.js
try {
    if (typeof importScripts !== 'undefined') {
        importScripts('https://cdnjs.cloudflare.com/ajax/libs/paper.js/0.12.18/paper-full.min.js');
    }
} catch (e) {
    console.error('Failed to load paper.js in worker:', e);
}

/**
 * Handle messages from the main thread
 */
self.onmessage = function(event) {
    const { id, type, payload } = event.data;

    try {
        let result;

        switch (type) {
            case 'booleanUnion':
                result = performUnion(payload);
                break;
            case 'booleanSubtract':
                result = performSubtract(payload);
                break;
            case 'booleanIntersect':
                result = performIntersect(payload);
                break;
            case 'booleanExclude':
                result = performExclude(payload);
                break;
            case 'simplifyPath':
                result = simplifyPath(payload);
                break;
            default:
                throw new Error(`Unknown operation: ${type}`);
        }

        self.postMessage({
            id,
            success: true,
            result
        });
    } catch (error) {
        self.postMessage({
            id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

/**
 * Perform union operation on two paths
 */
function performUnion(payload) {
    const { path1Data, path2Data } = payload;

    if (!paper) {
        throw new Error('paper.js not loaded in worker');
    }

    const scope = new paper.PaperScope();
    scope.setup();

    const path1 = scope.project.importSVG(createSVGFromPath(path1Data));
    const path2 = scope.project.importSVG(createSVGFromPath(path2Data));

    if (!path1 || !path2) {
        throw new Error('Failed to import paths');
    }

    const result = path1.unite(path2);
    return {
        pathData: result.pathData,
        bounds: result.bounds ? {
            x: result.bounds.x,
            y: result.bounds.y,
            width: result.bounds.width,
            height: result.bounds.height
        } : null
    };
}

/**
 * Perform subtract operation
 */
function performSubtract(payload) {
    const { basePath, subtractPath } = payload;

    if (!paper) {
        throw new Error('paper.js not loaded in worker');
    }

    const scope = new paper.PaperScope();
    scope.setup();

    const path1 = scope.project.importSVG(createSVGFromPath(basePath));
    const path2 = scope.project.importSVG(createSVGFromPath(subtractPath));

    if (!path1 || !path2) {
        throw new Error('Failed to import paths');
    }

    const result = path1.subtract(path2);
    return {
        pathData: result.pathData,
        bounds: result.bounds ? {
            x: result.bounds.x,
            y: result.bounds.y,
            width: result.bounds.width,
            height: result.bounds.height
        } : null
    };
}

/**
 * Perform intersect operation
 */
function performIntersect(payload) {
    const { path1Data, path2Data } = payload;

    if (!paper) {
        throw new Error('paper.js not loaded in worker');
    }

    const scope = new paper.PaperScope();
    scope.setup();

    const path1 = scope.project.importSVG(createSVGFromPath(path1Data));
    const path2 = scope.project.importSVG(createSVGFromPath(path2Data));

    if (!path1 || !path2) {
        throw new Error('Failed to import paths');
    }

    const result = path1.intersect(path2);
    return {
        pathData: result.pathData,
        bounds: result.bounds ? {
            x: result.bounds.x,
            y: result.bounds.y,
            width: result.bounds.width,
            height: result.bounds.height
        } : null
    };
}

/**
 * Perform exclude operation
 */
function performExclude(payload) {
    const { path1Data, path2Data } = payload;

    if (!paper) {
        throw new Error('paper.js not loaded in worker');
    }

    const scope = new paper.PaperScope();
    scope.setup();

    const path1 = scope.project.importSVG(createSVGFromPath(path1Data));
    const path2 = scope.project.importSVG(createSVGFromPath(path2Data));

    if (!path1 || !path2) {
        throw new Error('Failed to import paths');
    }

    const result = path1.exclude(path2);
    return {
        pathData: result.pathData,
        bounds: result.bounds ? {
            x: result.bounds.x,
            y: result.bounds.y,
            width: result.bounds.width,
            height: result.bounds.height
        } : null
    };
}

/**
 * Simplify a path
 */
function simplifyPath(payload) {
    const { pathData } = payload;

    if (!paper) {
        throw new Error('paper.js not loaded in worker');
    }

    const scope = new paper.PaperScope();
    scope.setup();

    const path = scope.project.importSVG(createSVGFromPath(pathData));

    if (!path) {
        throw new Error('Failed to import path');
    }

    path.simplify();

    return {
        pathData: path.pathData,
        bounds: path.bounds ? {
            x: path.bounds.x,
            y: path.bounds.y,
            width: path.bounds.width,
            height: path.bounds.height
        } : null
    };
}

/**
 * Helper: Create SVG string from path data
 */
function createSVGFromPath(pathData) {
    return `<svg><path d="${pathData}" fill="black"/></svg>`;
}
