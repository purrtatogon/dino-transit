import React, {
    forwardRef,
    useCallback,
    useEffect,
    useId,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState
} from 'react';
import s from './MetroStationSelect.module.css';
import g from '@styles/global.module.css';
import { getStationLabelText, getStationRailSides } from './utils/stationLabelModel';

const railClassForLine = (lineKey) => {
    const mod =
        {
            green: s.railGreen,
            red: s.railRed,
            blue: s.railBlue,
            yellow: s.railYellow
        }[lineKey] || s.railGreen;
    return `${s.rail} ${mod}`;
};

const StationOptionPresentation = ({ station }) => {
    const { leftLine, rightLine } = getStationRailSides(station);

    return (
        <div className={s.stationLineBadge}>
            <span className={railClassForLine(leftLine)} aria-hidden="true" />
            <span className={s.optionLabel}>{getStationLabelText(station)}</span>
            {rightLine ? (
                <span className={railClassForLine(rightLine)} aria-hidden="true" />
            ) : null}
        </div>
    );
};

const MetroStationSelect = forwardRef(function MetroStationSelect(
    { id, labelId, stations, value, onChange, placeholder },
    ref
) {
    const listboxId = useId();
    const wrapRef = useRef(null);
    const buttonRef = useRef(null);
    const listRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    useImperativeHandle(ref, () => buttonRef.current, []);

    const selectedStation = stations.find((st) => st.name === value) || null;

    const close = useCallback(() => {
        setOpen(false);
        buttonRef.current?.focus();
    }, []);

    const openList = useCallback(() => {
        const idx = stations.findIndex((st) => st.name === value);
        setActiveIndex(idx < 0 ? 0 : idx);
        setOpen(true);
    }, [stations, value]);

    const choose = useCallback(
        (name) => {
            onChange(name);
            close();
        },
        [onChange, close]
    );

    useEffect(() => {
        if (!open) return undefined;
        const onDocDown = (event) => {
            if (!wrapRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocDown);
        return () => document.removeEventListener('mousedown', onDocDown);
    }, [open]);

    useLayoutEffect(() => {
        if (!open || !listRef.current) return;
        listRef.current.focus();
    }, [open]);

    useLayoutEffect(() => {
        if (!open || !listRef.current) return;
        const activeEl = listRef.current.querySelector(`[data-option-index="${activeIndex}"]`);
        activeEl?.scrollIntoView({ block: 'nearest' });
    }, [open, activeIndex]);

    const onButtonKeyDown = (event) => {
        if (event.key === 'Escape') {
            if (open) {
                event.stopPropagation();
                close();
            }
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) {
                openList();
                return;
            }
            setActiveIndex((i) => Math.min(i + 1, stations.length - 1));
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) {
                openList();
                return;
            }
            setActiveIndex((i) => Math.max(i - 1, 0));
        }
        if (event.key === 'Enter' || event.key === ' ') {
            if (!open) {
                event.preventDefault();
                openList();
                return;
            }
            event.preventDefault();
            const st = stations[activeIndex];
            if (st) choose(st.name);
        }
    };

    const onListKeyDown = (event) => {
        if (event.key === 'Tab') {
            setOpen(false);
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, stations.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const st = stations[activeIndex];
            if (st) choose(st.name);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    };

    return (
        <div className={s.wrap} ref={wrapRef}>
            <button
                ref={buttonRef}
                type="button"
                id={id}
                className={`${s.trigger} ${g.focusVisible}`}
                role="combobox"
                aria-labelledby={labelId}
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listboxId}
                onClick={() => (open ? close() : openList())}
                onKeyDown={onButtonKeyDown}
            >
                {selectedStation ? (
                    <span className={s.triggerValue}>
                        <StationOptionPresentation station={selectedStation} />
                    </span>
                ) : (
                    <span className={s.triggerPlaceholder}>{placeholder}</span>
                )}
                <span className={s.triggerChevron} aria-hidden="true">
                    {open ? '▴' : '▾'}
                </span>
            </button>
            {open ? (
                <ul
                    ref={listRef}
                    id={listboxId}
                    className={s.listbox}
                    role="listbox"
                    tabIndex={-1}
                    aria-labelledby={labelId}
                    onKeyDown={onListKeyDown}
                >
                    {stations.map((station, index) => {
                        const selected = station.name === value;
                        const active = index === activeIndex;
                        return (
                            <li
                                key={station.name}
                                role="option"
                                aria-selected={selected}
                                data-option-index={index}
                                className={s.option}
                                onMouseEnter={() => setActiveIndex(index)}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    choose(station.name);
                                }}
                            >
                                <div
                                    className={`${s.optionRow} ${selected ? s.optionRowSelected : ''} ${
                                        active ? s.optionRowActive : ''
                                    }`}
                                >
                                    <StationOptionPresentation station={station} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );
});

MetroStationSelect.displayName = 'MetroStationSelect';

export default MetroStationSelect;
