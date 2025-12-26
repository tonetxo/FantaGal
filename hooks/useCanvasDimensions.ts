import { useState, useEffect } from 'react';

/**
 * Hook reutilizable para manejar dimensiones de canvas con resize automático.
 * @param heightRatio - Ratio del alto respecto a la ventana (default 0.6 = 60%)
 */
export function useCanvasDimensions(heightRatio: number = 0.6) {
    const [dimensions, setDimensions] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 800,
        height: typeof window !== 'undefined' ? window.innerHeight * heightRatio : 480
    });

    useEffect(() => {
        const handleResize = () => {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight * heightRatio
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [heightRatio]);

    return dimensions;
}
