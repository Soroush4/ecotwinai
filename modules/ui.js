/**
 * UI Module - User interface and building property editing
 * Handles building property editing, file operations, and UI interactions
 */

class UIModule {
    constructor(coreModule, dataModule, treeModule) {
        this.core = coreModule;
        this.data = dataModule;
        this.tree = treeModule;
        this.selectedFeatureId = null;
        this.layersSetup = false;
    }

    /**
     * Initialize UI module (without map layers)
     */
    initialize() {
        this.setupEventListeners();
    }

    /**
     * Setup map layers (call this after map is loaded)
     */
    setupMapLayers() {
        if (!this.layersSetup) {
            this.setupMapLayersInternal();
        }
    }

    /**
     * Setup event listeners for UI functionality
     */
    setupEventListeners() {
        // File operations
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
                    this.data.addGeoJsonToMap(data);
                } catch (error) {
                    alert("Error parsing GeoJSON file: " + error.message);
                }
            };
            reader.readAsText(file);
        });

        document.getElementById('save-geojson').addEventListener('click', () => {
            const combinedData = this.data.saveData();
            if (combinedData) {
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
            this.data.reset();
            this.tree.resetTreeMode();
            document.getElementById('file-input').value = '';
        });

        // Energy column selector
        document.getElementById('energy-column-selector').addEventListener('change', (e) => {
            const selectedColumn = e.target.value;
            this.data.setEnergyColumn(selectedColumn);
            console.log(`✓ Energy column changed to: ${selectedColumn}`);
        });


        // Building click events
        const map = this.core.getMap();
        map.on('click', 'geojson-layer', (e) => {
            if (this.tree.getCurrentTreeMode()) return;
            this.showBuildingProperties(e);
        });

        map.on('mouseenter', 'geojson-layer', () => { 
            if (!this.tree.getCurrentTreeMode()) map.getCanvas().style.cursor = 'pointer'; 
        });
        map.on('mouseleave', 'geojson-layer', () => { 
            if (!this.tree.getCurrentTreeMode()) map.getCanvas().style.cursor = ''; 
        });
    }

    /**
     * Setup map layers for buildings (internal method)
     */
    setupMapLayersInternal() {
        const map = this.core.getMap();

        // Check if map is ready
        if (!map.isStyleLoaded()) {
            console.warn('Map style not loaded yet, retrying...');
            setTimeout(() => this.setupMapLayersInternal(), 100);
            return;
        }

        // Add source for buildings
        map.addSource('geojson-data', {
            type: 'geojson',
            data: this.data.getBuildingData()
        });

        // Add layer for buildings
        map.addLayer({
            'id': 'geojson-layer',
            'type': 'fill-extrusion',
            'source': 'geojson-data',
            'paint': {
                'fill-extrusion-color': '#808080', // Default gray color, will be updated dynamically
                'fill-extrusion-height': [
                    'case',
                    ['has', 'Height'], ['*', ['get', 'Height'], 0.3048],
                    ['has', 'height'], ['*', ['get', 'height'], 0.3048],
                    ['has', 'HEIGHT'], ['*', ['get', 'HEIGHT'], 0.3048],
                    ['has', 'building_height'], ['*', ['get', 'building_height'], 0.3048],
                    ['has', 'buildingHeight'], ['*', ['get', 'buildingHeight'], 0.3048],
                    ['has', 'elevation'], ['*', ['get', 'elevation'], 0.3048],
                    ['has', 'Elevation'], ['*', ['get', 'Elevation'], 0.3048],
                    ['has', 'ELEVATION'], ['*', ['get', 'ELEVATION'], 0.3048],
                    3.048 // Default height of 10 feet in meters
                ],
                'fill-extrusion-opacity': 1.0,
                'fill-extrusion-base': 0
            }
        });

        this.layersSetup = true;
        console.log('✓ UI layers setup complete');
    }

    /**
     * Show building properties popup
     * @param {Object} e - Map click event
     */
    showBuildingProperties(e) {
        const feature = e.features[0];
        this.selectedFeatureId = feature.properties.ID;

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

        const map = this.core.getMap();
        const popup = new mapboxgl.Popup().setLngLat(e.lngLat).setDOMContent(popupContent).addTo(map);

        this.setupPropertyEditor(popupContent, popup);
    }

    /**
     * Setup property editor functionality
     * @param {HTMLElement} popupContent - Popup content element
     * @param {Object} popup - Mapbox popup instance
     */
    setupPropertyEditor(popupContent, popup) {
        const propertiesTable = popupContent.querySelector('#properties-table');
        
        // Remove row functionality
        propertiesTable.addEventListener('click', (event) => {
            if (event.target.classList.contains('remove-btn')) {
                event.target.closest('tr').remove();
            }
        });

        // Add row functionality
        popupContent.querySelector('#add-row').addEventListener('click', () => {
            const newRow = propertiesTable.insertRow();
            newRow.innerHTML = `
                <td><input type="text" placeholder="key" class="key-input"></td>
                <td><input type="text" placeholder="value" class="value-input"></td>
                <td><button class="remove-btn">X</button></td>
            `;
        });

        // Save properties functionality
        popupContent.querySelector('#save-properties').addEventListener('click', () => {
            const newProperties = {};
            for (const row of propertiesTable.rows) {
                const keyInput = row.cells[0].querySelector('.key-input');
                const valueInput = row.cells[1].querySelector('.value-input');
                if (keyInput && valueInput) {
                    const key = keyInput.value;
                    const value = valueInput.value;
                    if (key) {
                        newProperties[key] = UtilsModule.isValidNumber(value) ? Number(value) : value;
                    }
                }
            }
            
            const success = this.data.updateBuildingFeature(this.selectedFeatureId, newProperties);
            if (success) {
                popup.remove();
            } else {
                alert("Could not find the feature to update.");
            }
        });
    }

    /**
     * Show notification message
     * @param {string} message - Message to show
     * @param {string} type - Message type (success, error, info)
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            border-radius: 5px;
            color: white;
            z-index: 1000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
        `;

        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#28a745';
                break;
            case 'error':
                notification.style.backgroundColor = '#dc3545';
                break;
            case 'info':
            default:
                notification.style.backgroundColor = '#17a2b8';
                break;
        }

        // Add to page
        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// Export for use in other modules
window.UIModule = UIModule;
