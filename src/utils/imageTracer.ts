import ImageTracer from 'imagetracerjs';

export const traceImage = (imageUrl: string, options: any = {}): Promise<string> => {
    return new Promise((resolve, reject) => {
        ImageTracer.imageToSVG(imageUrl, (svgstr: string) => {
            resolve(svgstr);
        }, options);
    });
};

export const extractPathFromSVG = (svgString: string): string | null => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const paths = doc.querySelectorAll('path');
    
    // Simple implementation: join all path data
    // A better implementation would return multiple paths or a compound path
    let d = '';
    paths.forEach(p => {
        d += p.getAttribute('d') + ' ';
    });
    
    return d.trim() || null;
};
