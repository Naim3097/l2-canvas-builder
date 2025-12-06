import { Shape, RectShape, PathShape, TextShape, GroupShape, ArtboardShape, ImageShape, InstanceShape } from '@/types/shapes';

export function exportToSVG(shapes: Shape[], width: number, height: number, components: Record<string, Shape> = {}): string {
    const processShape = (shape: Shape): string => {
        if (shape.visible === false) return '';
        
        // Common attributes
        const opacity = shape.opacity ?? 1;
        const transform = `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation || 0})`;
        const commonAttrs = `opacity="${opacity}" transform="${transform}"`;
        
        switch (shape.type) {
            case 'rect': {
                const s = shape as RectShape;
                return `<rect width="${s.width}" height="${s.height}" fill="${s.fill}" stroke="${s.stroke || 'none'}" stroke-width="${s.strokeWidth || 0}" rx="${s.cornerRadius || 0}" ${commonAttrs} />`;
            }
            case 'path': {
                const s = shape as PathShape;
                return `<path d="${s.data || ''}" fill="${s.fill || 'none'}" stroke="${s.stroke || 'black'}" stroke-width="${s.strokeWidth || 1}" ${commonAttrs} />`;
            }
            case 'text': {
                const s = shape as TextShape;
                // SVG text positioning is baseline-based usually, but Konva/Canvas is top-left.
                // We might need dy adjustment. For now, simple text.
                return `<text font-family="${s.fontFamily}" font-size="${s.fontSize}" font-weight="${s.fontWeight}" fill="${s.fill}" ${commonAttrs} dy="0.8em">${s.text}</text>`;
            }
            case 'image': {
                const s = shape as ImageShape;
                return `<image href="${s.src}" width="${s.width}" height="${s.height}" ${commonAttrs} />`;
            }
            case 'group':
            case 'artboard': {
                const s = shape as GroupShape | ArtboardShape;
                const childrenSvg = s.children?.map(processShape).join('') || '';
                // Artboard usually clips.
                // For simplicity, just group for now.
                return `<g ${commonAttrs}>${childrenSvg}</g>`;
            }
            case 'instance': {
                const s = shape as InstanceShape;
                const component = components[s.componentId];
                if (!component) return '';
                
                // Render the component content, but we need to be careful about recursion and transforms.
                // The component definition usually has x=0, y=0.
                // We can treat the component as a group's children.
                
                // If component is a group, we render its children.
                // If component is a single shape, we render it.
                
                let content = '';
                if (component.type === 'group' || component.type === 'artboard') {
                     content = (component as GroupShape).children?.map(processShape).join('') || '';
                } else {
                     // It's a single shape, but we need to ensure we don't apply the component's own x/y if it's meant to be 0,0 relative to instance
                     // Actually, component definition might have x/y, but usually for components we treat them as relative.
                     // Let's assume component definition is the "content".
                     // To avoid infinite recursion if we just passed component to processShape (if it was an instance), 
                     // but here component is the source.
                     
                     // We can just call processShape on the component, but override its transform?
                     // No, processShape applies transform.
                     
                     // Let's manually process the component shape but ignore its top-level transform if we want it at 0,0 of the instance?
                     // Or maybe the component definition *is* the content at 0,0.
                     
                     content = processShape({ ...component, x: 0, y: 0, rotation: 0, visible: true });
                }
                
                return `<g ${commonAttrs}>${content}</g>`;
            }
            default:
                return '';
        }
    };

    const content = shapes.map(processShape).join('\n');
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">\n${content}\n</svg>`;
}
