import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import styles from './WipModal.module.css';

const WipModal = ({ type, onClose }) => {
    const [displayedText, setDisplayedText] = useState('');

    const closeBtnRef = useRef(null);
    const previousFocusRef = useRef(null);
    const dialogRef = useRef(null);
    
    const content = {
        bus: {
            title: "Carris Bus Transit",
            text: "🚧 Route training in progress! The Triceratops fleet will be roaming the streets soon.",
            image: "/assets/sprites/EggColour4.gif" 
        },
        train: {
            title: "CP Heavy Rail",
            text: "🚧 Heavy Rail integration offline. The Ankylosaurus is currently resting.",
            image: "/assets/sprites/EggColour4.gif" 
        },
        air: {
            title: "Air Traffic",
            text: "🚧 Air Traffic Control offline. The Quetzalcoatlus is still hatching.",
            image: "/assets/sprites/EggColour4.gif" 
        }
    };

    const current = content[type];

    useLayoutEffect(() => {
        previousFocusRef.current = document.activeElement;
        if (closeBtnRef.current) {
            closeBtnRef.current.focus();
        }
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }

            if (e.key !== 'Tab' || !dialogRef.current) {
                return;
            }

            const focusable = dialogRef.current.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );

            if (!focusable.length) {
                e.preventDefault();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;

            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
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

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            setDisplayedText(current.text);
            return undefined;
        }

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
        <div className={styles.retroDialogOverlay} onClick={onClose}>
            <div 
                ref={dialogRef}
                id="wip-status-dialog"
                className={styles.retroDialogBox}
                onClick={(e) => e.stopPropagation()}
                role="dialog" 
                aria-modal="true" 
                aria-labelledby="wip-dialog-title" 
                aria-describedby="wip-dialog-desc"
            >
                <button 
                    ref={closeBtnRef}
                    className={styles.retroCloseBtn}
                    type="button"
                    onClick={onClose}
                    aria-label="Close dialog"
                >
                    X
                </button>
                <div className={styles.retroDialogAvatar} aria-hidden="true">
                    {current.image.includes('/') ? (
                        <img src={current.image} alt="" className={styles.pixelDinoLarge} />
                    ) : (
                        <span className={styles.emojiFallback}>{current.image}</span>
                    )}
                </div>
                <div className={styles.retroDialogContent}>
                    <h3 id="wip-dialog-title" className={styles.dialogTitle}>
                        {current.title}
                    </h3>
                    <p id="wip-dialog-desc" className={styles.dialogDescription}>
                        {displayedText}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default WipModal;