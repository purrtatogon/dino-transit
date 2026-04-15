// All four Lisbon metro lines in one file.
// Each line has: key, color (hex), stations (ordered array), and sprite filenames.
// Coordinates sourced from Metropolitano de Lisboa /infoEstacao API.

// ── GREEN LINE ──────────────────────────────────────────
// Telheiras → Cais do Sodré (north to south)
export const GREEN_LINE = {
    key: 'green',
    color: '#00aaa6',
    stations: [
        { name: 'Telheiras', coords: [38.7604, -9.16606] },
        { name: 'Campo Grande', coords: [38.7599, -9.15794] },
        { name: 'Alvalade', coords: [38.7535, -9.14388] },
        { name: 'Roma', coords: [38.7485, -9.14135] },
        { name: 'Areeiro', coords: [38.7426, -9.13381] },
        { name: 'Alameda', coords: [38.7373, -9.13409] },
        { name: 'Arroios', coords: [38.7335, -9.13445] },
        { name: 'Anjos', coords: [38.7266, -9.13503] },
        { name: 'Intendente', coords: [38.7222, -9.13531] },
        { name: 'Martim Moniz', coords: [38.7168, -9.13575] },
        { name: 'Rossio', coords: [38.7138, -9.13896] },
        { name: 'Baixa-Chiado', coords: [38.7107, -9.13909] },
        { name: 'Cais do Sodré', coords: [38.7062, -9.14503] }
    ],
    sprites: {
        east: { walk: 'brachio_greenline_east_walk.gif', idle: 'brachio_greenline_east_idle.png' },
        west: { walk: 'brachio_greenline_west_walk.gif', idle: 'brachio_greenline_west_idle.png' },
        north: { walk: 'brachio_greenline_north_walk.gif', idle: 'brachio_greenline_north_idle.png' },
        south: { walk: 'brachio_greenline_south_walk.gif', idle: 'brachio_greenline_south_idle.png' }
    }
};

// ── RED LINE ────────────────────────────────────────────
// São Sebastião → Aeroporto (west to east)
export const RED_LINE = {
    key: 'red',
    color: '#ee2b74',
    stations: [
        { name: 'São Sebastião', coords: [38.7348, -9.15423] },
        { name: 'Saldanha', coords: [38.7353, -9.14558] },
        { name: 'Alameda', coords: [38.7373, -9.13409] },
        { name: 'Olaias', coords: [38.7392, -9.12366] },
        { name: 'Bela Vista', coords: [38.7477, -9.11855] },
        { name: 'Chelas', coords: [38.7553, -9.11414] },
        { name: 'Olivais', coords: [38.7613, -9.11204] },
        { name: 'Cabo Ruivo', coords: [38.7632, -9.10409] },
        { name: 'Oriente', coords: [38.7678, -9.09977] },
        { name: 'Moscavide', coords: [38.7748, -9.10266] },
        { name: 'Encarnação', coords: [38.7750, -9.11498] },
        { name: 'Aeroporto', coords: [38.7686, -9.12833] }
    ],
    sprites: {
        east: { walk: 'brachio_redline_east_walk.gif', idle: 'brachio_redline_east_idle.png' },
        west: { walk: 'brachio_redline_west_walk.gif', idle: 'brachio_redline_west_idle.png' },
        north: { walk: 'brachio_redline_north_walk.gif', idle: 'brachio_redline_north_idle.png' },
        south: { walk: 'brachio_redline_south_walk.gif', idle: 'brachio_redline_south_idle.png' }
    }
};

// ── BLUE LINE ───────────────────────────────────────────
// Reboleira → Santa Apolónia (west to east)
export const BLUE_LINE = {
    key: 'blue',
    color: '#4e84c4',
    stations: [
        { name: 'Reboleira', coords: [38.7522, -9.22414] },
        { name: 'Amadora Este', coords: [38.7584, -9.21917], labelAnchor: 'horizontal' },
        { name: 'Alfornelos', coords: [38.7606, -9.20471], labelAnchor: 'horizontal' },
        { name: 'Pontinha', coords: [38.7624, -9.19693], labelAnchor: 'horizontal' },
        { name: 'Carnide', coords: [38.7593, -9.19281] },
        { name: 'Colégio Militar/Luz', coords: [38.7533, -9.18866] },
        { name: 'Alto dos Moinhos', coords: [38.7496, -9.17995] },
        { name: 'Laranjeiras', coords: [38.7485, -9.17243] },
        { name: 'Jardim Zoológico', coords: [38.7422, -9.16872] },
        { name: 'Praça de Espanha', coords: [38.7377, -9.15845] },
        { name: 'São Sebastião', coords: [38.7348, -9.15423] },
        { name: 'Parque', coords: [38.7297, -9.15028] },
        { name: 'Marquês de Pombal', coords: [38.7249, -9.15081] },
        { name: 'Avenida', coords: [38.7201, -9.14582] },
        { name: 'Restauradores', coords: [38.7151, -9.14162] },
        { name: 'Baixa-Chiado', coords: [38.7107, -9.13909] },
        { name: 'Terreiro do Paço', coords: [38.7072, -9.13335] },
        { name: 'Santa Apolónia', coords: [38.7138, -9.12256] }
    ],
    sprites: {
        east: { walk: 'brachio_blueline_east_walk.gif', idle: 'brachio_blueline_east_idle.png' },
        west: { walk: 'brachio_blueline_west_walk.gif', idle: 'brachio_blueline_west_idle.png' },
        north: { walk: 'brachio_blueline_north_walk.gif', idle: 'brachio_blueline_north_idle.png' },
        south: { walk: 'brachio_blueline_south_walk.gif', idle: 'brachio_blueline_south_idle.png' }
    }
};

// ── YELLOW LINE ─────────────────────────────────────────
// Odivelas → Rato (north to south)
export const YELLOW_LINE = {
    key: 'yellow',
    color: '#fdb913',
    stations: [
        { name: 'Odivelas', coords: [38.7932, -9.17322] },
        { name: 'Senhor Roubado', coords: [38.7858, -9.17215] },
        { name: 'Ameixoeira', coords: [38.7799, -9.15999] },
        { name: 'Lumiar', coords: [38.7728, -9.15970] },
        { name: 'Quinta das Conchas', coords: [38.7671, -9.15546] },
        { name: 'Campo Grande', coords: [38.7599, -9.15794] },
        { name: 'Cidade Universitária', coords: [38.7519, -9.15863] },
        { name: 'Entre Campos', coords: [38.7479, -9.14856] },
        { name: 'Campo Pequeno', coords: [38.7414, -9.14703] },
        { name: 'Saldanha', coords: [38.7353, -9.14558] },
        { name: 'Picoas', coords: [38.7306, -9.14650] },
        { name: 'Marquês de Pombal', coords: [38.7249, -9.15081] },
        { name: 'Rato', coords: [38.7201, -9.15411] }
    ],
    sprites: {
        east: { walk: 'brachio_yellowline_east_walk.gif', idle: 'brachio_yellowline_east_idle.png' },
        west: { walk: 'brachio_yellowline_west_walk.gif', idle: 'brachio_yellowline_west_idle.png' },
        north: { walk: 'brachio_yellowline_north_walk.gif', idle: 'brachio_yellowline_north_idle.png' },
        south: { walk: 'brachio_yellowline_south_walk.gif', idle: 'brachio_yellowline_south_idle.png' }
    }
};

// All metro lines in one array for easy iteration
export const METRO_LINES = [GREEN_LINE, RED_LINE, BLUE_LINE, YELLOW_LINE];
