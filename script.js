mapboxgl.accessToken = 'pk.eyJ1Ijoia2VybWFuaSIsImEiOiJjajF3a2p5bWQwMDAwMnFwbWFpcjQzZW52In0.aFYLXgdRHVofYKKd6JlFdw';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/standard',
    center: [-74.5, 40],
    zoom: 9,
    pitch: 60,
    antialias: true,
    config: {
        basemap: {
            show3dObjects: false
        }
    }
});

map.addControl(new mapboxgl.NavigationControl());

// --- Data Stores ---
let buildingData = { type: 'FeatureCollection', features: [] };
let treeTrunkData = { type: 'FeatureCollection', features: [] };
let treeCanopyData = { type: 'FeatureCollection', features: [] };
let treeIdCounter = 0;

// --- Data Handling ---

function addGeoJsonToMap(data) {
    const center = turf.center(data).geometry.coordinates;
    map.flyTo({ center, zoom: 16 });

    // Clear existing data
    buildingData.features = [];
    treeTrunkData.features = [];
    treeCanopyData.features = [];

    // Separate features into buildings and trees
    // This logic now needs to handle both old Point-based trees and new Polygon-based trees
    for (const feature of data.features) {
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            if (feature.properties.isCanopy) {
                treeCanopyData.features.push(feature);
            } else if (feature.properties.isTrunk) {
                treeTrunkData.features.push(feature);
            } else {
                buildingData.features.push(feature);
            }
        } else if (feature.geometry.type === 'Point') {
            // Legacy support for old tree format (convert to new format)
            placeTree(feature.geometry.coordinates, feature.properties.height);
        }
    }

    // Update the sources
    map.getSource('geojson-data').setData(buildingData);
    map.getSource('tree-trunks-source').setData(treeTrunkData);
    map.getSource('tree-canopies-source').setData(treeCanopyData);
}

// --- UI Event Listeners ---

document.getElementById('load-geojson').addEventListener('click', () => {
    document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            addGeoJsonToMap(data);
        } catch (error) {
            alert("Error parsing GeoJSON file: " + error.message);
        }
    };
    reader.readAsText(file);
});

