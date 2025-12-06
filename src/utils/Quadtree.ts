export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export class Quadtree<T extends Rect> {
    private objects: T[] = [];
    private nodes: Quadtree<T>[] = [];
    private level: number;
    private bounds: Rect;
    private maxObjects: number;
    private maxLevels: number;

    constructor(bounds: Rect, maxObjects = 10, maxLevels = 5, level = 0) {
        this.bounds = bounds;
        this.maxObjects = maxObjects;
        this.maxLevels = maxLevels;
        this.level = level;
    }

    public split() {
        const subWidth = this.bounds.width / 2;
        const subHeight = this.bounds.height / 2;
        const x = this.bounds.x;
        const y = this.bounds.y;

        this.nodes[0] = new Quadtree({
            x: x + subWidth,
            y: y,
            width: subWidth,
            height: subHeight
        }, this.maxObjects, this.maxLevels, this.level + 1);

        this.nodes[1] = new Quadtree({
            x: x,
            y: y,
            width: subWidth,
            height: subHeight
        }, this.maxObjects, this.maxLevels, this.level + 1);

        this.nodes[2] = new Quadtree({
            x: x,
            y: y + subHeight,
            width: subWidth,
            height: subHeight
        }, this.maxObjects, this.maxLevels, this.level + 1);

        this.nodes[3] = new Quadtree({
            x: x + subWidth,
            y: y + subHeight,
            width: subWidth,
            height: subHeight
        }, this.maxObjects, this.maxLevels, this.level + 1);
    }

    public getIndex(pRect: Rect): number {
        let index = -1;
        const verticalMidpoint = this.bounds.x + (this.bounds.width / 2);
        const horizontalMidpoint = this.bounds.y + (this.bounds.height / 2);

        const topQuadrant = (pRect.y < horizontalMidpoint) && (pRect.y + pRect.height < horizontalMidpoint);
        const bottomQuadrant = (pRect.y > horizontalMidpoint);

        if (pRect.x < verticalMidpoint && pRect.x + pRect.width < verticalMidpoint) {
            if (topQuadrant) {
                index = 1;
            } else if (bottomQuadrant) {
                index = 2;
            }
        } else if (pRect.x > verticalMidpoint) {
            if (topQuadrant) {
                index = 0;
            } else if (bottomQuadrant) {
                index = 3;
            }
        }

        return index;
    }

    public insert(pRect: T) {
        if (this.nodes.length) {
            const index = this.getIndex(pRect);

            if (index !== -1) {
                this.nodes[index].insert(pRect);
                return;
            }
        }

        this.objects.push(pRect);

        if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
            if (!this.nodes.length) {
                this.split();
            }

            let i = 0;
            while (i < this.objects.length) {
                const index = this.getIndex(this.objects[i]);
                if (index !== -1) {
                    this.nodes[index].insert(this.objects.splice(i, 1)[0]);
                } else {
                    i++;
                }
            }
        }
    }

    public retrieve(returnObjects: T[], pRect: Rect): T[] {
        const index = this.getIndex(pRect);
        if (index !== -1 && this.nodes.length) {
            this.nodes[index].retrieve(returnObjects, pRect);
        } else {
            // If pRect doesn't fit into a subnode, it might overlap multiple.
            // We need to check all nodes if we are doing a range query.
            // But getIndex returns -1 if it overlaps midpoints.
            // Standard Quadtree retrieve usually returns all objects from all nodes that overlap pRect.
            // My getIndex logic is for insertion (fits entirely).
            // For retrieval, we need intersection check.
            
            // Let's just return all objects from this node and subnodes if we can't determine specific index.
            // Or better, implement proper intersection check.
            
            // Simplified: Return all objects from this node
            returnObjects.push(...this.objects);
            
            // And if we have subnodes, we must check them all?
            // If pRect overlaps a subnode, we recurse.
            if (this.nodes.length) {
                this.nodes.forEach(node => {
                    // Check intersection
                    if (
                        pRect.x < node.bounds.x + node.bounds.width &&
                        pRect.x + pRect.width > node.bounds.x &&
                        pRect.y < node.bounds.y + node.bounds.height &&
                        pRect.y + pRect.height > node.bounds.y
                    ) {
                        node.retrieve(returnObjects, pRect);
                    }
                });
            }
        }

        return returnObjects;
    }

    public clear() {
        this.objects = [];
        this.nodes.forEach(node => node.clear());
        this.nodes = [];
    }
}
