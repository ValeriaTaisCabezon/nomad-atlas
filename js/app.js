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

const safeSetItem = (key, value, showToast) => {
    try { localStorage.setItem(key, value); }
    catch (e) { if (showToast) showToast('Almacenamiento lleno. Intenta eliminar fotos de algunos viajes.', 'error'); console.error('localStorage quota exceeded:', e); }
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
            rawEntries.push({ tripId, fechaInicio, fechaFinal, motivo, personas: personas ? personas.split(';').map(n => ({ nombre: n.trim(), foto: null })).filter(p => p.nombre) : [], notas, lugar, destFechaInicio, destFechaFinal, sourceRow: i + 1 });
        } catch (e) { errors.push({ row: i + 1, message: 'Error de parseo: ' + e.message }); }
    }
    const tripMap = new Map();
    rawEntries.forEach(entry => {
        const groupKey = entry.tripId || entry.fechaInicio;
        if (!tripMap.has(groupKey)) {
            tripMap.set(groupKey, { id: Date.now() + Math.floor(Math.random() * 10000), fechaInicio: entry.fechaInicio, fechaFinal: entry.fechaFinal, motivo: entry.motivo, personas: entry.personas, destinos: [], notas: entry.notas, createdAt: new Date().toISOString() });
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
                    h('h3', {className: 'trip-list-card-title'}, trip.destinos.map(d => d.lugar).join(' → ')),
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
                marker.bindPopup(`<b>${trip.destinos.map(d => d.lugar).join(' → ')}</b><br>${getMotivoEmoji(trip.motivo)} ${trip.motivo}`);
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
                    h('h2', {className: 'trip-detail-title'}, trip.destinos.map(d => d.lugar).join(' → ')),
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

const DestinoCard = ({ destino, index, formData, onSave, onRemove, isGeocoding, setIsGeocoding }) => {
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
                setLocal(prev => ({ ...prev, foto: compressed }));
                setLocalPreview(compressed);
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

const AddTripForm = ({ onAddTrip, allPeople, allDestinations, editingTrip, onCancelEdit, existingTrips, showToast, onImportTrips }) => {
    const [formData, setFormData] = useState(editingTrip || { fechaInicio: '', fechaFinal: '', motivo: 'placer', personas: [], destinos: [], notas: '' });
    const [currentPerson, setCurrentPerson] = useState({ nombre: '', foto: null });
    const [personPreviewUrl, setPersonPreviewUrl] = useState(null);
    const [isGeocoding, setIsGeocoding] = useState(false);

    useEffect(() => { if (editingTrip) setFormData(editingTrip); }, [editingTrip]);

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
                setCurrentPerson(prev => ({ ...prev, foto: compressed }));
                setPersonPreviewUrl(compressed);
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


    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.destinos.length === 0) { showToast('Agrega al menos un destino', 'warning'); return; }
        const trip = editingTrip ? { ...formData } : { ...formData, id: Date.now(), createdAt: new Date().toISOString() };
        onAddTrip(trip);
        if (!editingTrip) setFormData({ fechaInicio: '', fechaFinal: '', motivo: 'placer', personas: [], destinos: [], notas: '' });
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
                                    }}, '📍 ', dest.lugar)
                                ))
                            )
                        )
                    ),

                    h('div', {className: 'destinations-list'},
                        formData.destinos.map((destino, index) => (
                            h(DestinoCard, {key: index, destino: destino, index: index, formData: formData,
                                onSave: (idx, updated) => { const nd = [...formData.destinos]; nd[idx] = updated; setFormData({...formData, destinos: nd}); },
                                onRemove: (idx) => setFormData({...formData, destinos: formData.destinos.filter((_, i) => i !== idx)}),
                                isGeocoding: isGeocoding, setIsGeocoding: setIsGeocoding
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
                        h('tr', null, h('th', null), h('th', null, 'Fecha'), h('th', null, 'Destinos'), h('th', null, 'Motivo'), h('th', null, 'Personas'), h('th', null, 'Estado'))
                    ),
                    h('tbody', null,
                        parsedData.trips.map((trip, i) => (
                            h('tr', {key: i, className: trip._isDuplicate ? 'duplicate' : ''},
                                h('td', null, h('input', {type: 'checkbox', checked: selectedTrips.has(i), onChange: () => toggleTrip(i)})),
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
            h('div', {className: 'csv-help'}, 'Sube un archivo CSV con tus viajes. El encabezado debe incluir columnas como: tripId, tripFechaInicio, tripFechaFinal, motivo, personas, notas, lugar, destFechaInicio, destFechaFinal'),
            h('div', {className: 'csv-example'}, 'tripId,tripFechaInicio,tripFechaFinal,motivo,personas,notas,lugar,destFechaInicio,destFechaFinal'),
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
                                                        h('div', {className: 'timeline-trip-mini-title'}, trip.destinos.map(d => d.lugar).join(', ')),
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
    if (trips.length === 0) return h('div', {className: 'empty-state'}, h('div', {className: 'empty-state-icon'}, '📊'), h('div', {className: 'empty-state-text'}, 'Agrega viajes para ver tus m\u00e9tricas'));

    // --- Section 1: Overview ---
    const totalTrips = trips.length;
    const allDest = trips.flatMap(t => t.destinos);
    const uniquePlaces = new Set(allDest.map(d => d.lugar)).size;
    const totalDays = trips.reduce((sum, t) => sum + Math.max(1, t.fechaFinal ? Math.ceil((new Date(t.fechaFinal) - new Date(t.fechaInicio)) / 86400000) : 1), 0);
    const avgTripLength = Math.round(totalDays / totalTrips);
    const longestTrip = trips.reduce((best, t) => { const d = Math.max(1, t.fechaFinal ? Math.ceil((new Date(t.fechaFinal) - new Date(t.fechaInicio)) / 86400000) : 1); return d > best.days ? { name: t.destinos.map(dd => dd.lugar).join(', '), days: d } : best; }, { name: '', days: 0 });
    let totalKm = 0;
    if (homeCoords) {
        trips.forEach(trip => {
            let last = homeCoords;
            trip.destinos.forEach(d => { if (d.coordinates) { totalKm += calculateDistance(last.lat, last.lng, d.coordinates.lat, d.coordinates.lng); last = d.coordinates; } });
            totalKm += calculateDistance(last.lat, last.lng, homeCoords.lat, homeCoords.lng);
        });
    }

    // --- Section 2: Travel Patterns ---
    const monthCounts = Array(12).fill(0);
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    trips.forEach(t => { monthCounts[new Date(t.fechaInicio).getMonth()]++; });
    const maxMonth = Math.max(...monthCounts);
    const busiestMonthIdx = monthCounts.indexOf(maxMonth);

    // Southern hemisphere seasons (Argentina)
    const seasonMap = [0,0,1,1,1,2,2,2,3,3,3,0]; // Dec-Feb=Verano(0), Mar-May=Otoño(1), Jun-Aug=Invierno(2), Sep-Nov=Primavera(3)
    const seasonNames = ['☀️ Verano', '🍂 Oto\u00f1o', '❄️ Invierno', '🌸 Primavera'];
    const seasonCounts = [0, 0, 0, 0];
    trips.forEach(t => { seasonCounts[seasonMap[new Date(t.fechaInicio).getMonth()]]++; });

    // Travel streaks (consecutive months with trips)
    const monthsWithTrips = new Set();
    trips.forEach(t => { const d = new Date(t.fechaInicio); monthsWithTrips.add(d.getFullYear() * 12 + d.getMonth()); });
    const sortedMonths = [...monthsWithTrips].sort((a, b) => a - b);
    let maxStreak = 0, streak = 1;
    for (let i = 1; i < sortedMonths.length; i++) {
        if (sortedMonths[i] === sortedMonths[i - 1] + 1) { streak++; maxStreak = Math.max(maxStreak, streak); }
        else { streak = 1; }
    }
    maxStreak = Math.max(maxStreak, streak);
    if (sortedMonths.length === 0) maxStreak = 0;

    // --- Section 3: Geography ---
    const placeCount = {};
    allDest.forEach(d => { placeCount[d.lugar] = (placeCount[d.lugar] || 0) + 1; });
    const placeEntries = Object.entries(placeCount).sort((a, b) => b[1] - a[1]);
    const mostVisited = placeEntries[0];
    const newPlaces = placeEntries.filter(([_, c]) => c === 1).length;
    const revisitedPlaces = placeEntries.filter(([_, c]) => c > 1).length;
    const avgDestsPerTrip = (allDest.length / totalTrips).toFixed(1);

    let furthest = { name: '-', km: 0 };
    if (homeCoords) {
        allDest.forEach(d => {
            if (d.coordinates) {
                const km = calculateDistance(homeCoords.lat, homeCoords.lng, d.coordinates.lat, d.coordinates.lng);
                if (km > furthest.km) furthest = { name: d.lugar, km };
            }
        });
    }

    // --- Section 4: Social ---
    const soloTrips = trips.filter(t => !t.personas || t.personas.length === 0).length;
    const groupTrips = totalTrips - soloTrips;
    const motivoCount = {};
    trips.forEach(t => { motivoCount[t.motivo] = (motivoCount[t.motivo] || 0) + 1; });
    const motivoEntries = Object.entries(motivoCount).sort((a, b) => b[1] - a[1]);
    const maxMotivo = motivoEntries.length > 0 ? motivoEntries[0][1] : 1;

    const peopleStats = {};
    trips.forEach(trip => {
        trip.personas.forEach(p => {
            if (!peopleStats[p.nombre]) peopleStats[p.nombre] = { count: 0, foto: p.foto };
            peopleStats[p.nombre].count++;
            if (p.foto && !peopleStats[p.nombre].foto) peopleStats[p.nombre].foto = p.foto;
        });
    });
    const topCompanion = Object.entries(peopleStats).sort((a, b) => b[1].count - a[1].count)[0];
    const groupSizes = trips.filter(t => t.personas.length > 0).map(t => t.personas.length + 1);
    const avgGroupSize = groupSizes.length > 0 ? (groupSizes.reduce((a, b) => a + b, 0) / groupSizes.length).toFixed(1) : '-';

    return (
        h('div', null,
            /* Section 1: Overview Cards */
            h('div', {className: 'dashboard-section'},
                h('h2', {className: 'dashboard-section-title'}, '📊 Resumen General'),
                h('div', {className: 'dashboard-grid'},
                    h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '✈️'), h('div', {className: 'metric-value'}, totalTrips), h('div', {className: 'metric-label'}, 'Viajes')),
                    h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '📅'), h('div', {className: 'metric-value'}, totalDays), h('div', {className: 'metric-label'}, 'D\u00edas viajando')),
                    h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '🗺️'), h('div', {className: 'metric-value'}, uniquePlaces), h('div', {className: 'metric-label'}, 'Lugares \u00fanicos')),
                    h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '🌍'), h('div', {className: 'metric-value'}, Math.round(totalKm).toLocaleString()), h('div', {className: 'metric-label'}, 'Kil\u00f3metros'), h('div', {className: 'metric-detail'}, (totalKm / 40075).toFixed(2), 'x la vuelta al mundo')),
                    h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '⏱️'), h('div', {className: 'metric-value'}, avgTripLength), h('div', {className: 'metric-label'}, 'Promedio d\u00edas/viaje')),
                    h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '🏆'), h('div', {className: 'metric-value'}, longestTrip.days, 'd'), h('div', {className: 'metric-label'}, 'Viaje m\u00e1s largo'), h('div', {className: 'metric-detail'}, longestTrip.name))
                )
            ),

            /* Section 2: Travel Patterns */
            h('div', {className: 'dashboard-section'},
                h('h2', {className: 'dashboard-section-title'}, '📈 Patrones de Viaje'),
                h('div', {style: {background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '2px solid var(--border)', marginBottom: '1.5rem'}},
                    h('h3', {style: {fontSize: '1.1rem', color: 'var(--secondary)', marginBottom: '1.25rem'}}, 'Frecuencia Mensual'),
                    monthNames.map((m, i) => (
                        h('div', {key: i, className: 'dashboard-bar-row'},
                            h('div', {className: 'dashboard-bar-label', style: {fontWeight: i === busiestMonthIdx ? '800' : '600', color: i === busiestMonthIdx ? 'var(--primary)' : 'var(--secondary)'}}, m),
                            h('div', {className: 'dashboard-bar-track'},
                                h('div', {className: 'dashboard-bar-fill', style: {width: maxMonth > 0 ? Math.max(monthCounts[i] > 0 ? 8 : 0, (monthCounts[i] / maxMonth) * 100) + '%' : '0%', background: i === busiestMonthIdx ? 'linear-gradient(135deg, var(--accent) 0%, #d14060 100%)' : undefined}},
                                    monthCounts[i] > 0 && h('span', {className: 'dashboard-bar-value'}, monthCounts[i])
                                )
                            )
                        )
                    ))
                ),
                h('div', {className: 'dashboard-mini-grid'},
                    seasonNames.map((s, i) => (
                        h('div', {key: i, className: 'dashboard-mini-card'},
                            h('div', {style: {fontSize: '1.5rem', marginBottom: '0.25rem'}}, s),
                            h('div', {className: 'dashboard-mini-value'}, seasonCounts[i]),
                            h('div', {className: 'dashboard-mini-label'}, 'viajes')
                        )
                    )),
                    h('div', {className: 'dashboard-mini-card'},
                        h('div', {style: {fontSize: '1.5rem', marginBottom: '0.25rem'}}, '🔥'),
                        h('div', {className: 'dashboard-mini-value'}, maxStreak),
                        h('div', {className: 'dashboard-mini-label'}, 'Racha (meses consecutivos)')
                    )
                )
            ),

            /* Section 3: Geography */
            h('div', {className: 'dashboard-section'},
                h('h2', {className: 'dashboard-section-title'}, '🌎 Geograf\u00eda'),
                h('div', {className: 'dashboard-grid'},
                    h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '🆕'), h('div', {className: 'metric-value'}, newPlaces), h('div', {className: 'metric-label'}, 'Lugares nuevos')),
                    h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '🔄'), h('div', {className: 'metric-value'}, revisitedPlaces), h('div', {className: 'metric-label'}, 'Lugares revisitados')),
                    furthest.km > 0 && h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '📏'), h('div', {className: 'metric-value'}, Math.round(furthest.km).toLocaleString(), ' km'), h('div', {className: 'metric-label'}, 'Destino m\u00e1s lejano'), h('div', {className: 'metric-detail'}, furthest.name)),
                    mostVisited && h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '❤️'), h('div', {className: 'metric-value'}, mostVisited[1]), h('div', {className: 'metric-label'}, 'Lugar m\u00e1s visitado'), h('div', {className: 'metric-detail'}, mostVisited[0])),
                    h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '📍'), h('div', {className: 'metric-value'}, avgDestsPerTrip), h('div', {className: 'metric-label'}, 'Destinos por viaje (prom.)'))
                )
            ),

            /* Section 4: Social */
            h('div', {className: 'dashboard-section'},
                h('h2', {className: 'dashboard-section-title'}, '👥 Social'),
                h('div', {className: 'dashboard-grid'},
                    h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '🧍'), h('div', {className: 'metric-value'}, soloTrips), h('div', {className: 'metric-label'}, 'Viajes solo/a')),
                    h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '👫'), h('div', {className: 'metric-value'}, groupTrips), h('div', {className: 'metric-label'}, 'Viajes en grupo')),
                    topCompanion && h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '🥇'), h('div', {className: 'metric-value'}, topCompanion[1].count), h('div', {className: 'metric-label'}, 'Compa\u00f1ero/a top'), h('div', {className: 'metric-detail'}, topCompanion[0])),
                    h('div', {className: 'metric-card'}, h('div', {className: 'metric-icon'}, '👥'), h('div', {className: 'metric-value'}, avgGroupSize), h('div', {className: 'metric-label'}, 'Tama\u00f1o grupo (prom.)'))
                ),

                motivoEntries.length > 0 && (
                    h('div', {style: {background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '2px solid var(--border)', marginTop: '1.5rem'}},
                        h('h3', {style: {fontSize: '1.1rem', color: 'var(--secondary)', marginBottom: '1.25rem'}}, 'Viajes por Motivo'),
                        motivoEntries.map(([motivo, count]) => (
                            h('div', {key: motivo, className: 'dashboard-bar-row'},
                                h('div', {className: 'dashboard-bar-label'}, getMotivoEmoji(motivo), ' ', motivo),
                                h('div', {className: 'dashboard-bar-track'},
                                    h('div', {className: 'dashboard-bar-fill', style: {width: Math.max(8, (count / maxMotivo) * 100) + '%'}},
                                        h('span', {className: 'dashboard-bar-value'}, count)
                                    )
                                )
                            )
                        ))
                    )
                )
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

