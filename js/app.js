const h = React.createElement;
const { useState, useEffect, useRef } = React;

const geocodeQueue = { lastCall: 0 };
const geocodePlace = async (place) => {
    const now = Date.now();
    const timeSinceLast = now - geocodeQueue.lastCall;
    if (timeSinceLast < 1100) {
        await new Promise(resolve => setTimeout(resolve, 1100 - timeSinceLast));
    }
    geocodeQueue.lastCall = Date.now();
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}&limit=1`);
        const data = await response.json();
        if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch (error) { console.error('Geocoding error:', error); }
    return null;
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

// ── SVG icon system ──────────────────────────────────────────────────────────
const Icon = ({ name, size = 16, color = 'currentColor', strokeWidth = 1.5 }) => {
    const paths = {
        // motivo icons
        placer:   h('path', {strokeLinecap:'round', strokeLinejoin:'round', d:'M12 3c-1.2 5.4-5 7.8-5 12a5 5 0 0010 0c0-4.2-3.8-6.6-5-12z M10 17a2 2 0 004 0'}),
        negocios: h('g', null,
                    h('rect', {x:'2', y:'7', width:'20', height:'14', rx:'2'}),
                    h('path', {strokeLinecap:'round', d:'M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M12 12v3M9 12h6'})
                  ),
        evento:   h('g', null,
                    h('path', {strokeLinecap:'round', strokeLinejoin:'round', d:'M8 7V3M16 7V3M3 11h18M5 5h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z'})
                  ),
        familia:  h('g', null,
                    h('circle', {cx:'8', cy:'7', r:'2'}),
                    h('circle', {cx:'16', cy:'7', r:'2'}),
                    h('path', {strokeLinecap:'round', strokeLinejoin:'round', d:'M3 21v-2a4 4 0 014-4h2M15 15h2a4 4 0 014 4v2M12 11c-1.1 0-2 .9-2 2v8'})
                  ),
        estudio:  h('g', null,
                    h('path', {strokeLinecap:'round', strokeLinejoin:'round', d:'M12 14l9-5-9-5-9 5 9 5z'}),
                    h('path', {strokeLinecap:'round', strokeLinejoin:'round', d:'M12 14l6.16-3.422A12.08 12.08 0 0122 17.5c0 2.485-3.582 4.5-8 4.5s-8-2.015-8-4.5a12.08 12.08 0 013.84-6.922L12 14z'})
                  ),
        otro:     h('path', {strokeLinecap:'round', strokeLinejoin:'round', d:'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'}),
        // stat icons
        clock:    h('g', null, h('circle', {cx:'12', cy:'12', r:'9'}), h('path', {strokeLinecap:'round', d:'M12 7v5l3 3'})),
        pin:      h('g', null, h('path', {strokeLinecap:'round', strokeLinejoin:'round', d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'}), h('circle', {cx:'12', cy:'9', r:'2.5'})),
        globe:    h('g', null, h('circle', {cx:'12', cy:'12', r:'9'}), h('path', {strokeLinecap:'round', d:'M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20'})),
        plane:    h('path', {strokeLinecap:'round', strokeLinejoin:'round', d:'M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z'}),
        users:    h('g', null, h('path', {strokeLinecap:'round', strokeLinejoin:'round', d:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2'}), h('circle', {cx:'9', cy:'7', r:'4'}), h('path', {strokeLinecap:'round', d:'M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75'})),
        edit:     h('g', null, h('path', {strokeLinecap:'round', strokeLinejoin:'round', d:'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7'}), h('path', {strokeLinecap:'round', strokeLinejoin:'round', d:'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z'})),
        trash:    h('g', null, h('polyline', {points:'3 6 5 6 21 6'}), h('path', {strokeLinecap:'round', strokeLinejoin:'round', d:'M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2'})),
        chevronL: h('polyline', {points:'15 18 9 12 15 6', strokeLinecap:'round', strokeLinejoin:'round'}),
        chevronR: h('polyline', {points:'9 18 15 12 9 6', strokeLinecap:'round', strokeLinejoin:'round'}),
        close:    h('g', null, h('line', {x1:'18', y1:'6', x2:'6', y2:'18', strokeLinecap:'round'}), h('line', {x1:'6', y1:'6', x2:'18', y2:'18', strokeLinecap:'round'})),
        calendar: h('g', null, h('rect', {x:'3', y:'4', width:'18', height:'18', rx:'2'}), h('path', {strokeLinecap:'round', d:'M16 2v4M8 2v4M3 10h18'})),
        empty:    h('g', null, h('circle', {cx:'12', cy:'12', r:'9'}), h('path', {strokeLinecap:'round', d:'M8 12h8M12 8v8'})),
    };
    return h('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        width: size, height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: color,
        strokeWidth: strokeWidth,
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
    }, paths[name] || null);
};

const getMotivoIcon = (motivo) => {
    const map = { placer: 'placer', negocios: 'negocios', evento: 'evento', familia: 'familia', estudio: 'estudio', otro: 'otro' };
    return map[motivo] || 'plane';
};

const getMotivoLabel = (motivo) => {
    const labels = { placer: 'Placer', negocios: 'Negocios', evento: 'Evento', familia: 'Familia', estudio: 'Estudio', otro: 'Otro' };
    return labels[motivo] || motivo || 'Viaje';
};

// kept for any legacy callers in Timeline / Dashboard
const getMotivoEmoji = (motivo) => {
    const emojis = { 'placer': '🏖️', 'negocios': '💼', 'evento': '🎉', 'familia': '👨‍👩‍👧‍👦', 'estudio': '📚', 'otro': '🌟' };
    return emojis[motivo] || '✈️';
};

const compressImage = (dataUrl, maxWidth = 800, quality = 0.6) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
};

// ── Supabase Storage helpers ──────────────────────────────────────────────────

const dataUrlToBlob = (dataUrl) => {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: mime });
};

const uploadPhotoToStorage = async (userId, dataUrl) => {
    try {
        if (!userId || !dataUrl || !dataUrl.startsWith('data:')) return null;
        const blob = dataUrlToBlob(dataUrl);
        const path = userId + '/' + crypto.randomUUID() + '.jpg';
        const { error } = await window.supabase.storage
            .from('trip-photos')
            .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (error) { console.error('Photo upload error:', error.message); return null; }
        const { data } = window.supabase.storage.from('trip-photos').getPublicUrl(path);
        return data.publicUrl;
    } catch(e) {
        console.error('Photo upload exception:', e.message);
        return null;
    }
};

const SUPABASE_STORAGE_BASE = 'https://eohzflignqhoasklfjod.supabase.co/storage/v1/object/public/trip-photos/';

const deletePhotosFromStorage = async (trip) => {
    const paths = [];
    (trip.destinos || []).forEach(d => {
        if (d.foto && d.foto.startsWith(SUPABASE_STORAGE_BASE))
            paths.push(d.foto.replace(SUPABASE_STORAGE_BASE, ''));
    });
    (trip.personas || []).forEach(p => {
        if (p.foto && p.foto.startsWith(SUPABASE_STORAGE_BASE))
            paths.push(p.foto.replace(SUPABASE_STORAGE_BASE, ''));
    });
    if (paths.length === 0) return;
    const { error } = await window.supabase.storage.from('trip-photos').remove(paths);
    if (error) console.error('Photo deletion error:', error);
};

// ─────────────────────────────────────────────────────────────────────────────

// Format destinations array into "Paris → London → Rome" subtitle
const formatDestinations = (destinos) => {
    if (!destinos || destinos.length === 0) return '';
    return destinos.map(d => d.lugar.split(',')[0].trim()).join(' \u2192 ');
};

// Get the display name (trip_name, or fall back to joined destinations)
const getTripName = (trip) => {
    return (trip.trip_name || '').trim() || formatDestinations(trip.destinos) || 'Viaje sin nombre';
};

const formatDateRange = (startDate, endDate) => {
    if (!startDate) return '';
    const opts = { day: 'numeric', month: 'short' };
    const optsYear = { day: 'numeric', month: 'short', year: 'numeric' };
    const s = new Date(startDate + 'T12:00:00');
    if (!endDate || endDate === startDate) return s.toLocaleDateString('es-ES', optsYear);
    const e = new Date(endDate + 'T12:00:00');
    if (s.getFullYear() === e.getFullYear()) {
        return s.toLocaleDateString('es-ES', opts) + ' - ' + e.toLocaleDateString('es-ES', optsYear);
    }
    return s.toLocaleDateString('es-ES', optsYear) + ' - ' + e.toLocaleDateString('es-ES', optsYear);
};


const ToastContainer = ({ toasts }) => (
    h('div', {className: 'toast-container'},
        toasts.map(t => (
            h('div', {key: t.id, className: `toast toast-${t.type}`}, t.message)
        ))
    )
);

const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, confirmText, cancelText, danger }) => {
    if (!isOpen) return null;
    return (
        h('div', {className: 'modal-overlay', onClick: onCancel},
            h('div', {style: {background: 'white', borderRadius: '16px', padding: '2rem', maxWidth: '450px', width: '100%'}, onClick: e => e.stopPropagation()},
                h('h3', {style: {marginBottom: '1rem', color: 'var(--secondary)'}}, title),
                h('p', {style: {marginBottom: '1.5rem', color: '#666', lineHeight: '1.5'}}, message),
                h('div', {style: {display: 'flex', gap: '1rem', justifyContent: 'flex-end'}},
                    h('button', {className: 'btn-edit', onClick: onCancel}, cancelText || 'Cancelar'),
                    h('button', {className: 'btn-primary', style: danger ? {background: '#dc3545'} : {}, onClick: onConfirm}, confirmText || 'Confirmar')
                )
            )
        )
    );
};

const parseCSVField = (text) => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (inQuotes && text[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (char === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    fields.push(current.trim());
    return fields;
};

const parseCSVRows = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return { trips: [], errors: [{ row: 0, message: 'El archivo esta vacio o no tiene datos' }] };
    const errors = [];
    const headerFields = parseCSVField(lines[0]);
    const headerLower = headerFields.map(h => h.toLowerCase().replace(/\s+/g, ''));
    const colMap = {};
    headerLower.forEach((h, i) => { colMap[h] = i; });
    const getCol = (row, ...names) => {
        for (const name of names) {
            if (colMap[name] !== undefined && row[colMap[name]] !== undefined) return row[colMap[name]].trim();
        }
        return '';
    };
    const rawEntries = [];
    for (let i = 1; i < lines.length; i++) {
        try {
            const values = parseCSVField(lines[i]);
            if (values.length < 4) { errors.push({ row: i + 1, message: 'Muy pocas columnas' }); continue; }
            const tripName = getCol(values, 'tripname', 'trip_name', 'nombre') || '';
            const tripId = getCol(values, 'tripid') || null;
            const fechaInicio = getCol(values, 'tripfechainicio', 'fechainicio');
            const fechaFinal = getCol(values, 'tripfechafinal', 'fechafinal') || fechaInicio;
            const motivo = getCol(values, 'motivo') || 'placer';
            const personas = getCol(values, 'personas');
            const notas = getCol(values, 'notas') || '';
            const lugar = getCol(values, 'lugar');
            const destFechaInicio = getCol(values, 'destfechainicio', 'destinofechainicio') || fechaInicio;
            const destFechaFinal = getCol(values, 'destfechafinal', 'destinofechafinal') || fechaFinal;
            if (!fechaInicio) { errors.push({ row: i + 1, message: 'Falta fecha de inicio' }); continue; }
            if (!lugar) { errors.push({ row: i + 1, message: 'Falta lugar/destino' }); continue; }
            rawEntries.push({ tripName, tripId, fechaInicio, fechaFinal, motivo, personas: personas ? personas.split(';').map(n => ({ nombre: n.trim(), foto: null })).filter(p => p.nombre) : [], notas, lugar, destFechaInicio, destFechaFinal, sourceRow: i + 1 });
        } catch (e) { errors.push({ row: i + 1, message: 'Error de parseo: ' + e.message }); }
    }
    const tripMap = new Map();
    rawEntries.forEach(entry => {
        const groupKey = entry.tripId || entry.fechaInicio;
        if (!tripMap.has(groupKey)) {
            tripMap.set(groupKey, { id: Date.now() + Math.floor(Math.random() * 10000), trip_name: entry.tripName || '', fechaInicio: entry.fechaInicio, fechaFinal: entry.fechaFinal, motivo: entry.motivo, personas: entry.personas, destinos: [], notas: entry.notas, createdAt: new Date().toISOString() });
        }
        const trip = tripMap.get(groupKey);
        trip.destinos.push({ lugar: entry.lugar, fechaInicio: entry.destFechaInicio, fechaFinal: entry.destFechaFinal, foto: null, coordinates: null });
        if (entry.notas && trip.notas && !trip.notas.includes(entry.notas)) { trip.notas = trip.notas + '; ' + entry.notas; }
        else if (entry.notas && !trip.notas) { trip.notas = entry.notas; }
    });
    return { trips: [...tripMap.values()], errors };
};

const geocodeTrips = async (trips, onProgress) => {
    const errors = [];
    let geocoded = 0;
    const totalDestinations = trips.reduce((sum, t) => sum + t.destinos.length, 0);
    for (const trip of trips) {
        for (const destino of trip.destinos) {
            if (!destino.coordinates) {
                try {
                    destino.coordinates = await geocodePlace(destino.lugar);
                    if (!destino.coordinates) errors.push({ lugar: destino.lugar, message: 'No se encontraron coordenadas' });
                } catch (e) { errors.push({ lugar: destino.lugar, message: e.message }); }
            }
            geocoded++;
            if (onProgress) onProgress(geocoded, totalDestinations);
        }
    }
    return { trips, errors };
};

const detectDuplicates = (newTrips, existingTrips) => {
    return newTrips.map(newTrip => {
        const isDuplicate = existingTrips.some(existing =>
            existing.fechaInicio === newTrip.fechaInicio &&
            existing.fechaFinal === newTrip.fechaFinal &&
            existing.destinos.length === newTrip.destinos.length &&
            existing.destinos.every((d, i) => d.lugar === newTrip.destinos[i]?.lugar)
        );
        return { ...newTrip, _isDuplicate: isDuplicate };
    });
};

const ProfileView = ({ profile, onUpdateProfile }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(profile || { nombre: '', ubicacion: '', emoji: '🌍' });

    const handleSubmit = (e) => {
        e.preventDefault();
        onUpdateProfile(formData);
        setIsEditing(false);
    };

    if (!profile && !isEditing) {
        return (
            h('div', {className: 'profile-section'},
                h('div', {className: 'empty-state'},
                    h('div', {className: 'empty-state-icon'}, '👤'),
                    h('div', {className: 'empty-state-text'}, 'Crea tu perfil para comenzar'),
                    h('button', {className: 'btn-primary', onClick: () => setIsEditing(true), style: {marginTop: '1rem'}}, 'Crear Perfil')
                )
            )
        );
    }

    if (isEditing) {
        return (
            h('div', {className: 'profile-section'},
                h('h2', {className: 'form-title'}, 'Tu Perfil'),
                h('form', {onSubmit: handleSubmit},
                    h('div', {className: 'form-grid'},
                        h('div', {className: 'form-group'}, h('label', null, 'Nombre'), h('input', {type: 'text', value: formData.nombre, onChange: (e) => setFormData({...formData, nombre: e.target.value}), required: true})),
                        h('div', {className: 'form-group'}, h('label', null, 'Ciudad de origen'), h('input', {type: 'text', value: formData.ubicacion, onChange: (e) => setFormData({...formData, ubicacion: e.target.value}), placeholder: 'Buenos Aires, Argentina', required: true})),
                        h('div', {className: 'form-group'}, h('label', null, 'Emoji favorito'), h('input', {type: 'text', value: formData.emoji, onChange: (e) => setFormData({...formData, emoji: e.target.value}), maxLength: '2'}))
                    ),
                    h('div', {style: {display: 'flex', gap: '1rem', marginTop: '1rem'}},
                        h('button', {type: 'submit', className: 'btn-primary'}, 'Guardar'),
                        profile && h('button', {type: 'button', className: 'btn-secondary', onClick: () => setIsEditing(false)}, 'Cancelar')
                    )
                )
            )
        );
    }

    return (
        h('div', {className: 'profile-section'},
            h('div', {className: 'profile-header'},
                h('div', {className: 'profile-avatar'}, profile.emoji),
                h('div', {className: 'profile-info'},
                    h('h2', null, profile.nombre),
                    h('div', null, '📍 ', profile.ubicacion)
                ),
                h('button', {className: 'btn-secondary', onClick: () => setIsEditing(true)}, 'Editar Perfil')
            )
        )
    );
};

const TripCard = ({ trip, onClick, showEditButton, onEdit, onDelete }) => {
    const firstDestino = trip.destinos[0];
    const duracion = trip.fechaFinal ? Math.ceil((new Date(trip.fechaFinal) - new Date(trip.fechaInicio)) / (1000 * 60 * 60 * 24)) : 1;

    return (
        h('div', {className: 'trip-list-card'},
            h('div', {onClick: onClick},
                firstDestino?.foto && h('img', {src: firstDestino.foto, alt: firstDestino.lugar, className: 'trip-list-card-image'}),
                h('div', {className: 'trip-list-card-content'},
                    h('h3', {className: 'trip-list-card-title'}, getTripName(trip)),
                    trip.destinos.length > 0 && h('div', {style: {fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem'}}, formatDestinations(trip.destinos)),
                    h('div', {className: 'trip-list-card-date'}, formatDateRange(trip.fechaInicio, trip.fechaFinal)),
                    h('div', {className: 'trip-list-card-meta'},
                        h('div', {className: 'trip-list-card-meta-item'}, h('span', null, getMotivoEmoji(trip.motivo)), h('span', null, trip.motivo)),
                        h('div', {className: 'trip-list-card-meta-item'}, h('span', null, '⏱️'), h('span', null, duracion, 'd')),
                        h('div', {className: 'trip-list-card-meta-item'}, h('span', null, '📍'), h('span', null, trip.destinos.length)),
                        trip.personas.length > 0 && h('div', {className: 'trip-list-card-meta-item'}, h('span', null, '👥'), h('span', null, trip.personas.length))
                    )
                )
            ),
            showEditButton && (
                h('div', {style: {padding: '0 1.5rem 1.5rem', display: 'flex', gap: '0.5rem'}},
                    h('button', {className: 'btn-edit', onClick: (e) => { e.stopPropagation(); onEdit(trip); }, style: {flex: 1}}, '✏️ Editar'),
                    onDelete && h('button', {className: 'btn-edit', onClick: (e) => { e.stopPropagation(); onDelete(trip.id); }, style: {color: '#dc3545', borderColor: '#dc3545'}}, '🗑️ Eliminar')
                )
            )
        )
    );
};

const MapView = ({ trips, homeCoords, onTripClick }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;
        const map = L.map(mapRef.current).setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
        mapInstanceRef.current = map;
        return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
    }, []);

    useEffect(() => {
        if (!mapInstanceRef.current) return;
        mapInstanceRef.current.eachLayer(layer => { if (layer instanceof L.Marker) mapInstanceRef.current.removeLayer(layer); });
        const bounds = [];

        if (homeCoords) {
            const homeMarker = L.marker([homeCoords.lat, homeCoords.lng], {
                icon: L.divIcon({
                    className: '',
                    html: '<div style="width:40px;height:40px;border-radius:50%;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3);background-color:#2a5a4a;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1.2rem;">🏠</div>',
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                })
            }).addTo(mapInstanceRef.current);
            homeMarker.bindPopup('<b>🏠 Tu casa</b>');
            bounds.push([homeCoords.lat, homeCoords.lng]);
        }

        trips.forEach(trip => {
            const firstDestino = trip.destinos[0];
            if (firstDestino?.coordinates) {
                const markerHtml = `<div style="width:40px;height:40px;border-radius:50%;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3);background-size:cover;background-position:center;${firstDestino.foto ? `background-image:url(${firstDestino.foto});` : 'background-color:#e85d75;'}display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1.2rem;cursor:pointer;">${!firstDestino.foto ? '📍' : ''}</div>`;

                const marker = L.marker([firstDestino.coordinates.lat, firstDestino.coordinates.lng], {
                    icon: L.divIcon({ className: '', html: markerHtml, iconSize: [40, 40], iconAnchor: [20, 20] })
                }).addTo(mapInstanceRef.current);

                marker.on('click', () => onTripClick(trip));
                marker.bindPopup(`<b>${getTripName(trip)}</b><br><span style="font-size:0.85em;color:#666">${formatDestinations(trip.destinos)}</span><br>${getMotivoEmoji(trip.motivo)} ${trip.motivo}`);
                bounds.push([firstDestino.coordinates.lat, firstDestino.coordinates.lng]);
            }
        });

        if (bounds.length > 0) mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }, [trips, homeCoords, onTripClick]);

    return h('div', {id: 'map', ref: mapRef});
};

const TripDetailModal = ({ trip, onClose, homeCoords, onDelete, onEdit }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;
        const map = L.map(mapRef.current).setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
        mapInstanceRef.current = map;
        const bounds = [];
        const coords = [];

        if (homeCoords) {
            L.marker([homeCoords.lat, homeCoords.lng]).addTo(map).bindPopup('<b>🏠 Origen</b>');
            bounds.push([homeCoords.lat, homeCoords.lng]);
            coords.push([homeCoords.lat, homeCoords.lng]);
        }

        trip.destinos.forEach(destino => {
            if (destino.coordinates) {
                L.marker([destino.coordinates.lat, destino.coordinates.lng]).addTo(map).bindPopup(`<b>${destino.lugar}</b>`);
                bounds.push([destino.coordinates.lat, destino.coordinates.lng]);
                coords.push([destino.coordinates.lat, destino.coordinates.lng]);
            }
        });

        if (homeCoords) coords.push([homeCoords.lat, homeCoords.lng]);
        if (coords.length > 1) L.polyline(coords, { color: '#d4a574', weight: 3, opacity: 0.7, dashArray: '10, 10' }).addTo(map);
        if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });
        return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
    }, [trip, homeCoords]);

    const duracion = trip.fechaFinal ? Math.ceil((new Date(trip.fechaFinal) - new Date(trip.fechaInicio)) / (1000 * 60 * 60 * 24)) : 1;

    return (
        h('div', {className: 'modal-overlay', onClick: onClose},
            h('div', {className: 'modal-content', onClick: (e) => e.stopPropagation()},
                h('div', {className: 'modal-header'},
                    h('button', {className: 'modal-close', onClick: onClose}, '\u00d7')
                ),
                h('div', {className: 'modal-body'},
                    h('h2', {className: 'trip-detail-title'}, getTripName(trip)),
                    trip.destinos.length > 0 && h('div', {style: {fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem'}}, formatDestinations(trip.destinos)),
                    h('div', {className: 'trip-detail-meta'},
                        h('div', {className: 'trip-detail-meta-item'}, h('span', null, '📅'), h('span', null, formatDateRange(trip.fechaInicio, trip.fechaFinal))),
                        h('div', {className: 'trip-detail-meta-item'}, h('span', null, getMotivoEmoji(trip.motivo)), h('span', null, trip.motivo)),
                        h('div', {className: 'trip-detail-meta-item'}, h('span', null, '⏱️'), h('span', null, duracion, ' d\u00eda', duracion !== 1 ? 's' : '')),
                        h('div', {className: 'trip-detail-meta-item'}, h('span', null, '📍'), h('span', null, trip.destinos.length, ' destino', trip.destinos.length !== 1 ? 's' : ''))
                    ),
                    trip.personas && trip.personas.length > 0 && (
                        h('div', {style: {marginBottom: '2rem'}},
                            h('h3', {style: {fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--secondary)'}}, '👥 Acompa\u00f1antes'),
                            h('div', {className: 'people-container'},
                                trip.personas.map(person => (
                                    h('div', {key: person.nombre, className: 'person-tag'},
                                        person.foto && h('img', {src: person.foto, alt: person.nombre, className: 'person-avatar'}),
                                        person.nombre
                                    )
                                ))
                            )
                        )
                    ),
                    h('div', {className: 'trip-detail-map', ref: mapRef}),
                    h('h3', {style: {fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--secondary)'}}, '🗺️ Destinos'),
                    h('div', {style: {display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem'}},
                        trip.destinos.map((destino, index) => (
                            h('div', {key: index, style: {background: 'var(--light)', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--border)'}},
                                destino.foto && h('img', {src: destino.foto, alt: destino.lugar, style: {width: '100%', height: '150px', objectFit: 'cover'}}),
                                h('div', {style: {padding: '1rem'}},
                                    h('div', {style: {fontSize: '1.1rem', fontWeight: '700', color: 'var(--secondary)', marginBottom: '0.5rem'}}, destino.lugar),
                                    destino.fechaInicio && h('div', {style: {fontSize: '0.85rem', color: '#666'}}, formatDateRange(destino.fechaInicio, destino.fechaFinal))
                                )
                            )
                        ))
                    ),
                    trip.notas && (
                        h('div', {style: {marginTop: '2rem', padding: '1.5rem', background: 'var(--light)', borderRadius: '12px'}},
                            h('h4', {style: {fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--secondary)'}}, '📝 Notas'),
                            h('p', {style: {color: '#666', lineHeight: '1.6'}}, trip.notas)
                        )
                    ),
                    h('div', {style: {marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end'}},
                        onEdit && h('button', {className: 'btn-edit', onClick: () => { onClose(); onEdit(trip); }}, '✏️ Editar Viaje'),
                        onDelete && h('button', {className: 'btn-edit', onClick: () => onDelete(trip.id), style: {color: '#dc3545', borderColor: '#dc3545'}}, '🗑️ Eliminar Viaje')
                    )
                )
            )
        )
    );
};

const DestinoCard = ({ destino, index, formData, onSave, onRemove, isGeocoding, setIsGeocoding, uploadPhoto }) => {
    const [isEditing, setIsEditing] = useState(!!destino._isNew);
    const [local, setLocal] = useState({ ...destino });
    const [localPreview, setLocalPreview] = useState(destino.foto);
    const fileInputId = 'destino-photo-' + index;

    const handleLocalFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const compressed = await compressImage(reader.result, 800, 0.6);
                setLocalPreview(compressed);                              // instant preview while upload runs
                const url = uploadPhoto ? await uploadPhoto(compressed) : null;
                const fotoValue = url || compressed;                      // fallback to base64 on upload failure
                setLocal(prev => ({ ...prev, foto: fotoValue }));
                setLocalPreview(fotoValue);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!local.lugar) return;
        setIsGeocoding(true);
        const coordinates = local.coordinates || await geocodePlace(local.lugar);
        const { _isNew, ...rest } = local;
        onSave(index, { ...rest, coordinates });
        setIsEditing(false);
        setIsGeocoding(false);
    };

    const handleCancel = () => {
        if (destino._isNew) { onRemove(index); return; }
        setLocal({ ...destino });
        setLocalPreview(destino.foto);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            h('div', {className: 'destination-item', style: {borderColor: 'var(--primary)'}},
                h('div', {className: 'form-grid'},
                    h('div', {className: 'form-group'}, h('label', null, 'Lugar *'), h('input', {type: 'text', value: local.lugar, onChange: (e) => setLocal({...local, lugar: e.target.value}), placeholder: 'Par\u00eds, Francia'})),
                    h('div', {className: 'form-group'}, h('label', null, 'Fecha inicio'), h('input', {type: 'date', value: local.fechaInicio || '', onChange: (e) => setLocal({...local, fechaInicio: e.target.value}), min: formData.fechaInicio, max: formData.fechaFinal || undefined})),
                    h('div', {className: 'form-group'}, h('label', null, 'Fecha final'), h('input', {type: 'date', value: local.fechaFinal || '', onChange: (e) => setLocal({...local, fechaFinal: e.target.value}), min: local.fechaInicio || formData.fechaInicio, max: formData.fechaFinal || undefined})),
                    h('div', {className: 'form-group'},
                        h('label', null, 'Foto'),
                        h('div', {className: 'file-input-wrapper'},
                            h('input', {type: 'file', id: fileInputId, accept: 'image/*', onChange: handleLocalFileChange}),
                            h('label', {htmlFor: fileInputId, className: 'file-input-label'}, '📸 ', local.foto ? 'Cambiar foto' : 'Seleccionar foto')
                        ),
                        localPreview && h('img', {src: localPreview, alt: 'Preview', className: 'image-preview'})
                    )
                ),
                h('div', {style: {display: 'flex', gap: '0.5rem', marginTop: '1rem'}},
                    h('button', {type: 'button', className: 'btn-secondary', onClick: handleSave, disabled: !local.lugar || isGeocoding},
                        isGeocoding ? h('span', {className: 'loading'}) : '💾 Guardar'
                    ),
                    h('button', {type: 'button', className: 'btn-edit', onClick: handleCancel}, 'Cancelar')
                )
            )
        );
    }

    return (
        h('div', {className: 'destination-item'},
            h('button', {type: 'button', className: 'btn-remove', onClick: () => onRemove(index)}, '\u00d7'),
            h('h4', null, '📍 ', destino.lugar),
            (destino.fechaInicio || destino.fechaFinal) && h('p', {style: {fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem'}}, formatDateRange(destino.fechaInicio, destino.fechaFinal)),
            destino.foto && h('img', {src: destino.foto, alt: destino.lugar, className: 'image-preview'}),
            h('button', {type: 'button', className: 'btn-edit-destino', onClick: () => setIsEditing(true)}, '✏️ Editar')
        )
    );
};

const AddTripForm = ({ onAddTrip, allPeople, allDestinations, editingTrip, onCancelEdit, existingTrips, showToast, onImportTrips, uploadPhoto }) => {
    const [formData, setFormData] = useState(editingTrip || { trip_name: '', fechaInicio: '', fechaFinal: '', motivo: 'placer', personas: [], destinos: [], notas: '' });
    const [destinationsText, setDestinationsText] = useState(
        editingTrip ? (editingTrip.destinos || []).map(d => d.lugar).join(', ') : ''
    );
    const [currentPerson, setCurrentPerson] = useState({ nombre: '', foto: null });
    const [personPreviewUrl, setPersonPreviewUrl] = useState(null);
    const [isGeocoding, setIsGeocoding] = useState(false);

    useEffect(() => {
        if (editingTrip) {
            setFormData(editingTrip);
            setDestinationsText((editingTrip.destinos || []).map(d => d.lugar).join(', '));
        }
    }, [editingTrip]);

    const handleAddPerson = (personData) => {
        const nombre = typeof personData === 'string' ? personData : personData.nombre;
        const foto = typeof personData === 'string' ? null : personData.foto;
        if (!nombre || formData.personas.some(p => p.nombre === nombre)) return;
        setFormData({ ...formData, personas: [...formData.personas, { nombre, foto }] });
        setCurrentPerson({ nombre: '', foto: null });
        setPersonPreviewUrl(null);
    };

    const handleRemovePerson = (nombre) => setFormData({ ...formData, personas: formData.personas.filter(p => p.nombre !== nombre) });

    const handlePersonPhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const compressed = await compressImage(reader.result, 200, 0.7);
                setPersonPreviewUrl(compressed);                              // instant preview
                const url = uploadPhoto ? await uploadPhoto(compressed) : null;
                const fotoValue = url || compressed;                          // fallback to base64
                setCurrentPerson(prev => ({ ...prev, foto: fotoValue }));
                setPersonPreviewUrl(fotoValue);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCSVImportComplete = (importedTrips, errors) => {
        onImportTrips(importedTrips);
        const errCount = errors.length;
        const msg = 'Se importaron ' + importedTrips.length + ' viajes' + (errCount > 0 ? ' (' + errCount + ' advertencias)' : '');
        showToast(msg, 'success');
    };


    // Build destinos stubs from the quick-entry text, merging with any fully-edited cards
    const buildDestinos = () => {
        const textPlaces = destinationsText.split(',').map(s => s.trim()).filter(Boolean);
        if (textPlaces.length === 0) return formData.destinos;
        // For each place in the text field, keep an existing DestinoCard if the lugar matches,
        // otherwise create a stub. Append any DestinoCards not mentioned in the text field.
        const merged = textPlaces.map(lugar => {
            const existing = formData.destinos.find(d => d.lugar === lugar);
            return existing || { lugar, fechaInicio: '', fechaFinal: '', foto: null, coordinates: null };
        });
        formData.destinos.forEach(d => {
            if (!textPlaces.includes(d.lugar)) merged.push(d);
        });
        return merged;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.trip_name.trim()) { showToast('El nombre del viaje es obligatorio', 'warning'); return; }
        const finalDestinos = buildDestinos();
        if (finalDestinos.length === 0) { showToast('Agrega al menos un destino', 'warning'); return; }
        const tripData = { ...formData, trip_name: formData.trip_name.trim(), destinos: finalDestinos };
        const trip = editingTrip ? tripData : { ...tripData, id: Date.now(), createdAt: new Date().toISOString() };
        onAddTrip(trip);
        if (!editingTrip) {
            setFormData({ trip_name: '', fechaInicio: '', fechaFinal: '', motivo: 'placer', personas: [], destinos: [], notas: '' });
            setDestinationsText('');
        }
    };

    const suggestedPeople = allPeople.filter(p => !formData.personas.some(fp => fp.nombre === p.nombre));
    const savedDestinations = allDestinations.filter(d => !formData.destinos.some(fd => fd.lugar === d.lugar));

    return (
        h('div', {className: 'add-trip-section'},
            h('h2', {className: 'form-title'},
                h('span', null, editingTrip ? '✏️ Editar Viaje' : '✈️ Agregar Nuevo Viaje'),
                editingTrip && h('button', {className: 'btn-edit', onClick: onCancelEdit}, 'Cancelar')
            ),

            !editingTrip && (
                h(CSVImportPanel, {onImportComplete: handleCSVImportComplete, existingTrips: existingTrips || [], showToast: showToast})
            ),

            h('form', {onSubmit: handleSubmit},
                h('div', {className: 'form-section'},
                    h('h3', {className: 'form-section-title'}, 'Informaci\u00f3n General'),
                    // ── Trip name (primary identifier) ──────────────────────────
                    h('div', {className: 'form-group', style: {marginBottom: '1.25rem'}},
                        h('label', {style: {fontSize: '1rem', fontWeight: '700', color: 'var(--secondary)'}}, 'Nombre del viaje *'),
                        h('input', {
                            type: 'text',
                            value: formData.trip_name,
                            onChange: (e) => setFormData({ ...formData, trip_name: e.target.value }),
                            placeholder: 'Ej: Summer Beach Trip, Patagonia Adventure...',
                            required: true,
                            style: {fontSize: '1.05rem'}
                        })
                    ),
                    // ── Destinations quick-entry ────────────────────────────────
                    h('div', {className: 'form-group', style: {marginBottom: '1.25rem'}},
                        h('label', null, 'Destinos'),
                        h('input', {
                            type: 'text',
                            value: destinationsText,
                            onChange: (e) => {
                                const val = e.target.value;
                                setDestinationsText(val);
                                // Sync stubs into formData.destinos as user types
                                const places = val.split(',').map(s => s.trim()).filter(Boolean);
                                const newDestinos = places.map(lugar => {
                                    const existing = formData.destinos.find(d => d.lugar === lugar);
                                    return existing || { lugar, fechaInicio: '', fechaFinal: '', foto: null, coordinates: null };
                                });
                                // Preserve fully-edited cards not in the text field
                                formData.destinos.forEach(d => {
                                    if (!places.includes(d.lugar)) newDestinos.push(d);
                                });
                                setFormData(prev => ({ ...prev, destinos: newDestinos }));
                            },
                            placeholder: 'Ej: Par\u00eds, Londres, Roma  (separados por coma)'
                        }),
                        h('div', {style: {fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem'}},
                            'Escrib\u00ed los destinos separados por coma. Pod\u00e9s agregar fechas y fotos por destino abajo.'
                        )
                    ),
                    h('div', {className: 'form-grid'},
                        h('div', {className: 'form-group'}, h('label', null, 'Fecha Inicio *'), h('input', {type: 'date', value: formData.fechaInicio, onChange: (e) => setFormData({ ...formData, fechaInicio: e.target.value }), required: true})),
                        h('div', {className: 'form-group'}, h('label', null, 'Fecha Final'), h('input', {type: 'date', value: formData.fechaFinal, onChange: (e) => setFormData({ ...formData, fechaFinal: e.target.value }), min: formData.fechaInicio})),
                        h('div', {className: 'form-group'},
                            h('label', null, 'Motivo del viaje'),
                            h('select', {value: formData.motivo, onChange: (e) => setFormData({ ...formData, motivo: e.target.value })},
                                h('option', {value: 'placer'}, '🏖️ Placer'),
                                h('option', {value: 'negocios'}, '💼 Negocios'),
                                h('option', {value: 'evento'}, '🎉 Evento'),
                                h('option', {value: 'familia'}, '👨\u200d👩\u200d👧\u200d👦 Familia'),
                                h('option', {value: 'estudio'}, '📚 Estudio'),
                                h('option', {value: 'otro'}, '🌟 Otro')
                            )
                        )
                    )
                ),

                h('div', {className: 'form-section'},
                    h('h3', {className: 'form-section-title'}, 'Destinos'),

                    savedDestinations.length > 0 && (
                        h('div', {style: {marginBottom: '1rem'}},
                            h('label', null, 'Seleccionar destino guardado:'),
                            h('div', {className: 'suggested-people'},
                                savedDestinations.slice(0, 10).map(dest => (
                                    h('div', {key: dest.lugar, className: 'suggested-person', onClick: () => {
                                        const newDest = { lugar: dest.lugar, fechaInicio: '', fechaFinal: '', foto: null, coordinates: dest.coordinates };
                                        setFormData(prev => ({ ...prev, destinos: [...prev.destinos, newDest] }));
                                        setDestinationsText(prev => prev ? prev + ', ' + dest.lugar : dest.lugar);
                                    }}, '📍 ', dest.lugar)
                                ))
                            )
                        )
                    ),

                    h('div', {className: 'destinations-list'},
                        formData.destinos.map((destino, index) => (
                            h(DestinoCard, {key: index, destino: destino, index: index, formData: formData,
                                onSave: (idx, updated) => {
                                    const nd = [...formData.destinos];
                                    nd[idx] = updated;
                                    setFormData(prev => ({...prev, destinos: nd}));
                                    setDestinationsText(nd.map(d => d.lugar).filter(Boolean).join(', '));
                                },
                                onRemove: (idx) => {
                                    const nd = formData.destinos.filter((_, i) => i !== idx);
                                    setFormData(prev => ({...prev, destinos: nd}));
                                    setDestinationsText(nd.map(d => d.lugar).filter(Boolean).join(', '));
                                },
                                isGeocoding: isGeocoding, setIsGeocoding: setIsGeocoding, uploadPhoto: uploadPhoto
                            })
                        ))
                    ),

                    h('div', {className: 'destination-item', style: {border: '2px dashed var(--border)', cursor: 'pointer', textAlign: 'center', padding: '1.5rem'},
                        onClick: () => {
                            setFormData(prev => ({...prev, destinos: [...prev.destinos, { lugar: '', fechaInicio: '', fechaFinal: '', foto: null, coordinates: null, _isNew: true }]}));
                        }},
                        h('span', {style: {fontSize: '1.1rem', color: 'var(--secondary)', fontWeight: '600'}}, '➕ Agregar Destino')
                    )
                ),

                h('div', {className: 'form-section'},
                    h('h3', {className: 'form-section-title'}, 'Acompa\u00f1antes'),
                    h('div', {className: 'form-grid'},
                        h('div', {className: 'form-group'}, h('label', null, 'Nombre'), h('input', {type: 'text', value: currentPerson.nombre, onChange: (e) => setCurrentPerson({...currentPerson, nombre: e.target.value}), placeholder: 'Nombre de la persona', onKeyPress: (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPerson(currentPerson); } }})),
                        h('div', {className: 'form-group'},
                            h('label', null, 'Foto (opcional)'),
                            h('div', {className: 'file-input-wrapper'},
                                h('input', {type: 'file', id: 'person-photo', accept: 'image/*', onChange: handlePersonPhotoChange}),
                                h('label', {htmlFor: 'person-photo', className: 'file-input-label'}, '📸 ', currentPerson.foto ? 'Cambiar foto' : 'Seleccionar foto')
                            ),
                            personPreviewUrl && h('img', {src: personPreviewUrl, alt: 'Preview', className: 'image-preview', style: {height: '100px'}})
                        )
                    ),
                    h('button', {type: 'button', className: 'btn-secondary', onClick: () => handleAddPerson(currentPerson), style: {marginTop: '1rem'}}, '+ Agregar Persona'),

                    suggestedPeople.length > 0 && (
                        h('div', null,
                            h('label', {style: {marginTop: '1rem', display: 'block'}}, 'Personas frecuentes:'),
                            h('div', {className: 'suggested-people'},
                                suggestedPeople.map(person => (
                                    h('div', {key: person.nombre, className: 'suggested-person', onClick: () => handleAddPerson(person)},
                                        person.foto && h('img', {src: person.foto, alt: person.nombre, className: 'person-avatar'}),
                                        person.nombre
                                    )
                                ))
                            )
                        )
                    ),

                    formData.personas.length > 0 && (
                        h('div', {className: 'people-container'},
                            formData.personas.map(person => (
                                h('div', {key: person.nombre, className: 'person-tag'},
                                    person.foto && h('img', {src: person.foto, alt: person.nombre, className: 'person-avatar'}),
                                    person.nombre,
                                    h('button', {type: 'button', onClick: () => handleRemovePerson(person.nombre)}, '\u00d7')
                                )
                            ))
                        )
                    )
                ),

                h('div', {className: 'form-section'},
                    h('h3', {className: 'form-section-title'}, 'Notas adicionales'),
                    h('textarea', {value: formData.notas, onChange: (e) => setFormData({ ...formData, notas: e.target.value }), placeholder: 'Actividades, recomendaciones, presupuesto...'})
                ),

                h('button', {type: 'submit', className: 'btn-primary', style: {marginTop: '1rem'}},
                    editingTrip ? '💾 Guardar Cambios' : '✈️ Guardar Viaje'
                )
            )
        )
    );
};

const CSVImportPanel = ({ onImportComplete, existingTrips, showToast }) => {
    const [stage, setStage] = useState('idle');
    const [parsedData, setParsedData] = useState({ trips: [], errors: [] });
    const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 });
    const [selectedTrips, setSelectedTrips] = useState(new Set());

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = parseCSVRows(event.target.result);
            if (result.trips.length === 0) {
                showToast('No se encontraron viajes en el CSV. Verifica el formato.', 'error');
                return;
            }
            const withDuplicates = detectDuplicates(result.trips, existingTrips);
            setParsedData({ trips: withDuplicates, errors: result.errors });
            const nonDupIndices = new Set();
            withDuplicates.forEach((t, i) => { if (!t._isDuplicate) nonDupIndices.add(i); });
            setSelectedTrips(nonDupIndices);
            setStage('preview');
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleImport = async () => {
        const tripsToImport = parsedData.trips.filter((_, i) => selectedTrips.has(i));
        if (tripsToImport.length === 0) { showToast('Selecciona al menos un viaje para importar', 'warning'); return; }
        setStage('importing');
        const totalDest = tripsToImport.reduce((sum, t) => sum + t.destinos.length, 0);
        setGeocodeProgress({ done: 0, total: totalDest });
        const { trips: geocodedTrips, errors: geoErrors } = await geocodeTrips(
            tripsToImport,
            (done, total) => setGeocodeProgress({ done, total })
        );
        const cleanTrips = geocodedTrips.map(t => { const { _isDuplicate, ...rest } = t; return rest; });
        const allErrors = [...parsedData.errors, ...geoErrors.map(e => ({ row: '-', message: e.lugar + ': ' + e.message }))];
        onImportComplete(cleanTrips, allErrors);
        setStage('idle');
        setParsedData({ trips: [], errors: [] });
    };

    const toggleTrip = (index) => {
        const next = new Set(selectedTrips);
        if (next.has(index)) next.delete(index); else next.add(index);
        setSelectedTrips(next);
    };

    const toggleAll = () => {
        if (selectedTrips.size === parsedData.trips.length) setSelectedTrips(new Set());
        else setSelectedTrips(new Set(parsedData.trips.map((_, i) => i)));
    };

    if (stage === 'importing') {
        const pct = geocodeProgress.total > 0 ? Math.round((geocodeProgress.done / geocodeProgress.total) * 100) : 0;
        return (
            h('div', {className: 'csv-import'},
                h('h4', null, 'Importando viajes...'),
                h('p', {style: {color: '#666', marginBottom: '0.5rem'}}, 'Geocodificando destinos: ', geocodeProgress.done, '/', geocodeProgress.total),
                h('div', {className: 'csv-progress-bar'}, h('div', {className: 'csv-progress-fill', style: {width: pct + '%'}})),
                h('p', {style: {fontSize: '0.85rem', color: '#888'}}, 'Esto puede tardar unos segundos debido al limite de velocidad del servicio de geolocalizacion.')
            )
        );
    }

    if (stage === 'preview') {
        const selectedCount = selectedTrips.size;
        return (
            h('div', {className: 'csv-import', style: {borderColor: 'var(--secondary)'}},
                h('h4', null, 'Vista previa de importacion'),
                h('p', {style: {color: '#666', marginBottom: '1rem'}}, 'Se encontraron ', h('strong', null, parsedData.trips.length), ' viajes con ', h('strong', null, parsedData.trips.reduce((s, t) => s + t.destinos.length, 0)), ' destinos'),

                parsedData.errors.length > 0 && (
                    h('div', {style: {background: '#fff3cd', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem'}},
                        h('strong', null, 'Advertencias (', parsedData.errors.length, '):'),
                        parsedData.errors.slice(0, 5).map((err, i) => (
                            h('div', {key: i, style: {marginTop: '0.25rem'}}, 'Fila ', err.row, ': ', err.message)
                        )),
                        parsedData.errors.length > 5 && h('div', {style: {marginTop: '0.25rem'}}, '...y ', parsedData.errors.length - 5, ' mas')
                    )
                ),

                h('div', {style: {marginBottom: '0.75rem'}},
                    h('label', {style: {cursor: 'pointer', fontSize: '0.9rem'}},
                        h('input', {type: 'checkbox', checked: selectedTrips.size === parsedData.trips.length, onChange: toggleAll, style: {marginRight: '0.5rem'}}),
                        'Seleccionar todos'
                    )
                ),

                h('table', {className: 'csv-preview-table'},
                    h('thead', null,
                        h('tr', null, h('th', null), h('th', null, 'Nombre'), h('th', null, 'Fecha'), h('th', null, 'Destinos'), h('th', null, 'Motivo'), h('th', null, 'Personas'), h('th', null, 'Estado'))
                    ),
                    h('tbody', null,
                        parsedData.trips.map((trip, i) => (
                            h('tr', {key: i, className: trip._isDuplicate ? 'duplicate' : ''},
                                h('td', null, h('input', {type: 'checkbox', checked: selectedTrips.has(i), onChange: () => toggleTrip(i)})),
                                h('td', null, getTripName(trip)),
                                h('td', null, trip.fechaInicio, trip.fechaFinal && trip.fechaFinal !== trip.fechaInicio ? ' - ' + trip.fechaFinal : ''),
                                h('td', null, trip.destinos.map(d => d.lugar).join(', ')),
                                h('td', null, getMotivoEmoji(trip.motivo), ' ', trip.motivo),
                                h('td', null, trip.personas.map(p => p.nombre).join(', ') || '-'),
                                h('td', null, trip._isDuplicate ? '⚠️ Duplicado' : '✅ Nuevo')
                            )
                        ))
                    )
                ),

                h('div', {style: {display: 'flex', gap: '1rem', marginTop: '1rem'}},
                    h('button', {className: 'btn-primary', onClick: handleImport, disabled: selectedCount === 0},
                        'Importar seleccionados (', selectedCount, ')'
                    ),
                    h('button', {className: 'btn-edit', onClick: () => { setStage('idle'); setParsedData({ trips: [], errors: [] }); }}, 'Cancelar')
                )
            )
        );
    }

    return (
        h('div', {className: 'csv-import'},
            h('h4', null, '📤 Importar viajes desde CSV'),
            h('div', {className: 'csv-help'}, 'Sube un archivo CSV con tus viajes. El encabezado debe incluir columnas como: tripName (opcional), tripId, tripFechaInicio, tripFechaFinal, motivo, personas, notas, lugar, destFechaInicio, destFechaFinal'),
            h('div', {className: 'csv-example'}, 'tripName,tripId,tripFechaInicio,tripFechaFinal,motivo,personas,notas,lugar,destFechaInicio,destFechaFinal'),
            h('input', {type: 'file', accept: '.csv', onChange: handleFileSelect})
        )
    );
};

const DataManagementPanel = ({ trips, lastImportDate, onExportJSON, onExportCSV, onImportJSON, onClearAll }) => {
    const jsonInputRef = useRef(null);
    return (
        h('div', {className: 'add-trip-section', style: {marginTop: '2rem'}},
            h('h2', {className: 'form-title'}, 'Gestion de Datos'),
            h('div', {style: {display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1.5rem', padding: '1rem', background: 'var(--light)', borderRadius: '12px'}},
                h('div', null, h('strong', null, trips.length), ' viajes guardados'),
                h('div', null, h('strong', null, trips.reduce((sum, t) => sum + t.destinos.length, 0)), ' destinos totales'),
                lastImportDate && h('div', null, 'Ultima importacion: ', new Date(lastImportDate).toLocaleDateString('es-ES'))
            ),
            h('div', {className: 'form-section'},
                h('h3', {className: 'form-section-title'}, 'Exportar'),
                h('div', {style: {display: 'flex', gap: '1rem', flexWrap: 'wrap'}},
                    h('button', {className: 'btn-secondary', onClick: onExportJSON}, 'Descargar Backup (JSON)'),
                    h('button', {className: 'btn-secondary', onClick: onExportCSV}, 'Descargar CSV')
                )
            ),
            h('div', {className: 'form-section'},
                h('h3', {className: 'form-section-title'}, 'Restaurar Backup'),
                h('p', {style: {fontSize: '0.9rem', color: '#666', marginBottom: '1rem'}}, 'Sube un archivo JSON de backup previamente exportado. Esto reemplazara todos los datos actuales.'),
                h('input', {type: 'file', accept: '.json', onChange: onImportJSON, ref: jsonInputRef})
            ),
            h('div', {className: 'form-section'},
                h('h3', {className: 'form-section-title'}, 'Zona de Peligro'),
                h('button', {className: 'btn-edit', onClick: onClearAll, style: {color: '#dc3545', borderColor: '#dc3545'}}, 'Borrar Todos los Datos')
            )
        )
    );
};

const TimelineView = ({ trips, onTripClick }) => {
    if (trips.length === 0) return h('div', {className: 'empty-state'}, h('div', {className: 'empty-state-icon'}, '📅'), h('div', {className: 'empty-state-text'}, 'No hay viajes registrados a\u00fan'));
    const tripsByYear = {};
    trips.forEach(trip => {
        const year = new Date(trip.fechaInicio).getFullYear();
        if (!tripsByYear[year]) tripsByYear[year] = {};
        const month = new Date(trip.fechaInicio).getMonth();
        if (!tripsByYear[year][month]) tripsByYear[year][month] = [];
        tripsByYear[year][month].push(trip);
    });
    const years = Object.keys(tripsByYear).sort((a, b) => b - a);

    return (
        h('div', null,
            years.map(year => {
                const months = Array.from({ length: 12 }, (_, i) => ({
                    index: i,
                    name: new Date(year, i).toLocaleDateString('es-ES', { month: 'short' }),
                    trips: tripsByYear[year][i] || []
                }));

                return (
                    h('div', {key: year, className: 'timeline-year-container'},
                        h('h2', {className: 'timeline-year-header'}, year),
                        h('div', {className: 'timeline-horizontal'},
                            h('div', {className: 'timeline-line'}),
                            h('div', {className: 'timeline-months'},
                                months.map(month => (
                                    h('div', {key: month.index, className: 'timeline-month'},
                                        h('div', {className: 'timeline-month-dot'}),
                                        h('div', {className: 'timeline-month-label'}, month.name),
                                        h('div', {className: 'timeline-month-trips'},
                                            month.trips.map(trip => {
                                                const firstDestino = trip.destinos[0];
                                                const duracion = trip.fechaFinal ? Math.ceil((new Date(trip.fechaFinal) - new Date(trip.fechaInicio)) / (1000 * 60 * 60 * 24)) : 1;
                                                return (
                                                    h('div', {key: trip.id, className: 'timeline-trip-mini', onClick: () => onTripClick(trip)},
                                                        firstDestino?.foto && h('img', {src: firstDestino.foto, alt: firstDestino.lugar, className: 'timeline-trip-mini-image'}),
                                                        h('div', {className: 'timeline-trip-mini-title'}, getTripName(trip)),
                                                        trip.destinos.length > 0 && h('div', {style: {fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem', lineHeight: '1.2'}}, formatDestinations(trip.destinos)),
                                                        h('div', {className: 'timeline-trip-mini-meta'},
                                                            h('span', null, getMotivoEmoji(trip.motivo)),
                                                            h('span', null, duracion, 'd'),
                                                            h('span', null, '📍', trip.destinos.length)
                                                        )
                                                    )
                                                );
                                            })
                                        )
                                    )
                                ))
                            )
                        )
                    )
                );
            })
        )
    );
};

const DashboardView = ({ trips, homeCoords }) => {
    if (trips.length === 0) return h('div', {className: 'empty-state'}, h('div', {className: 'empty-state-icon'}, '📊'), h('div', {className: 'empty-state-text'}, 'Agrega viajes para ver tus métricas'));

    // --- Overview ---
    const totalTrips = trips.length;
    const allDest = trips.flatMap(t => t.destinos);
    const totalDays = trips.reduce((sum, t) => sum + Math.max(1, t.fechaFinal ? Math.ceil((new Date(t.fechaFinal) - new Date(t.fechaInicio)) / 86400000) : 1), 0);
    const avgTripLength = Math.round(totalDays / totalTrips);
    const longestTrip = trips.reduce((best, t) => { const d = Math.max(1, t.fechaFinal ? Math.ceil((new Date(t.fechaFinal) - new Date(t.fechaInicio)) / 86400000) : 1); return d > best.days ? { name: getTripName(t), days: d } : best; }, { name: '', days: 0 });
    const longestPct = ((longestTrip.days / 365) * 100).toFixed(1);
    let totalKm = 0;
    if (homeCoords) {
        trips.forEach(trip => {
            let last = homeCoords;
            trip.destinos.forEach(d => { if (d.coordinates) { totalKm += calculateDistance(last.lat, last.lng, d.coordinates.lat, d.coordinates.lng); last = d.coordinates; } });
            totalKm += calculateDistance(last.lat, last.lng, homeCoords.lat, homeCoords.lng);
        });
    }

    const avgKmPerTrip = totalTrips > 0 ? Math.round(totalKm / totalTrips) : 0;

    // Days since last trip
    const sortedByDate = [...trips].sort((a, b) => new Date(b.fechaFinal || b.fechaInicio) - new Date(a.fechaFinal || a.fechaInicio));
    const lastTripEnd = sortedByDate[0] ? new Date(sortedByDate[0].fechaFinal || sortedByDate[0].fechaInicio) : null;
    const daysSinceLast = lastTripEnd ? Math.floor((new Date() - lastTripEnd) / 86400000) : '-';

    // --- Travel Patterns ---
    const monthCounts = Array(12).fill(0);
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    trips.forEach(t => { monthCounts[new Date(t.fechaInicio).getMonth()]++; });
    const maxMonth = Math.max(...monthCounts);

    // Travel frequency (trips per month average)
    const monthsWithTrips = new Set();
    trips.forEach(t => { const d = new Date(t.fechaInicio); monthsWithTrips.add(d.getFullYear() * 12 + d.getMonth()); });
    const sortedMonthKeys = [...monthsWithTrips].sort((a, b) => a - b);
    const monthSpan = sortedMonthKeys.length > 1 ? (sortedMonthKeys[sortedMonthKeys.length - 1] - sortedMonthKeys[0] + 1) : 1;
    const tripsPerMonth = (totalTrips / monthSpan).toFixed(1);

    // --- Geography ---
    const placeCount = {};
    allDest.forEach(d => { placeCount[d.lugar] = (placeCount[d.lugar] || 0) + 1; });
    const placeEntries = Object.entries(placeCount).sort((a, b) => b[1] - a[1]);
    const topDestinations = placeEntries.slice(0, 5);

    let furthest = { name: '-', km: 0 };
    if (homeCoords) {
        allDest.forEach(d => {
            if (d.coordinates) {
                const km = calculateDistance(homeCoords.lat, homeCoords.lng, d.coordinates.lat, d.coordinates.lng);
                if (km > furthest.km) furthest = { name: d.lugar, km };
            }
        });
    }
    const worldLaps = (furthest.km / 40075).toFixed(1);

    // Country & continent
    const countryCount = {};
    allDest.forEach(d => { if (d.pais) countryCount[d.pais] = (countryCount[d.pais] || 0) + 1; });
    const topCountry = Object.entries(countryCount).sort((a, b) => b[1] - a[1])[0];

    const continentCount = {};
    allDest.forEach(d => { if (d.continente) continentCount[d.continente] = (continentCount[d.continente] || 0) + 1; });
    const topContinent = Object.entries(continentCount).sort((a, b) => b[1] - a[1])[0];

    // --- Social / Company ---
    const peopleStats = {};
    trips.forEach(trip => {
        const tripDays = Math.max(1, trip.fechaFinal ? Math.ceil((new Date(trip.fechaFinal) - new Date(trip.fechaInicio)) / 86400000) : 1);
        trip.personas.forEach(p => {
            if (!peopleStats[p.nombre]) peopleStats[p.nombre] = { count: 0, days: 0, foto: p.foto };
            peopleStats[p.nombre].count++;
            peopleStats[p.nombre].days += tripDays;
            if (p.foto && !peopleStats[p.nombre].foto) peopleStats[p.nombre].foto = p.foto;
        });
    });
    const topCompanions = Object.entries(peopleStats).sort((a, b) => b[1].count - a[1].count).slice(0, 3);

    // SVG line chart
    const chartW = 100, chartH = 40;
    const linePoints = monthCounts.map((c, i) => {
        const x = (i / 11) * chartW;
        const y = maxMonth > 0 ? chartH - (c / maxMonth) * chartH : chartH;
        return x + ',' + y;
    }).join(' ');

    return (
        h('div', {className: 'bento-grid'},

            /* === ROW 1-2 LEFT: TRIPS (2col x 2row) === */
            h('div', {className: 'bento-card bento-trips'},
                h('div', {className: 'bento-value-xl'}, totalTrips),
                h('div', {className: 'bento-label'}, 'Viajes')
            ),

            /* === R1-2: TravelDays, Distance, Frequency (2×2 each) + DaysSince (2×1) === */
            h('div', {className: 'bento-card bento-traveldays'},
                h('div', {className: 'bento-value-xl'}, totalDays),
                h('div', {className: 'bento-label'}, 'Dias viajando')
            ),

            h('div', {className: 'bento-card bento-distance'},
                h('div', {className: 'bento-value-xl'}, Math.round(totalKm).toLocaleString()),
                h('div', {className: 'bento-label'}, 'Km recorridos')
            ),

            h('div', {className: 'bento-card bento-frequency'},
                h('div', {className: 'bento-value-xl'}, tripsPerMonth),
                h('div', {className: 'bento-label'}, 'Viajes/mes')
            ),

            h('div', {className: 'bento-card bento-dayssince'},
                h('div', {className: 'bento-value-lg'}, daysSinceLast),
                h('div', {className: 'bento-label'}, 'Dias desde ultimo viaje')
            ),

            /* === R3-4 LEFT: LONGEST TRIP (3×2) === */
            h('div', {className: 'bento-card bento-longest'},
                h('div', {className: 'bento-value-xl'}, longestTrip.days, 'd'),
                h('div', {className: 'bento-label'}, 'Viaje mas largo'),
                h('div', {className: 'bento-sub'}, longestTrip.name),
                h('div', {className: 'bento-sub'}, longestPct, '% del año')
            ),

            /* === R3-4 CENTER: TRAVELED MONTHS (5×2) === */
            h('div', {className: 'bento-card bento-monthly'},
                h('div', {className: 'bento-label'}, 'Meses viajados'),
                h('div', {className: 'bento-chart-area'},
                    h('svg', {viewBox: '0 0 100 40', className: 'bento-line-svg', preserveAspectRatio: 'none'},
                        h('polyline', {points: linePoints, fill: 'none', stroke: '#6B6259', strokeWidth: '1.5', strokeLinejoin: 'round', strokeLinecap: 'round'}),
                        monthCounts.map((c, i) => (
                            h('circle', {key: i, cx: (i / 11) * chartW, cy: maxMonth > 0 ? chartH - (c / maxMonth) * chartH : chartH, r: '1.5', fill: '#D4956A'})
                        ))
                    ),
                    h('div', {className: 'bento-chart-labels'},
                        monthNames.map((m, i) => h('span', {key: i}, m))
                    )
                )
            ),

            /* === R5-6 LEFT: FURTHEST DEST (3×2) === */
            h('div', {className: 'bento-card bento-furthest'},
                h('div', {className: 'bento-value-xl'}, furthest.km > 0 ? Math.round(furthest.km).toLocaleString() : '-'),
                h('div', {className: 'bento-label'}, 'Destino mas lejano'),
                furthest.km > 0 && h('div', {className: 'bento-sub'}, furthest.name),
                furthest.km > 0 && h('div', {className: 'bento-sub'}, worldLaps, 'x vuelta al mundo')
            ),

            /* === R2-3 RIGHT: MOST VISITED DESTINATIONS (2×2) === */
            h('div', {className: 'bento-card bento-mostvisited'},
                h('div', {className: 'bento-label'}, 'Destinos mas visitados'),
                h('div', {className: 'bento-top-list'},
                    topDestinations.map(([name, count]) => (
                        h('div', {key: name, className: 'bento-top-item'},
                            h('span', null, name),
                            h('span', {className: 'bento-top-count'}, count)
                        )
                    ))
                )
            ),

            /* === R4-5 RIGHT: Top Country (2×2) === */
            h('div', {className: 'bento-card bento-topcountry'},
                h('div', {className: 'bento-value-sm'}, topCountry ? topCountry[0] : '-'),
                h('div', {className: 'bento-label'}, 'Top pais')
            ),

            /* === R5: Avg Trip (2×1) === */
            h('div', {className: 'bento-card bento-avgtrip'},
                h('div', {className: 'bento-value-lg'}, avgTripLength, 'd'),
                h('div', {className: 'bento-label'}, 'Promedio dias/viaje')
            ),

            /* === R6: Avg km/trip (2×1) — NEW === */
            h('div', {className: 'bento-card bento-avgkm'},
                h('div', {className: 'bento-value-lg'}, avgKmPerTrip.toLocaleString()),
                h('div', {className: 'bento-label'}, 'Promedio km/viaje')
            ),

            /* === R5-6 CENTER: COMPANIONS (3×2) === */
            h('div', {className: 'bento-card bento-companions'},
                h('div', {className: 'bento-label'}, 'Top compañeros'),
                h('div', {className: 'bento-companions-list'},
                    topCompanions.map(([name, data]) => (
                        h('div', {key: name, className: 'bento-companion-row'},
                            h('div', {className: 'bento-companion-avatar'},
                                data.foto ? h('img', {src: data.foto, alt: name}) : null
                            ),
                            h('div', {className: 'bento-companion-info'},
                                h('div', {className: 'bento-companion-name'}, name),
                                h('div', {className: 'bento-companion-detail'}, data.days, ' dias viajando juntos')
                            )
                        )
                    )),
                    topCompanions.length === 0 && h('div', {className: 'bento-sub'}, 'Sin compañeros registrados')
                )
            ),

            /* === R6 RIGHT: Top Continent (2×1) === */
            h('div', {className: 'bento-card bento-topcontinent'},
                h('div', {className: 'bento-value-sm'}, topContinent ? topContinent[0] : '-'),
                h('div', {className: 'bento-label'}, 'Top continente')
            )
        )
    );
};


const WrappedView = ({ trips, selectedYear }) => {
    const yearTrips = trips;
    const label = selectedYear === 'all' ? 'todos los a\u00f1os' : selectedYear;
    if (yearTrips.length === 0) return h('div', {className: 'empty-state'}, h('div', {className: 'empty-state-icon'}, '🎁'), h('div', {className: 'empty-state-text'}, 'No hay viajes en ', label));

    const allDestinations = yearTrips.flatMap(t => t.destinos);
    const uniquePlaces = [...new Set(allDestinations.map(d => d.lugar))];
    const totalDays = yearTrips.reduce((sum, t) => sum + (t.fechaFinal ? Math.ceil((new Date(t.fechaFinal) - new Date(t.fechaInicio)) / (1000 * 60 * 60 * 24)) : 1), 0);
    let totalKm = 0;
    const destinationsWithCoords = allDestinations.filter(d => d.coordinates);
    for (let i = 0; i < destinationsWithCoords.length - 1; i++) {
        const d1 = destinationsWithCoords[i].coordinates;
        const d2 = destinationsWithCoords[i + 1].coordinates;
        totalKm += calculateDistance(d1.lat, d1.lng, d2.lat, d2.lng);
    }
    const allPeople = [...new Set(yearTrips.flatMap(t => t.personas.map(p => p.nombre)))];
    const avgDaysPerTrip = Math.round(totalDays / yearTrips.length);

    return (
        h('div', {className: 'wrapped-container'},
            h('div', {className: 'wrapped-gallery'},
                h('div', {className: 'wrapped-card'},
                    h('div', {className: 'wrapped-card-icon'}, '✈️'),
                    h('div', {className: 'wrapped-card-value'}, yearTrips.length),
                    h('div', {className: 'wrapped-card-label'}, 'Viajes'),
                    h('div', {className: 'wrapped-card-detail'}, 'Un a\u00f1o lleno de aventuras')
                ),
                h('div', {className: 'wrapped-card'},
                    h('div', {className: 'wrapped-card-icon'}, '🗺️'),
                    h('div', {className: 'wrapped-card-value'}, uniquePlaces.length),
                    h('div', {className: 'wrapped-card-label'}, 'Lugares'),
                    h('div', {className: 'wrapped-card-detail'}, 'Cada uno \u00fanico')
                ),
                h('div', {className: 'wrapped-card'},
                    h('div', {className: 'wrapped-card-icon'}, '📅'),
                    h('div', {className: 'wrapped-card-value'}, totalDays),
                    h('div', {className: 'wrapped-card-label'}, 'D\u00edas viajando'),
                    h('div', {className: 'wrapped-card-detail'}, '~', avgDaysPerTrip, ' d\u00edas/viaje')
                ),
                h('div', {className: 'wrapped-card'},
                    h('div', {className: 'wrapped-card-icon'}, '🌍'),
                    h('div', {className: 'wrapped-card-value'}, Math.round(totalKm / 1000), 'K'),
                    h('div', {className: 'wrapped-card-label'}, 'Kil\u00f3metros'),
                    h('div', {className: 'wrapped-card-detail'}, (totalKm / 40075).toFixed(2), 'x la vuelta al mundo')
                ),
                allPeople.length > 0 && (
                    h('div', {className: 'wrapped-card'},
                        h('div', {className: 'wrapped-card-icon'}, '👥'),
                        h('div', {className: 'wrapped-card-value'}, allPeople.length),
                        h('div', {className: 'wrapped-card-label'}, 'Compa\u00f1eros'),
                        h('div', {className: 'wrapped-card-detail'}, 'Momentos compartidos')
                    )
                ),
                h('div', {className: 'wrapped-card wrapped-places-card'},
                    h('div', {className: 'wrapped-card-icon'}, '🏆'),
                    h('h3', {style: {fontSize: '1.4rem', marginBottom: '0.75rem'}}, 'Destinos ', label),
                    h('div', {className: 'wrapped-places-grid'},
                        uniquePlaces.map((place, i) => h('div', {key: i, className: 'wrapped-place-tag'}, place))
                    )
                )
            )
        )
    );
};

// ── Gradient fallbacks per motivo ─────────────────────────────────────────────
const MOTIVO_GRADIENTS = {
    placer:   'linear-gradient(160deg, #6BA3BE 0%, #A8C5A0 100%)',
    negocios: 'linear-gradient(160deg, #4A5568 0%, #718096 100%)',
    evento:   'linear-gradient(160deg, #C9A09A 0%, #D4956A 100%)',
    familia:  'linear-gradient(160deg, #89ACA4 0%, #B7C4A1 100%)',
    estudio:  'linear-gradient(160deg, #A3B1B8 0%, #8B9A6D 100%)',
    otro:     'linear-gradient(160deg, #C4A882 0%, #D9C4A0 100%)',
};
const getGradient = (motivo) => MOTIVO_GRADIENTS[motivo] || MOTIVO_GRADIENTS.otro;

// ── TripsCarousel ─────────────────────────────────────────────────────────────
const TripsCarousel = ({ trips, onEditTrip, onDeleteTrip }) => {
    // centeredId: card that has been scrolled to centre (pre-expand highlight)
    // expandedId: card that is currently expanded inside the track
    const [centeredId, setCenteredId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const trackRef = useRef(null);
    const cardRefs = useRef({});

    const sortedTrips = [...trips].sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));

    // ── helper: is card already roughly centred in the track? ────────────────
    const isCentered = (tripId) => {
        const track = trackRef.current;
        const card  = cardRefs.current[tripId];
        if (!track || !card) return false;
        const trackMid = track.scrollLeft + track.clientWidth / 2;
        const cardMid  = card.offsetLeft  + card.offsetWidth  / 2;
        return Math.abs(cardMid - trackMid) < 40;
    };

    // ── scroll a card to the track centre ────────────────────────────────────
    const scrollToCard = (tripId) => {
        const track = trackRef.current;
        const card  = cardRefs.current[tripId];
        if (!track || !card) return;
        const offset = card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2;
        track.scrollTo({ left: offset, behavior: 'smooth' });
    };

    // ── after expansion, re-centre so the wider card stays centred ───────────
    useEffect(() => {
        if (!expandedId) return;
        // small delay so the card has started growing before we measure
        const t = setTimeout(() => scrollToCard(expandedId), 60);
        return () => clearTimeout(t);
    }, [expandedId]);

    // ── card click logic ──────────────────────────────────────────────────────
    const handleCardClick = (trip, e) => {
        e.stopPropagation(); // prevent track's click-outside from firing

        if (expandedId === trip.id) {
            // clicking the already-expanded card collapses it
            setExpandedId(null);
            return;
        }
        if (expandedId && expandedId !== trip.id) {
            // another card is open — collapse it, then centre & expand the new one
            setExpandedId(null);
            setCenteredId(trip.id);
            scrollToCard(trip.id);
            setTimeout(() => setExpandedId(trip.id), 320);
            return;
        }
        if (!isCentered(trip.id)) {
            // first click on an off-centre card → just centre it
            setCenteredId(trip.id);
            scrollToCard(trip.id);
            return;
        }
        // card is centred and nothing is expanded → expand
        setCenteredId(trip.id);
        setExpandedId(trip.id);
    };

    // ── click on track background → collapse ────────────────────────────────
    const handleTrackClick = () => {
        if (expandedId) setExpandedId(null);
    };

    const collapse = () => setExpandedId(null);

    // ── Escape key ───────────────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') collapse(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // ── tilt on scroll (skip expanded card) ──────────────────────────────────
    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        const updateTilts = () => {
            const trackMid = track.scrollLeft + track.clientWidth / 2;
            sortedTrips.forEach(trip => {
                const card = cardRefs.current[trip.id];
                if (!card || trip.id === expandedId) return;
                const cardMid = card.offsetLeft + card.offsetWidth / 2;
                const norm    = Math.max(-1, Math.min(1, (cardMid - trackMid) / (track.clientWidth * 0.6)));
                card.style.transform = `rotateY(${norm * 22}deg) scale(${1 - Math.abs(norm) * 0.1})`;
            });
        };
        track.addEventListener('scroll', updateTilts, { passive: true });
        updateTilts();
        return () => track.removeEventListener('scroll', updateTilts);
    }, [sortedTrips, expandedId]);

    // ── mouse wheel → horizontal scroll ──────────────────────────────────────
    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        const onWheel = (e) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            e.preventDefault();
            track.scrollLeft += e.deltaY;
        };
        track.addEventListener('wheel', onWheel, { passive: false });
        return () => track.removeEventListener('wheel', onWheel);
    }, []);

    // ── arrow buttons ─────────────────────────────────────────────────────────
    const scrollBy = (dir) => {
        if (!trackRef.current) return;
        trackRef.current.scrollBy({ left: dir * 260, behavior: 'smooth' });
    };

    if (trips.length === 0) {
        return h('div', {className: 'carousel-empty'},
            h(Icon, {name: 'plane', size: 48, color: 'var(--text-muted)'}),
            h('p', null, 'No hay viajes registrados aún')
        );
    }

    return h('div', {className: 'carousel-root'},

        // ── arrow left ────────────────────────────────────────────────────────
        h('button', {
            className: 'carousel-arrow carousel-arrow--left',
            onClick: (e) => { e.stopPropagation(); scrollBy(-1); },
            'aria-label': 'Anterior'
        }, h(Icon, {name: 'chevronL', size: 20})),

        // ── track (click on empty area → collapse) ────────────────────────────
        h('div', {
            className: 'carousel-track',
            ref: trackRef,
            onClick: handleTrackClick
        },
            // spacer so the first card can reach the centre
            h('div', {className: 'carousel-spacer', 'aria-hidden': 'true'}),

            sortedTrips.map(trip => {
                const isExpanded    = expandedId === trip.id;
                const isCenteredNow = centeredId === trip.id && !isExpanded;
                const firstDest     = trip.destinos[0];
                const duracion      = trip.fechaFinal
                    ? Math.ceil((new Date(trip.fechaFinal) - new Date(trip.fechaInicio)) / 86400000) : 1;
                const uniqueCountries = [...new Set(trip.destinos.map(d => {
                    const parts = d.lugar.split(',');
                    return parts[parts.length - 1].trim();
                }))].length;

                return h('div', {
                    key: trip.id,
                    ref: el => { cardRefs.current[trip.id] = el; },
                    className: [
                        'carousel-card',
                        isExpanded    ? 'carousel-card--expanded'  : '',
                        isCenteredNow ? 'carousel-card--centered'  : '',
                    ].filter(Boolean).join(' '),
                    onClick: (e) => handleCardClick(trip, e),
                    style: { background: firstDest?.foto ? 'none' : getGradient(trip.motivo) }
                },
                    // photo background
                    firstDest?.foto && h('div', {
                        className: 'carousel-card__bg-photo',
                        style: { backgroundImage: `url(${firstDest.foto})` }
                    }),

                    // collapsed state content
                    !isExpanded && h('div', {className: 'carousel-card__scrim'}),
                    !isExpanded && h('div', {className: 'carousel-card__tag'},
                        h(Icon, {name: getMotivoIcon(trip.motivo), size: 12, color: 'currentColor', strokeWidth: 2}),
                        h('span', null, getMotivoLabel(trip.motivo))
                    ),
                    !isExpanded && h('div', {className: 'carousel-card__label'},
                        h('div', {className: 'carousel-card__title'}, getTripName(trip)),
                        formatDestinations(trip.destinos) && h('div', {className: 'carousel-card__subtitle'},
                            formatDestinations(trip.destinos)
                        ),
                        h('div', {className: 'carousel-card__date'},
                            formatDateRange(trip.fechaInicio, trip.fechaFinal)
                        )
                    ),

                    // expanded state content
                    isExpanded && h('div', {
                        className: 'carousel-card__expanded-panel',
                        onClick: e => e.stopPropagation()
                    },
                        h('button', {
                            className: 'carousel-card__close',
                            onClick: (e) => { e.stopPropagation(); collapse(); },
                            'aria-label': 'Cerrar'
                        }, h(Icon, {name: 'close', size: 18, strokeWidth: 2})),

                        h('h2', {className: 'carousel-exp__title'}, getTripName(trip)),
                        formatDestinations(trip.destinos) && h('div', {className: 'carousel-exp__subtitle'},
                            formatDestinations(trip.destinos)
                        ),
                        h('div', {className: 'carousel-exp__date'},
                            h(Icon, {name: 'calendar', size: 14, color: 'var(--text-secondary)', strokeWidth: 1.8}),
                            h('span', null, formatDateRange(trip.fechaInicio, trip.fechaFinal))
                        ),
                        h('div', {className: 'carousel-exp__stats'},
                            h('div', {className: 'carousel-exp__stat'},
                                h(Icon, {name: 'clock', size: 15, strokeWidth: 1.8}),
                                h('span', {className: 'carousel-exp__stat-value'}, duracion),
                                h('span', {className: 'carousel-exp__stat-label'}, 'días')
                            ),
                            h('div', {className: 'carousel-exp__divider'}),
                            h('div', {className: 'carousel-exp__stat'},
                                h(Icon, {name: 'pin', size: 15, strokeWidth: 1.8}),
                                h('span', {className: 'carousel-exp__stat-value'}, trip.destinos.length),
                                h('span', {className: 'carousel-exp__stat-label'}, 'lugares')
                            ),
                            h('div', {className: 'carousel-exp__divider'}),
                            h('div', {className: 'carousel-exp__stat'},
                                h(Icon, {name: 'globe', size: 15, strokeWidth: 1.8}),
                                h('span', {className: 'carousel-exp__stat-value'}, uniqueCountries),
                                h('span', {className: 'carousel-exp__stat-label'}, uniqueCountries === 1 ? 'país' : 'países')
                            ),
                            h('div', {className: 'carousel-exp__divider'}),
                            h('div', {className: 'carousel-exp__stat'},
                                h(Icon, {name: getMotivoIcon(trip.motivo), size: 15, strokeWidth: 1.8}),
                                h('span', {className: 'carousel-exp__stat-label'}, getMotivoLabel(trip.motivo))
                            ),
                            trip.personas.length > 0 && h('div', {className: 'carousel-exp__divider'}),
                            trip.personas.length > 0 && h('div', {className: 'carousel-exp__stat'},
                                h(Icon, {name: 'users', size: 15, strokeWidth: 1.8}),
                                h('span', {className: 'carousel-exp__stat-value'}, trip.personas.length),
                                h('span', {className: 'carousel-exp__stat-label'}, 'personas')
                            )
                        ),
                        trip.destinos.length > 1 && h('div', {className: 'carousel-exp__dests'},
                            trip.destinos.map((d, i) =>
                                h('div', {key: i, className: 'carousel-exp__dest'},
                                    h(Icon, {name: 'pin', size: 12, color: 'var(--primary)', strokeWidth: 2}),
                                    h('span', null, d.lugar)
                                )
                            )
                        ),
                        trip.notas && h('p', {className: 'carousel-exp__notes'}, trip.notas),
                        h('div', {className: 'carousel-exp__actions'},
                            h('button', {
                                className: 'carousel-exp__btn carousel-exp__btn--edit',
                                onClick: (e) => { e.stopPropagation(); collapse(); onEditTrip(trip); }
                            }, h(Icon, {name: 'edit', size: 14, strokeWidth: 2}), h('span', null, 'Editar')),
                            h('button', {
                                className: 'carousel-exp__btn carousel-exp__btn--delete',
                                onClick: (e) => { e.stopPropagation(); collapse(); onDeleteTrip(trip.id); }
                            }, h(Icon, {name: 'trash', size: 14, strokeWidth: 2}), h('span', null, 'Eliminar'))
                        )
                    )
                );
            }),

            // spacer so the last card can reach the centre
            h('div', {className: 'carousel-spacer', 'aria-hidden': 'true'})
        ),

        // ── arrow right ───────────────────────────────────────────────────────
        h('button', {
            className: 'carousel-arrow carousel-arrow--right',
            onClick: (e) => { e.stopPropagation(); scrollBy(1); },
            'aria-label': 'Siguiente'
        }, h(Icon, {name: 'chevronR', size: 20}))
    );
};

// ── Legacy wrapper (kept so existing callers don't break) ─────────────────────
const TripsListView = ({ trips, onTripClick, onEditTrip, onDeleteTrip }) => {
    return h(TripsCarousel, { trips, onEditTrip, onDeleteTrip });
};

// ── Supabase data-mapping helpers ─────────────────────────────────────────────

const dbToTrip = (row) => ({
    id:          row.id,
    trip_name:   row.trip_name   || '',
    fechaInicio: row.start_date,
    fechaFinal:  row.end_date   || '',
    motivo:      row.trip_type  || 'otro',
    destinos:    row.destinations || [],
    personas:    row.personas     || [],
    notas:       row.notas        || '',
    createdAt:   row.created_at,
});

const tripToDb = (trip, userId) => {
    const days = trip.fechaFinal
        ? Math.ceil((new Date(trip.fechaFinal) - new Date(trip.fechaInicio)) / 86400000)
        : 1;
    const countries = new Set(
        (trip.destinos || []).map(d => {
            const parts = (d.lugar || '').split(',');
            return parts[parts.length - 1].trim();
        })
    ).size;
    // Use explicit trip_name if set; fall back to joined destinations
    const tripName = (trip.trip_name || '').trim()
        || (trip.destinos || []).map(d => d.lugar).join(' → ')
        || null;
    return {
        user_id:           userId,
        start_date:        trip.fechaInicio  || null,
        end_date:          trip.fechaFinal   || null,
        trip_type:         trip.motivo       || 'otro',
        destinations:      trip.destinos     || [],
        personas:          trip.personas     || [],
        notas:             trip.notas        || null,
        trip_name:         tripName,
        days_count:        days,
        cities_visited:    (trip.destinos || []).length,
        countries_visited: countries,
    };
};

// ─────────────────────────────────────────────────────────────────────────────

const App = () => {
    const [activeTab, setActiveTab] = useState('trips');
    const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
    const yearDropdownRef = useRef(null);
    const [trips, setTrips] = useState([]);
    const [profile, setProfile] = useState(null);
    const [homeCoords, setHomeCoords] = useState(null);
    const [selectedYear, setSelectedYear] = useState('all');
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [editingTrip, setEditingTrip] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, danger: false });
    const [lastImportDate, setLastImportDate] = useState(null);
    const [authUser, setAuthUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const [tripsLoading, setTripsLoading] = useState(true);

    const showToast = (message, type) => {
        type = type || 'success';
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    const showConfirm = (title, message, onConfirm, danger) => {
        setConfirmDialog({ isOpen: true, title, message, onConfirm: () => { onConfirm(); setConfirmDialog(d => ({...d, isOpen: false})); }, danger: !!danger });
    };

    // ── Auth guard: redirect to login if not authenticated ───────────────────
    useEffect(() => {
        // onAuthStateChange fires immediately with the current session,
        // so we use it as the single source of truth (no separate getSession call needed).
        const { data: { subscription } } = window.supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                window.location.href = 'login.html';
            } else {
                setAuthUser(session.user);
                setAuthReady(true);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // ── Supabase: load profile + migrate localStorage + load trips + realtime ──
    useEffect(() => {
        if (!authReady || !authUser) return;

        let channel = null;

        const init = async () => {
            setTripsLoading(true);

            // ── 1. PROFILE ─────────────────────────────────────────────────────
            try {
                const { data: profileRow, error: profileErr } = await window.supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', authUser.id)
                    .single();

                if (profileRow && !profileErr) {
                    const prof = { nombre: profileRow.nombre, ubicacion: profileRow.ubicacion, emoji: profileRow.emoji };
                    setProfile(prof);
                    if (profileRow.last_import_at) setLastImportDate(profileRow.last_import_at);
                    if (prof.ubicacion) {
                        geocodePlace(prof.ubicacion).then(coords => { if (coords) setHomeCoords(coords); });
                    }
                    setActiveTab('trips');
                } else {
                    // Migrate profile from localStorage if present
                    const localProfileRaw = localStorage.getItem('nomadAtlasProfile');
                    if (localProfileRaw) {
                        try {
                            const localProf = JSON.parse(localProfileRaw);
                            await window.supabase.from('profiles').upsert({
                                user_id:   authUser.id,
                                nombre:    localProf.nombre    || '',
                                ubicacion: localProf.ubicacion || '',
                                emoji:     localProf.emoji     || '🌍',
                                updated_at: new Date().toISOString(),
                            });
                            setProfile(localProf);
                            localStorage.removeItem('nomadAtlasProfile');
                            if (localProf.ubicacion) {
                                geocodePlace(localProf.ubicacion).then(coords => { if (coords) setHomeCoords(coords); });
                            }
                            setActiveTab('trips');
                        } catch(e) { console.error('Profile migration error:', e); }
                    }
                }
            } catch(e) { console.error('Profile load error:', e); }

            // ── 2. MIGRATE localStorage trips (once per user) ─────────────────
            const migKey = 'nomadAtlas_migrated_' + authUser.id;
            if (localStorage.getItem(migKey) !== 'done') {
                try {
                    const localTripsRaw = localStorage.getItem('nomadAtlasTrips');
                    const localTrips = localTripsRaw ? JSON.parse(localTripsRaw) : [];
                    if (localTrips.length > 0) {
                        const rows = localTrips.map(t => tripToDb(t, authUser.id));
                        const { error: migErr } = await window.supabase.from('trips').insert(rows);
                        if (!migErr) {
                            localStorage.removeItem('nomadAtlasTrips');
                            localStorage.setItem(migKey, 'done');
                        } else {
                            console.error('Trip migration error:', migErr);
                            showToast('Error migrando viajes locales. Se reintentará al próximo inicio de sesión.', 'warning');
                        }
                    } else {
                        // Nothing to migrate — mark done so we don't check again
                        localStorage.setItem(migKey, 'done');
                    }
                } catch(e) { console.error('Migration error:', e); }
            }

            // ── 3. LOAD TRIPS FROM SUPABASE ───────────────────────────────────
            try {
                const { data: rows, error: loadErr } = await window.supabase
                    .from('trips')
                    .select('*')
                    .eq('user_id', authUser.id)
                    .order('start_date', { ascending: false });
                if (!loadErr) {
                    const loadedTrips = (rows || []).map(dbToTrip);
                    setTrips(loadedTrips);
                    setTripsLoading(false);

                    // ── 4b. BACKFILL trip_name for existing trips (one-time) ───
                    const tripNameMigKey = 'nomadAtlas_tripname_migrated_' + authUser.id;
                    if (localStorage.getItem(tripNameMigKey) !== 'done') {
                        const tripsNeedingName = loadedTrips.filter(t => !t.trip_name);
                        if (tripsNeedingName.length > 0) {
                            console.log('[Migration] Backfilling trip_name for', tripsNeedingName.length, 'trip(s)...');
                            for (const t of tripsNeedingName) {
                                const generated = (t.destinos || []).map(d => d.lugar).join(' \u2192 ') || 'Viaje sin nombre';
                                await window.supabase.from('trips')
                                    .update({ trip_name: generated })
                                    .eq('id', t.id);
                                console.log('[Migration] Trip', t.id, ': trip_name set to "' + generated + '"');
                            }
                            // Update local state so UI reflects names immediately
                            setTrips(prev => prev.map(t => {
                                if (!t.trip_name) {
                                    return { ...t, trip_name: (t.destinos || []).map(d => d.lugar).join(' \u2192 ') || 'Viaje sin nombre' };
                                }
                                return t;
                            }));
                        }
                        localStorage.setItem(tripNameMigKey, 'done');
                        console.log('[Migration] trip_name backfill complete.');
                    }

                    // ── 5. BACKGROUND PHOTO MIGRATION (base64 → Storage) ───────
                    // Silently upload any base64 photos still in the DB and replace with URLs
                    const migratePhotos = async () => {
                        for (const trip of loadedTrips) {
                            let changed = false;
                            const newDests = await Promise.all(
                                (trip.destinos || []).map(async d => {
                                    if (d.foto && d.foto.startsWith('data:')) {
                                        const url = await uploadPhotoToStorage(authUser.id, d.foto);
                                        if (url) { changed = true; return { ...d, foto: url }; }
                                    }
                                    return d;
                                })
                            );
                            const newPersonas = await Promise.all(
                                (trip.personas || []).map(async p => {
                                    if (p.foto && p.foto.startsWith('data:')) {
                                        const url = await uploadPhotoToStorage(authUser.id, p.foto);
                                        if (url) { changed = true; return { ...p, foto: url }; }
                                    }
                                    return p;
                                })
                            );
                            if (changed) {
                                setTrips(prev => prev.map(t => t.id === trip.id
                                    ? { ...t, destinos: newDests, personas: newPersonas } : t));
                                await window.supabase.from('trips')
                                    .update({ destinations: newDests, personas: newPersonas })
                                    .eq('id', trip.id);
                            }
                        }
                    };
                    if (loadedTrips.length > 0) migratePhotos(); // fire-and-forget
                } else {
                    console.error('Trips load error:', loadErr);
                    showToast('Error cargando viajes. Verifica tu conexión.', 'error');
                    setTripsLoading(false);
                }
            } catch(e) { console.error('Trips load error:', e); setTripsLoading(false); }

            // ── 4. REAL-TIME SUBSCRIPTION ──────────────────────────────────────
            channel = window.supabase
                .channel('trips-realtime-' + authUser.id)
                .on('postgres_changes', {
                    event:  '*',
                    schema: 'public',
                    table:  'trips',
                    filter: 'user_id=eq.' + authUser.id,
                }, (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setTrips(prev => {
                            // Skip if already present (own optimistic insert)
                            if (prev.some(t => t.id === payload.new.id)) return prev;
                            return [dbToTrip(payload.new), ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setTrips(prev => prev.map(t =>
                            t.id === payload.new.id ? dbToTrip(payload.new) : t
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        setTrips(prev => prev.filter(t => t.id !== payload.old.id));
                    }
                })
                .subscribe();
        };

        init();

        return () => {
            if (channel) channel.unsubscribe();
        };
    }, [authReady, authUser]);

    // Close year dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) {
                setYearDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getContentBg = () => {
        const bgMap = { trips: 'var(--bg-trips)', map: 'var(--bg-map)', timeline: 'var(--bg-timeline)', dashboard: 'var(--bg-dashboard)', settings: 'var(--bg-settings)' };
        return bgMap[activeTab] || 'var(--light)';
    };

    const getTabColor = () => {
        const tabMap = { trips: 'var(--tab-trips)', map: 'var(--tab-map)', timeline: 'var(--tab-timeline)', dashboard: 'var(--tab-dashboard)' };
        return tabMap[activeTab] || '#EDE5DB';
    };

    const handleAddTrip = async (trip) => {
        if (editingTrip) {
            // ── EDIT: optimistic update then persist ───────────────────────────
            const prevTrip = trips.find(t => t.id === trip.id);
            setTrips(prev => prev.map(t => t.id === trip.id ? trip : t));
            setEditingTrip(null);
            setShowAddForm(false);
            const { error } = await window.supabase
                .from('trips')
                .update(tripToDb(trip, authUser.id))
                .eq('id', trip.id);
            if (error) {
                console.error('Update error:', error);
                // Rollback
                setTrips(prev => prev.map(t => t.id === trip.id ? prevTrip : t));
                showToast('Error guardando cambios. Intenta de nuevo.', 'error');
            }
        } else {
            // ── CREATE: optimistic insert with tempId ─────────────────────────
            const tempId = 'temp-' + Date.now();
            const optimistic = { ...trip, id: tempId };
            setTrips(prev => [optimistic, ...prev]);
            setShowAddForm(false);
            const { data, error } = await window.supabase
                .from('trips')
                .insert(tripToDb(trip, authUser.id))
                .select()
                .single();
            if (error) {
                console.error('Insert error:', error);
                setTrips(prev => prev.filter(t => t.id !== tempId));
                showToast('Error guardando viaje. Verifica tu conexión.', 'error');
            } else {
                // Replace temp row with real UUID row from Supabase
                setTrips(prev => prev.map(t => t.id === tempId ? dbToTrip(data) : t));
            }
        }
    };

    const handleImportTrips = async (newTrips) => {
        // Optimistic: assign temp IDs so UI updates instantly
        const withTempIds = newTrips.map((t, i) => ({ ...t, id: 'temp-' + Date.now() + '-' + i }));
        setTrips(prev => [...withTempIds, ...prev]);
        const now = new Date().toISOString();
        setLastImportDate(now);
        setActiveTab('trips');
        // Persist last_import_at to Supabase (fire-and-forget)
        if (authUser) {
            window.supabase.from('profiles').upsert({
                user_id: authUser.id, last_import_at: now, updated_at: now,
            });
        }

        const rows = newTrips.map(t => tripToDb(t, authUser.id));
        const { data, error } = await window.supabase.from('trips').insert(rows).select();
        if (error) {
            console.error('Import error:', error);
            // Rollback temp rows
            setTrips(prev => prev.filter(t => !String(t.id).startsWith('temp-')));
            showToast('Error importando viajes. Verifica tu conexión.', 'error');
        } else {
            // Swap temp rows for real UUID rows
            setTrips(prev => {
                const real = (data || []).map(dbToTrip);
                return [...real, ...prev.filter(t => !String(t.id).startsWith('temp-'))];
            });
        }
    };

    const handleUpdateProfile = async (newProfile) => {
        setProfile(newProfile);
        if (newProfile.ubicacion) {
            geocodePlace(newProfile.ubicacion).then(coords => { if (coords) setHomeCoords(coords); });
        }
        setActiveTab('map');
        try {
            await window.supabase.from('profiles').upsert({
                user_id:    authUser.id,
                nombre:     newProfile.nombre    || '',
                ubicacion:  newProfile.ubicacion || '',
                emoji:      newProfile.emoji     || '🌍',
                updated_at: new Date().toISOString(),
            });
        } catch(e) {
            console.error('Profile save error:', e);
            showToast('Error guardando perfil. Intenta de nuevo.', 'error');
        }
    };

    const handleEditTrip = (trip) => { setEditingTrip(trip); setShowAddForm(true); setActiveTab('trips'); };

    const handleLogout = async () => {
        await window.supabase.auth.signOut();
        // onAuthStateChange will redirect to login.html automatically
    };

    const handleDeleteTrip = (tripId) => {
        showConfirm(
            'Eliminar Viaje',
            'Este viaje se eliminara permanentemente. Esta accion no se puede deshacer.',
            async () => {
                // Optimistic: remove from UI immediately
                const removed = trips.find(t => t.id === tripId);
                setTrips(prev => prev.filter(t => t.id !== tripId));
                setSelectedTrip(null);
                showToast('Viaje eliminado', 'success');
                // Delete photos from Storage (fire-and-forget)
                if (removed) deletePhotosFromStorage(removed);
                // Persist to Supabase
                const { error } = await window.supabase
                    .from('trips')
                    .delete()
                    .eq('id', tripId);
                if (error) {
                    console.error('Delete error:', error);
                    // Rollback — put the trip back
                    if (removed) setTrips(prev => [removed, ...prev]);
                    showToast('Error eliminando viaje. Intenta de nuevo.', 'error');
                }
            },
            true
        );
    };

    const handleExportJSON = () => {
        const data = { trips, profile, exportedAt: new Date().toISOString(), version: 1 };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nomad-atlas-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup JSON descargado', 'success');
    };

    const handleExportCSV = () => {
        const header = 'tripName,tripId,tripFechaInicio,tripFechaFinal,motivo,personas,notas,lugar,destFechaInicio,destFechaFinal';
        const rows = [];
        trips.forEach((trip, tripIndex) => {
            trip.destinos.forEach(dest => {
                const escapeCsv = (val) => { const str = String(val || ''); return str.includes(',') || str.includes('"') || str.includes('\n') ? '"' + str.replace(/"/g, '""') + '"' : str; };
                rows.push([escapeCsv(getTripName(trip)), tripIndex + 1, trip.fechaInicio, trip.fechaFinal || '', trip.motivo, trip.personas.map(p => p.nombre).join('; '), escapeCsv(trip.notas), escapeCsv(dest.lugar), dest.fechaInicio || '', dest.fechaFinal || ''].join(','));
            });
        });
        const csv = header + '\n' + rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nomad-atlas-viajes-' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
        URL.revokeObjectURL(url);
        showToast('CSV descargado', 'success');
    };

    const handleImportJSON = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!data.trips || !Array.isArray(data.trips)) {
                    showToast('Archivo JSON invalido: no contiene viajes', 'error');
                    return;
                }
                showConfirm(
                    'Restaurar Backup',
                    'Este backup contiene ' + data.trips.length + ' viajes' + (data.profile ? ' y un perfil' : '') + '. Los datos actuales seran reemplazados. Continuar?',
                    async () => {
                        // Delete existing Supabase data first
                        if (authUser) {
                            await window.supabase.from('trips').delete().eq('user_id', authUser.id);
                        }
                        // Re-import via the existing import handler (handles optimistic + Supabase insert)
                        await handleImportTrips(data.trips);
                        if (data.profile && authUser) {
                            await handleUpdateProfile(data.profile);
                        }
                        const now = new Date().toISOString();
                        setLastImportDate(now);
                        if (authUser) {
                            window.supabase.from('profiles').upsert({
                                user_id: authUser.id, last_import_at: now, updated_at: now,
                            });
                        }
                        showToast('Backup restaurado: ' + data.trips.length + ' viajes', 'success');
                    },
                    true
                );
            } catch (err) {
                showToast('Error al leer el archivo JSON', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleClearAllData = () => {
        showConfirm(
            'Borrar Todos los Datos',
            'Se eliminaran TODOS los viajes y tu perfil. Esta accion no se puede deshacer. Te recomendamos exportar un backup antes.',
            async () => {
                // Optimistic: clear UI immediately
                setTrips([]);
                setProfile(null);
                setHomeCoords(null);
                localStorage.removeItem('nomadAtlasTrips');
                localStorage.removeItem('nomadAtlasProfile');
                if (authUser) {
                    localStorage.removeItem('nomadAtlas_migrated_' + authUser.id);
                }
                setLastImportDate(null);
                setActiveTab('settings');
                showToast('Todos los datos han sido eliminados', 'warning');
                // Persist deletions to Supabase
                if (authUser) {
                    await window.supabase.from('trips').delete().eq('user_id', authUser.id);
                    await window.supabase.from('profiles').delete().eq('user_id', authUser.id);
                    // Delete all photos from Storage for this user
                    const { data: files } = await window.supabase.storage
                        .from('trip-photos')
                        .list(authUser.id);
                    if (files && files.length > 0) {
                        const paths = files.map(f => authUser.id + '/' + f.name);
                        await window.supabase.storage.from('trip-photos').remove(paths);
                    }
                }
            },
            true
        );
    };

    const allPeople = [...new Map(trips.flatMap(t => t.personas).map(p => [p.nombre, p])).values()];
    const allDestinations = [...new Map(trips.flatMap(t => t.destinos).map(d => [d.lugar, { lugar: d.lugar, coordinates: d.coordinates }])).values()];
    const availableYears = [...new Set(trips.map(t => new Date(t.fechaInicio).getFullYear()))].sort((a, b) => b - a);
    const filteredTrips = selectedYear === 'all' ? trips : trips.filter(t => new Date(t.fechaInicio).getFullYear() === parseInt(selectedYear));

    // Bound photo upload callback — closes over authUser.id
    const uploadPhoto = authUser
        ? (dataUrl) => uploadPhotoToStorage(authUser.id, dataUrl)
        : null;

    // Don't render anything until auth state is resolved (avoids flash + black screen)
    if (!authReady) return null;

    return (
        h('div', {className: 'app-container'},
            // ===== FOLDER-TAB NAVIGATION =====
            h('nav', {className: 'folder-nav'},
                h('div', {className: 'folder-nav-inner'},
                    // Logo placeholder (top-left)
                    h('span', {className: 'folder-nav-brand'}, 'Nomad Atlas'),
                    // Folder tabs (right)
                    h('div', {className: 'folder-tabs'},
                        h('button', {
                            className: 'folder-tab' + (activeTab === 'trips' ? ' active' : ''),
                            onClick: () => setActiveTab('trips'),
                            disabled: !profile,
                            style: activeTab === 'trips' ? {background: 'var(--tab-trips)'} : {}
                        }, 'Trips'),
                        h('button', {
                            className: 'folder-tab' + (activeTab === 'map' ? ' active' : ''),
                            onClick: () => setActiveTab('map'),
                            disabled: !profile,
                            style: activeTab === 'map' ? {background: 'var(--tab-map)'} : {}
                        }, 'Map'),
                        h('button', {
                            className: 'folder-tab' + (activeTab === 'timeline' ? ' active' : ''),
                            onClick: () => setActiveTab('timeline'),
                            disabled: !profile,
                            style: activeTab === 'timeline' ? {background: 'var(--tab-timeline)'} : {}
                        }, 'Timeline'),
                        h('button', {
                            className: 'folder-tab' + (activeTab === 'dashboard' ? ' active' : ''),
                            onClick: () => setActiveTab('dashboard'),
                            disabled: !profile,
                            style: activeTab === 'dashboard' ? {background: 'var(--tab-dashboard)'} : {}
                        }, 'Dashboard')
                    ),

                    // Auth bar (user email + logout)
                    authUser && h('div', {className: 'auth-bar'},
                        h('span', {className: 'auth-bar__email', title: authUser.email}, authUser.email),
                        h('button', {className: 'auth-bar__logout', onClick: handleLogout}, 'Salir')
                    )
                )
            ),

            // ===== CONTENT AREA with dynamic background =====
            h('div', {className: 'main-content-bg', style: {backgroundColor: getContentBg()}},
                h('main', {className: 'main-content'},

                    activeTab === 'settings' && (
                        h(React.Fragment, null,
                            h(ProfileView, {profile: profile, onUpdateProfile: handleUpdateProfile}),
                            profile && h(DataManagementPanel, {trips: trips, lastImportDate: lastImportDate, onExportJSON: handleExportJSON, onExportCSV: handleExportCSV, onImportJSON: handleImportJSON, onClearAll: handleClearAllData})
                        )
                    ),

                    activeTab === 'map' && profile && (
                        h('div', {className: 'map-container'}, h(MapView, {trips: filteredTrips, homeCoords: homeCoords, onTripClick: setSelectedTrip}))
                    ),

                    activeTab === 'trips' && profile && (
                        tripsLoading
                            ? h('div', {className: 'empty-state', style: {paddingTop: '4rem'}},
                                h('div', {className: 'loading'}),
                                h('div', {className: 'empty-state-text', style: {marginTop: '1rem', fontSize: '0.95rem', color: 'var(--text-muted)'}}, 'Cargando viajes...')
                              )
                            : h(React.Fragment, null,
                                h(TripsListView, {trips: filteredTrips, onTripClick: setSelectedTrip, onEditTrip: (trip) => { handleEditTrip(trip); setShowAddForm(true); }, onDeleteTrip: handleDeleteTrip}),
                                (showAddForm || editingTrip) && (
                                    h(AddTripForm, {onAddTrip: handleAddTrip, allPeople: allPeople, allDestinations: allDestinations, editingTrip: editingTrip, onCancelEdit: () => { setEditingTrip(null); setShowAddForm(false); }, existingTrips: trips, showToast: showToast, onImportTrips: handleImportTrips, uploadPhoto: uploadPhoto})
                                ),
                                h('div', {className: 'trips-add-bar'},
                                    h('button', {
                                        className: 'trips-add-btn' + (showAddForm ? ' trips-add-btn--open' : ''),
                                        onClick: () => { setEditingTrip(null); setShowAddForm(!showAddForm); }
                                    },
                                        h('svg', {width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round'},
                                            showAddForm
                                                ? h('path', {d: 'M18 6 6 18M6 6l12 12'})
                                                : h(React.Fragment, null, h('line', {x1: 12, y1: 5, x2: 12, y2: 19}), h('line', {x1: 5, y1: 12, x2: 19, y2: 12}))
                                        ),
                                        showAddForm ? 'Cerrar' : 'Nuevo Viaje'
                                    )
                                )
                              )
                    ),

                    activeTab === 'timeline' && profile && h(TimelineView, {trips: filteredTrips, onTripClick: setSelectedTrip}),

                    activeTab === 'dashboard' && profile && h(DashboardView, {trips: filteredTrips, homeCoords: homeCoords})
                )
            ),

            // ===== SETTINGS BUTTON (fixed bottom-left) =====
            h('button', {
                className: 'settings-btn-fixed' + (activeTab === 'settings' ? ' active' : ''),
                onClick: () => setActiveTab('settings'),
                title: 'Settings'
            },
                h('svg', {width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round'},
                    h('circle', {cx: 12, cy: 12, r: 3}),
                    h('path', {d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'})
                )
            ),

            // ===== YEAR DROPDOWN (fixed bottom-right) =====
            profile && availableYears.length > 0 && (
                h('div', {className: 'year-dropdown-wrapper', ref: yearDropdownRef},
                    h('button', {
                        className: 'year-dropdown-btn' + (yearDropdownOpen ? ' open' : ''),
                        onClick: () => setYearDropdownOpen(!yearDropdownOpen)
                    },
                        h('span', null, selectedYear === 'all' ? 'All Years' : selectedYear),
                        h('svg', {width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round'},
                            h('polyline', {points: '6 9 12 15 18 9'})
                        )
                    ),
                    yearDropdownOpen && (
                        h('div', {className: 'year-dropdown-menu'},
                            h('button', {
                                className: 'year-dropdown-item' + (selectedYear === 'all' ? ' active' : ''),
                                onClick: () => { setSelectedYear('all'); setYearDropdownOpen(false); }
                            }, 'All Years'),
                            availableYears.map(y => (
                                h('button', {
                                    key: y,
                                    className: 'year-dropdown-item' + (selectedYear === String(y) ? ' active' : ''),
                                    onClick: () => { setSelectedYear(String(y)); setYearDropdownOpen(false); }
                                }, y)
                            ))
                        )
                    )
                )
            ),

            selectedTrip && h(TripDetailModal, {trip: selectedTrip, onClose: () => setSelectedTrip(null), homeCoords: homeCoords, onDelete: handleDeleteTrip, onEdit: handleEditTrip}),
            h(ConfirmDialog, Object.assign({}, confirmDialog, {onCancel: () => setConfirmDialog(d => ({...d, isOpen: false}))})),
            h(ToastContainer, {toasts: toasts})
        )
    );
};

ReactDOM.render(h(App, null), document.getElementById('root'));