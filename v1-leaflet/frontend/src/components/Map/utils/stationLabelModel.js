// One source of truth for how station names render in both the map badges and the planner combobox.
const GLYPH_THIN = '\u2009';

export const INTERCHANGE_RAIL_CONFIG = {
    'Campo Grande': { leftLine: 'green', rightLine: 'yellow' },
    Alameda: { leftLine: 'green', rightLine: 'red' },
    Saldanha: { leftLine: 'yellow', rightLine: 'red', widthTrim: -14 },
    'Baixa-Chiado': { leftLine: 'blue', rightLine: 'green', widthTrim: -12 },
    'Marquês de Pombal': { leftLine: 'blue', rightLine: 'yellow', widthTrim: -16 },
    'São Sebastião': { leftLine: 'blue', rightLine: 'red', rightSymbol: '★', widthTrim: -16 }
};

/** String I show on map badges (diamonds/star prefix junk for interchanges / terminals). */
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

/** Planner dropdown rail colors derived from INTERCHANGE_RAIL_CONFIG. */
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
