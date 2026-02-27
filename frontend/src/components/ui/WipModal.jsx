import React, { useState, useEffect, useRef } from 'react';

const WipModal = ({ type, onClose }) => {
    const [displayedText, setDisplayedText] = useState('');
    
    // Refs for WCAG focus management
    const closeBtnRef = useRef(null);
    const previousFocusRef = useRef(null);
    
    const content = {
        bus: {
            title: "Carris Bus Transit",
            text: "🚧 Route training in progress! The Triceratops fleet will be roaming the streets soon.",
            image: "🥚" 
        },
        train: {
            title: "CP Heavy Rail",
            text: "🚧 Heavy Rail integration offline. The Ankylosaurus is currently resting.",
            image: "🥚" 
        },
        air: {
            title: "Air Traffic",
            text: "🚧 Air Traffic Control offline. The Quetzalcoatlus is still hatching.",
            image: "🥚" 
        }
    };

    const current = content[type];

    useEffect(() => {
        previousFocusRef.current = document.activeElement;
        if (closeBtnRef.current) {
            closeBtnRef.current.focus();
        }
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (previousFocusRef.current) {
                previousFocusRef.current.focus();
            }
        };
    }, [onClose]);

    useEffect(() => {
        if (!current) return;
        
        setDisplayedText('');
        let i = 0;
        
        const typingInterval = setInterval(() => {
            i++;
            setDisplayedText(current.text.slice(0, i));
            if (i >= current.text.length) {
                clearInterval(typingInterval);
            }
        }, 30);

        return () => clearInterval(typingInterval);
    }, [type, current?.text]);

    if (!type) return null;

    return (
        <div className="retro-dialog-overlay" onClick={onClose}>
            <div 
                className="retro-dialog-box" 
                onClick={(e) => e.stopPropagation()}
                role="dialog" 
                aria-modal="true" 
                aria-labelledby="wip-dialog-title" 
                aria-describedby="wip-dialog-desc"
            >
                <button 
                    ref={closeBtnRef}
                    className="retro-close-btn" 
                    onClick={onClose}
                    aria-label="Close dialog" /* Critical for screen readers */
                >
                    X
                </button>
                <div className="retro-dialog-avatar" aria-hidden="true">
                    {/* aria-hidden="true" because the image/emoji is purely decorative here */}
                    {current.image.includes('/') ? (
                        <img src={current.image} alt="" className="pixel-dino-large" />
                    ) : (
                        <span style={{ fontSize: '40px' }}>{current.image}</span>
                    )}
                </div>
                <div className="retro-dialog-content">
                    {/* The IDs here match the aria-labelledby/describedby above */}
                    <h3 id="wip-dialog-title" style={{ margin: '0 0 10px 0', textTransform: 'uppercase' }}>
                        {current.title}
                    </h3>
                    <p id="wip-dialog-desc" style={{ margin: 0, minHeight: '40px' }}>
                        {displayedText}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default WipModal;