document.getElementById('save-geojson').addEventListener('click', () => {
    const buildings = buildingData.features;
    const trunks = treeTrunkData.features;
    const canopies = treeCanopyData.features;

    if (buildings.length || trunks.length) {
        const combinedData = {
            type: 'FeatureCollection',
            features: [...buildings, ...trunks, ...canopies]
        };
        const dataStr = JSON.stringify(combinedData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data-with-trees.geojson';
        a.click();
        URL.revokeObjectURL(url);
    } else {
        alert("No data to save.");
    }
});

document.getElementById('reset').addEventListener('click', () => {
    buildingData = { type: 'FeatureCollection', features: [] };
    treeTrunkData = { type: 'FeatureCollection', features: [] };
    treeCanopyData = { type: 'FeatureCollection', features: [] };
    map.getSource('geojson-data').setData(buildingData);
    map.getSource('tree-trunks-source').setData(treeTrunkData);
    map.getSource('tree-canopies-source').setData(treeCanopyData);
    treeIdCounter = 0;
    document.getElementById('file-input').value = '';
    setTreeMode(null);
});

// --- Building Pop-up Logic ---

let selectedFeatureId = null;

map.on('click', 'geojson-layer', (e) => {
    if (currentTreeMode) return;
    const feature = e.features[0];
    selectedFeatureId = feature.properties.ID;

    const properties = feature.properties;
    const popupContent = document.createElement('div');

    let tableHTML = '<table id="properties-table">';
    for (const key in properties) {
        const isReadOnly = key === 'ID';
        tableHTML += `<tr>
                        <td><input type="text" class="key-input" value="${key}" ${isReadOnly ? 'readonly' : ''}></td>
                        <td><input type="text" class="value-input" value="${properties[key]}" ${isReadOnly ? 'readonly' : ''}></td>
                        <td>${!isReadOnly ? `<button class="remove-btn" data-key="${key}">X</button>` : ''}</td>
                     </tr>`;
    }
    tableHTML += '</table>';

    popupContent.innerHTML = `
        <div><strong>Building Properties</strong></div>
        <div id="popup-content">
            ${tableHTML}
            <button id="add-row">Add Row</button>
            <button id="save-properties">Save</button>
        </div>
    `;

    const popup = new mapboxgl.Popup().setLngLat(e.lngLat).setDOMContent(popupContent).addTo(map);

    const propertiesTable = popupContent.querySelector('#properties-table');
    propertiesTable.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-btn')) {
            event.target.closest('tr').remove();
        }
    });

    popupContent.querySelector('#add-row').addEventListener('click', () => {
        const newRow = propertiesTable.insertRow();
        newRow.innerHTML = `
            <td><input type="text" placeholder="key" class="key-input"></td>
            <td><input type="text" placeholder="value" class="value-input"></td>
            <td><button class="remove-btn">X</button></td>
        `;
    });

    popupContent.querySelector('#save-properties').addEventListener('click', () => {
        const newProperties = {};
        for (const row of propertiesTable.rows) {
            const keyInput = row.cells[0].querySelector('.key-input');
            const valueInput = row.cells[1].querySelector('.value-input');
            if (keyInput && valueInput) {
                const key = keyInput.value;
                const value = valueInput.value;
                if (key) newProperties[key] = isNaN(Number(value)) || value === '' ? value : Number(value);
            }
        }
        const featureToUpdate = buildingData.features.find(f => f.properties.ID === selectedFeatureId);
        if (featureToUpdate) {
            featureToUpdate.properties = newProperties;
            map.getSource('geojson-data').setData(buildingData);
        } else {
            alert("Could not find the feature to update.");
        }
        popup.remove();
    });
});

map.on('mouseenter', 'geojson-layer', () => { if (!currentTreeMode) map.getCanvas().style.cursor = 'pointer'; });
map.on('mouseleave', 'geojson-layer', () => { if (!currentTreeMode) map.getCanvas().style.cursor = ''; });

// --- Tree Creator ---

let currentTreeMode = null;

const treeModeMultiBtn = document.getElementById('tree-mode-multi');
const treeModeDeleteBtn = document.getElementById('tree-mode-delete');
const treeCreatorBtns = [treeModeMultiBtn, treeModeDeleteBtn];