const TripsListView = ({ trips, onTripClick, onEditTrip, onDeleteTrip }) => {
    if (trips.length === 0) return h('div', {className: 'empty-state'}, h('div', {className: 'empty-state-icon'}, '✈️'), h('div', {className: 'empty-state-text'}, 'No hay viajes registrados a\u00fan'));
    const sortedTrips = [...trips].sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));

    return (
        h('div', null,
            h('div', {style: {display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem'}},
                h('h2', {style: {fontSize: '2rem', color: 'var(--secondary)'}}, 'Todos los Viajes')
            ),
            h('div', {className: 'trips-list'},
                sortedTrips.map(trip => (
                    h(TripCard, {key: trip.id, trip: trip, onClick: () => onTripClick(trip), showEditButton: true, onEdit: onEditTrip, onDelete: onDeleteTrip})
                ))
            )
        )
    );
};

const App = () => {
    const [activeTab, setActiveTab] = useState('settings');
    const [trips, setTrips] = useState([]);
    const [profile, setProfile] = useState(null);
    const [homeCoords, setHomeCoords] = useState(null);
    const [selectedYear, setSelectedYear] = useState('all');
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [editingTrip, setEditingTrip] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, danger: false });
    const [lastImportDate, setLastImportDate] = useState(localStorage.getItem('nomadAtlasLastImport'));

    const showToast = (message, type) => {
        type = type || 'success';
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    const showConfirm = (title, message, onConfirm, danger) => {
        setConfirmDialog({ isOpen: true, title, message, onConfirm: () => { onConfirm(); setConfirmDialog(d => ({...d, isOpen: false})); }, danger: !!danger });
    };

    useEffect(() => {
        const savedTrips = localStorage.getItem('nomadAtlasTrips');
        const savedProfile = localStorage.getItem('nomadAtlasProfile');
        if (savedTrips) {
            try { setTrips(JSON.parse(savedTrips)); }
            catch (e) { console.error('Error loading trips:', e); }
        }
        if (savedProfile) {
            try {
                const prof = JSON.parse(savedProfile);
                setProfile(prof);
                if (prof.ubicacion) {
                    geocodePlace(prof.ubicacion).then(coords => {
                        if (coords) setHomeCoords(coords);
                    });
                }
                setActiveTab('map');
            }
            catch (e) { console.error('Error loading profile:', e); }
        }
    }, []);

    useEffect(() => { safeSetItem('nomadAtlasTrips', JSON.stringify(trips), showToast); }, [trips]);
    useEffect(() => {
        if (profile) {
            safeSetItem('nomadAtlasProfile', JSON.stringify(profile), showToast);
            if (profile.ubicacion && !homeCoords) {
                geocodePlace(profile.ubicacion).then(coords => {
                    if (coords) setHomeCoords(coords);
                });
            }
        }
    }, [profile]);

    const handleAddTrip = (trip) => {
        if (editingTrip) {
            setTrips(trips.map(t => t.id === trip.id ? trip : t));
            setEditingTrip(null);
        } else {
            setTrips([trip, ...trips]);
        }
        setShowAddForm(false);
    };

    const handleImportTrips = (newTrips) => {
        setTrips(prev => [...newTrips, ...prev]);
        safeSetItem('nomadAtlasLastImport', new Date().toISOString());
        setLastImportDate(new Date().toISOString());
        setActiveTab('trips');
    };

    const handleUpdateProfile = (newProfile) => {
        setProfile(newProfile);
        if (newProfile.ubicacion) {
            geocodePlace(newProfile.ubicacion).then(coords => {
                if (coords) setHomeCoords(coords);
            });
        }
        setActiveTab('map');
    };

    const handleEditTrip = (trip) => { setEditingTrip(trip); setShowAddForm(true); setActiveTab('trips'); };

    const handleDeleteTrip = (tripId) => {
        showConfirm(
            'Eliminar Viaje',
            'Este viaje se eliminara permanentemente. Esta accion no se puede deshacer.',
            () => {
                setTrips(prev => prev.filter(t => t.id !== tripId));
                setSelectedTrip(null);
                showToast('Viaje eliminado', 'success');
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
        const header = 'tripId,tripFechaInicio,tripFechaFinal,motivo,personas,notas,lugar,destFechaInicio,destFechaFinal';
        const rows = [];
        trips.forEach((trip, tripIndex) => {
            trip.destinos.forEach(dest => {
                const escapeCsv = (val) => { const str = String(val || ''); return str.includes(',') || str.includes('"') || str.includes('\n') ? '"' + str.replace(/"/g, '""') + '"' : str; };
                rows.push([tripIndex + 1, trip.fechaInicio, trip.fechaFinal || '', trip.motivo, trip.personas.map(p => p.nombre).join('; '), escapeCsv(trip.notas), escapeCsv(dest.lugar), dest.fechaInicio || '', dest.fechaFinal || ''].join(','));
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
                    () => {
                        setTrips(data.trips);
                        if (data.profile) setProfile(data.profile);
                        safeSetItem('nomadAtlasLastImport', new Date().toISOString());
                        setLastImportDate(new Date().toISOString());
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
            () => {
                setTrips([]);
                setProfile(null);
                setHomeCoords(null);
                localStorage.removeItem('nomadAtlasTrips');
                localStorage.removeItem('nomadAtlasProfile');
                localStorage.removeItem('nomadAtlasLastImport');
                setLastImportDate(null);
                setActiveTab('settings');
                showToast('Todos los datos han sido eliminados', 'warning');
            },
            true
        );
    };

    const allPeople = [...new Map(trips.flatMap(t => t.personas).map(p => [p.nombre, p])).values()];
    const allDestinations = [...new Map(trips.flatMap(t => t.destinos).map(d => [d.lugar, { lugar: d.lugar, coordinates: d.coordinates }])).values()];
    const availableYears = [...new Set(trips.map(t => new Date(t.fechaInicio).getFullYear()))].sort((a, b) => b - a);
    const filteredTrips = selectedYear === 'all' ? trips : trips.filter(t => new Date(t.fechaInicio).getFullYear() === parseInt(selectedYear));

    return (
        h('div', {className: 'app-container'},
            h('header', {className: 'header'},
                h('div', {className: 'header-content'},
                    h('h1', {className: 'logo'}, 'Nomad Atlas'),
                    h('nav', {className: 'nav-tabs'},
                        h('button', {className: `nav-tab ${activeTab === 'map' ? 'active' : ''}`, onClick: () => setActiveTab('map'), disabled: !profile}, '🗺️ Mapa'),
                        h('button', {className: `nav-tab ${activeTab === 'trips' ? 'active' : ''}`, onClick: () => setActiveTab('trips'), disabled: !profile}, '✈️ Viajes', filteredTrips.length > 0 ? ' (' + filteredTrips.length + ')' : ''),
                        h('button', {className: `nav-tab ${activeTab === 'timeline' ? 'active' : ''}`, onClick: () => setActiveTab('timeline'), disabled: !profile}, '📅 Timeline'),
                        h('button', {className: `nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`, onClick: () => setActiveTab('dashboard'), disabled: !profile}, '📊 Dashboard'),
                        h('button', {className: `nav-tab ${activeTab === 'wrapped' ? 'active' : ''}`, onClick: () => setActiveTab('wrapped'), disabled: !profile}, '🎁 Wrapped'),
                        h('button', {className: `nav-tab ${activeTab === 'settings' ? 'active' : ''}`, onClick: () => setActiveTab('settings')}, '⚙️ Ajustes')
                    )
                )
            ),

            h('main', {className: 'main-content'},
                profile && availableYears.length > 0 && (
                    h('div', {className: 'year-selector-bar'},
                        h('span', {style: {fontWeight: '700', color: 'var(--secondary)', fontSize: '0.9rem'}}, '📅 A\u00f1o:'),
                        h('button', {className: `year-chip ${selectedYear === 'all' ? 'active' : ''}`, onClick: () => setSelectedYear('all')}, 'Todos'),
                        availableYears.map(y => (
                            h('button', {key: y, className: `year-chip ${selectedYear === String(y) ? 'active' : ''}`, onClick: () => setSelectedYear(String(y))}, y)
                        ))
                    )
                ),

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
                    h(React.Fragment, null,
                        h('div', {style: {display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap'}},
                            h('button', {className: 'btn-primary', onClick: () => { setEditingTrip(null); setShowAddForm(!showAddForm); }},
                                showAddForm ? '✕ Cerrar Formulario' : '➕ Nuevo Viaje'
                            )
                        ),
                        (showAddForm || editingTrip) && (
                            h(AddTripForm, {onAddTrip: (trip) => { handleAddTrip(trip); setShowAddForm(false); }, allPeople: allPeople, allDestinations: allDestinations, editingTrip: editingTrip, onCancelEdit: () => { setEditingTrip(null); setShowAddForm(false); }, existingTrips: trips, showToast: showToast, onImportTrips: handleImportTrips})
                        ),
                        h(TripsListView, {trips: filteredTrips, onTripClick: setSelectedTrip, onEditTrip: (trip) => { handleEditTrip(trip); setShowAddForm(true); }, onDeleteTrip: handleDeleteTrip})
                    )
                ),

                activeTab === 'timeline' && profile && h(TimelineView, {trips: filteredTrips, onTripClick: setSelectedTrip}),

                activeTab === 'dashboard' && profile && h(DashboardView, {trips: filteredTrips, homeCoords: homeCoords}),

                activeTab === 'wrapped' && profile && (
                    h(WrappedView, {trips: filteredTrips, selectedYear: selectedYear})
                )
            ),

            selectedTrip && h(TripDetailModal, {trip: selectedTrip, onClose: () => setSelectedTrip(null), homeCoords: homeCoords, onDelete: handleDeleteTrip, onEdit: handleEditTrip}),
            h(ConfirmDialog, Object.assign({}, confirmDialog, {onCancel: () => setConfirmDialog(d => ({...d, isOpen: false}))})),
            h(ToastContainer, {toasts: toasts})
        )
    );
};

ReactDOM.render(h(App, null), document.getElementById('root'));
