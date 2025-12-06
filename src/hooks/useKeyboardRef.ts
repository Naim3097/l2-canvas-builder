import { useEffect, useRef } from 'react';

export interface KeyboardState {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
    space: boolean;
}

export function useKeyboardRef() {
    const keys = useRef<KeyboardState>({
        shift: false,
        ctrl: false,
        alt: false,
        meta: false,
        space: false
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keys.current.shift = e.shiftKey;
            keys.current.ctrl = e.ctrlKey;
            keys.current.alt = e.altKey;
            keys.current.meta = e.metaKey;
            if (e.code === 'Space') keys.current.space = true;
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            keys.current.shift = e.shiftKey;
            keys.current.ctrl = e.ctrlKey;
            keys.current.alt = e.altKey;
            keys.current.meta = e.metaKey;
            if (e.code === 'Space') keys.current.space = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    return keys;
}