function setTreeMode(mode) {
    if (currentTreeMode === mode) {
        currentTreeMode = null;
    } else {
        currentTreeMode = mode;
    }

    treeCreatorBtns.forEach(btn => {
        const btnMode = btn.id.split('-')[2];
        if (btnMode === currentTreeMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    map.getCanvas().style.cursor = currentTreeMode ? 'crosshair' : '';
}

treeCreatorBtns.forEach(btn => {
    btn.addEventListener('click', () => setTreeMode(btn.id.split('-')[2]));
});

// --- Map Layers Setup ---

map.on('load', () => {
    // Add source for buildings
    map.addSource('geojson-data', {
        type: 'geojson',
        data: buildingData
    });

    // Add sources for tree parts
    map.addSource('tree-trunks-source', {
        type: 'geojson',
        data: treeTrunkData
    });
    map.addSource('tree-canopies-source', {
        type: 'geojson',
        data: treeCanopyData
    });

    // Add layer for buildings
    map.addLayer({
        'id': 'geojson-layer',
        'type': 'fill-extrusion',
        'source': 'geojson-data',
        'paint': {
            'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'TotalEnergy'],
                50, 'green', 100, 'yellow', 150, 'red'
            ],
            'fill-extrusion-height': ['*', ['get', 'Height'], 0.3048],
            'fill-extrusion-opacity': 1.0,
            'fill-extrusion-base': 0
        }
    });

    // Add layer for tree trunks
    map.addLayer({
        'id': 'tree-trunks-layer',
        'type': 'fill-extrusion',
        'source': 'tree-trunks-source',
        'paint': {
            'fill-extrusion-color': '#8B4513', // Brown
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'base']
        }
    });

    // Add layer for tree canopies
    map.addLayer({
        'id': 'tree-canopies-layer',
        'type': 'fill-extrusion',
        'source': 'tree-canopies-source',
        'paint': {
            'fill-extrusion-color': '#008000', // Green
            'fill-extrusion-height': ['+', ['get', 'base'], ['get', 'height']],
            'fill-extrusion-base': ['get', 'base']
        }
    });

    // Set up lighting and initial sun position
    map.setConfigProperty('basemap', 'lightPreset', 'custom');
    updateSunPosition();
});

map.on('mouseenter', 'tree-trunks-layer', () => { if (!currentTreeMode) map.getCanvas().style.cursor = 'pointer'; });
map.on('mouseleave', 'tree-trunks-layer', () => { if (!currentTreeMode) map.getCanvas().style.cursor = ''; });
map.on('mouseenter', 'tree-canopies-layer', () => { if (!currentTreeMode) map.getCanvas().style.cursor = 'pointer'; });
map.on('mouseleave', 'tree-canopies-layer', () => { if (!currentTreeMode) map.getCanvas().style.cursor = ''; });


function placeTree(lngLat, legacyHeight) {
    const totalHeight = legacyHeight || (() => {
        const min = Number(document.getElementById('tree-min-height').value);
        const max = Number(document.getElementById('tree-max-height').value);
        return Math.random() * (max - min) + min;
    })();

    const trunkHeight = totalHeight * 0.4;
    const canopyHeight = totalHeight * 0.6;
    const trunkRadius = 0.4; // in meters
    const canopyRadius = 2.5; // in meters
    const treeId = `tree-${treeIdCounter++}`;

    const pointCoords = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
    const point = turf.point(pointCoords);

    // Create Trunk
    const trunkBuffer = turf.buffer(point, trunkRadius, { units: 'meters' });
    const trunkFeature = {
        ...trunkBuffer,
        properties: {
            id: treeId,
            isTrunk: true,
            height: trunkHeight,
            base: 0
        }
    };
    treeTrunkData.features.push(trunkFeature);

    // Create Canopy
    const canopyBuffer = turf.buffer(point, canopyRadius, { units: 'meters' });
    const canopyFeature = {
        ...canopyBuffer,
        properties: {
            id: treeId,
            isCanopy: true,
            height: canopyHeight,
            base: trunkHeight // Place canopy on top of the trunk
        }
    };
    treeCanopyData.features.push(canopyFeature);

    // Update both sources
    map.getSource('tree-trunks-source').setData(treeTrunkData);
    map.getSource('tree-canopies-source').setData(treeCanopyData);
}

function deleteTreesAtPoint(point) {
    const features = map.queryRenderedFeatures(point, { layers: ['tree-trunks-layer', 'tree-canopies-layer'] });
    if (!features.length) return;

    const idToDelete = features[0].properties.id;
    treeTrunkData.features = treeTrunkData.features.filter(f => f.properties.id !== idToDelete);
    treeCanopyData.features = treeCanopyData.features.filter(f => f.properties.id !== idToDelete);

    map.getSource('tree-trunks-source').setData(treeTrunkData);
    map.getSource('tree-canopies-source').setData(treeCanopyData);
}

map.on('click', (e) => {
    if (currentTreeMode === 'delete') {
        deleteTreesAtPoint(e.point);
    }
});

let isDragging = false;
let lastTreePosition = null;

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

map.on('mousedown', (e) => {
    if (e.originalEvent.button !== 0) return;
    if (currentTreeMode) e.preventDefault();

    if (currentTreeMode === 'multi') {
        isDragging = true;
        map.dragPan.disable();
        placeTree(e.lngLat);
        lastTreePosition = e.lngLat;
    } else if (currentTreeMode === 'delete') {
        isDragging = true;
        map.dragPan.disable();
        deleteTreesAtPoint(e.point);
    }
});

map.on('mousemove', throttle((e) => {
    if (!isDragging) return;
    if (currentTreeMode === 'multi') {
        const distance = turf.distance(
            [lastTreePosition.lng, lastTreePosition.lat],
            [e.lngLat.lng, e.lngLat.lat],
            { units: 'meters' }
        );
        const minDistance = document.getElementById('tree-distance').value;
        if (distance > minDistance) {
            placeTree(e.lngLat);
            lastTreePosition = e.lngLat;
        }
    } else if (currentTreeMode === 'delete') {
        deleteTreesAtPoint(e.point);
    }
}, 100));

map.on('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        lastTreePosition = null;
        if (!currentTreeMode) {
            map.dragPan.enable();
        }
    }
    if (currentTreeMode !== 'multi' && currentTreeMode !== 'delete') {
        map.dragPan.enable();
    }
});

