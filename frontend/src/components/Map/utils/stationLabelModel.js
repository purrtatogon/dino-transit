// Shared station label text and interchange rail metadata — used by
// StationLabelsLayer (map) and MetroStationSelect (trip planner).

export const GLYPH_THIN = '\u2009';

/** Interchange stations where label rails use specific line colours. */
export const INTERCHANGE_RAIL_CONFIG = {
    'Campo Grande': { leftLine: 'green', rightLine: 'yellow' },
    Alameda: { leftLine: 'green', rightLine: 'red' },
    Saldanha: { leftLine: 'yellow', rightLine: 'red', widthTrim: -14 },
    'Baixa-Chiado': { leftLine: 'blue', rightLine: 'green', widthTrim: -12 },
    'Marquês de Pombal': { leftLine: 'blue', rightLine: 'yellow', widthTrim: -16 },
    'São Sebastião': { leftLine: 'blue', rightLine: 'red', rightSymbol: '★', widthTrim: -16 }
};

/**
 * Station name as shown on map labels: ◆ for interchanges, ★ for terminals.
 * @param {{ name: string, lines: string[], isTerminal?: boolean }} station
 */
export const getStationLabelText = (station) => {
    const base = station.name;
    const config = INTERCHANGE_RAIL_CONFIG[station.name];
    if (config) {
        const rightGlyph = config.rightSymbol || '◆';
        return `◆${GLYPH_THIN}${base}${GLYPH_THIN}${rightGlyph}`;
    }
    if (station.lines.length > 1) {
        return `◆${GLYPH_THIN}${base}`;
    }
    if (station.isTerminal) {
        return `★${GLYPH_THIN}${base}`;
    }
    return base;
};

/**
 * Left / right metro line keys for coloured rails (planner dropdown).
 * @returns {{ leftLine: string, rightLine: string | null }}
 */
export const getStationRailSides = (station) => {
    const config = INTERCHANGE_RAIL_CONFIG[station.name];
    if (config) {
        return { leftLine: config.leftLine, rightLine: config.rightLine };
    }
    if (station.lines.length > 1) {
        return { leftLine: station.lines[0], rightLine: station.lines[1] };
    }
    return { leftLine: station.lines[0], rightLine: null };
};
