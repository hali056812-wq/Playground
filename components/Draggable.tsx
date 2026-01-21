'use client';

import React, { useState, useRef, useEffect } from 'react';

interface DraggableProps {
    children: React.ReactNode;
    className?: string;
    initialPosition?: { x: number; y: number };
}

const Draggable: React.FC<DraggableProps> = ({ children, className, initialPosition = { x: 0, y: 0 } }) => {
    const [position, setPosition] = useState(initialPosition);
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<HTMLDivElement>(null);
    const offsetRef = useRef({ x: 0, y: 0 });

    const onPointerDown = (e: React.PointerEvent) => {
        if (dragRef.current) {
            setIsDragging(true);
            const rect = dragRef.current.getBoundingClientRect();
            offsetRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
            dragRef.current.setPointerCapture(e.pointerId);
            e.stopPropagation();
        }
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            // Calculate new position relative to the initial absolute placement
            // Since it's absolutely positioned, we can use screen delta or handle it via transforms
            // Let's use transforms for smoothness
            const newX = e.clientX - offsetRef.current.x;
            const newY = e.clientY - offsetRef.current.y;

            // We need to account for the parent container if we want absolute coords, 
            // but for a simple "floating" box, we can just use translate.
            // However, to make it feel natural, let's just update a state that translates it.

            // Actually, a simpler way for absolute elements is just updating left/top if we know the start.
            // But let's use translate to avoid layout thrashing.
        }
    };

    // Improved dragging logic using direct DOM updates or simple state and translate
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        startPos.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        e.stopPropagation();
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        setOffset({
            x: e.clientX - startPos.current.x,
            y: e.clientY - startPos.current.y
        });
        e.stopPropagation();
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        e.stopPropagation();
    };

    return (
        <div
            ref={dragRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'none', // Critical for pointer events on mobile
                userSelect: 'none',
            }}
            className={className}
        >
            {children}
        </div>
    );
};

export default Draggable;