// --- Sun Simulation ---

const sunSimUIPairs = [
    { slider: 'sun-month-slider', input: 'sun-month-input' },
    { slider: 'sun-day-slider', input: 'sun-day-input' },
    { slider: 'sun-hour-slider', input: 'sun-hour-input' },
    { slider: 'sun-minute-slider', input: 'sun-minute-input' }
];

function syncInputs(sliderEl, inputEl) {
    sliderEl.addEventListener('input', () => {
        inputEl.value = sliderEl.value;
        updateSunPosition();
    });
    inputEl.addEventListener('input', () => {
        let value = parseInt(inputEl.value);
        const min = parseInt(inputEl.min);
        const max = parseInt(inputEl.max);
        if (isNaN(value)) return;
        if (value < min) value = min;
        if (value > max) value = max;
        inputEl.value = value;
        sliderEl.value = value;
        updateSunPosition();
    });
}

sunSimUIPairs.forEach(pair => {
    const slider = document.getElementById(pair.slider);
    const input = document.getElementById(pair.input);
    syncInputs(slider, input);
});

function updateSunPosition() {
    const now = new Date();
    const year = now.getFullYear();
    const month = parseInt(document.getElementById('sun-month-slider').value) - 1;
    const day = parseInt(document.getElementById('sun-day-slider').value);
    const hour = parseInt(document.getElementById('sun-hour-slider').value);
    const minute = parseInt(document.getElementById('sun-minute-slider').value);

    // Create a local date object to match the user's perception of time
    const date = new Date(year, month, day, hour, minute);
    const lat = 40.7128;
    const lon = -74.0060;

    if (isNaN(date.getTime())) {
        console.error("Invalid date values for sun calculation.");
        return;
    }

    const sunPosition = SunCalc.getPosition(date, lat, lon);

    // Calculate sun properties for Mapbox's modern lighting system
    const sunAzimuth = (sunPosition.azimuth * 180 / Math.PI) + 180;
    const sunPolarAngle = 90 - (sunPosition.altitude * 180 / Math.PI);

    // When the sun is below the horizon, altitude is negative.
    // The light should have zero intensity and a valid polar angle.
    const sunIntensity = Math.max(0, Math.sin(sunPosition.altitude));

    map.setLights([
        {
            "id": "ambient_light",
            "type": "ambient",
            "properties": {
                "color": "white",
                "intensity": 0.5 * sunIntensity // Dim ambient light at night
            }
        },
        {
            "id": "directional_light",
            "type": "directional",
            "properties": {
                "color": "white",
                "intensity": 0.6 * sunIntensity,
                "direction": [sunAzimuth, Math.min(sunPolarAngle, 90)],
                "cast-shadows": true,
                "shadow-intensity": 0.7
            }
        }
    ]);
}
