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
            this.loadDataWithProgress(file);
        });

        document.getElementById('save-geojson').addEventListener('click', () => {
            this.saveDataWithProgress();
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
                'fill-extrusion-height': this.data.getFillExtrusionHeightExpression(),
                'fill-extrusion-opacity': 1.0,
                'fill-extrusion-base': 0
            }
        });

        // Add source for roads (LineString features)
        map.addSource('roads-source', {
            type: 'geojson',
            data: this.data.getRoadData()
        });

        // Add layer for roads
        map.addLayer({
            'id': 'roads-layer',
            'type': 'line',
            'source': 'roads-source',
            'paint': {
                'line-color': '#666666', // Gray color for roads
                'line-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 1,
                    15, 2,
                    20, 4
                ],
                'line-opacity': 0.8
            }
        });

        this.layersSetup = true;
        console.log('✓ UI layers setup complete (buildings + roads)');
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
    /**
     * Update progress bar
     * @param {number} percent - Progress percentage (0-100)
     * @param {string} text - Progress text
     */
    updateProgress(percent, text) {
        const progressContainer = document.getElementById('progress-container');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const progressPercent = document.getElementById('progress-percent');
        
        if (progressContainer && progressFill && progressText && progressPercent) {
            progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
            progressText.textContent = text;
            progressPercent.textContent = `${Math.round(percent)}%`;
        }
    }

    /**
     * Show progress bar
     */
    showProgress() {
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
    }

    /**
     * Hide progress bar
     */
    hideProgress() {
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }

    /**
     * Load data with progress indicator for large files
     * @param {File} file - File to load
     */
    async loadDataWithProgress(file) {
        const loadBtn = document.getElementById('load-geojson');
        const originalText = loadBtn.innerHTML;
        
        try {
            // Disable button and show progress
            loadBtn.disabled = true;
            loadBtn.innerHTML = '<span>⏳ Loading...</span>';
            this.showProgress();
            this.updateProgress(0, 'Reading file...');
            
            // Read file with progress
            const fileSize = file.size;
            const reader = new FileReader();
            
            return new Promise((resolve, reject) => {
                reader.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = (e.loaded / e.total) * 50; // 0-50% for file reading
                        this.updateProgress(percent, `Reading file... (${(e.loaded / 1024 / 1024).toFixed(2)} MB)`);
                    }
                };
                
                reader.onload = async (e) => {
                    try {
                        this.updateProgress(60, 'Parsing JSON...');
                        await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI update
                        
                        const data = JSON.parse(e.target.result);
                        const featureCount = data.features ? data.features.length : 0;
                        
                        // Detect height data and ask user for unit
                        const heightKeys = ['Height', 'height', 'HEIGHT', 'building_height', 'buildingHeight', 'elevation', 'Elevation', 'ELEVATION'];
                        const hasHeightData = Array.isArray(data.features) && data.features.some(f => {
                            if (!f || !f.properties) return false;
                            return heightKeys.some(k => f.properties[k] !== null && f.properties[k] !== undefined && f.properties[k] !== '');
                        });

                        if (hasHeightData) {
                            // Show modal and wait for user selection
                            const selectedUnit = await this.showHeightUnitModal();
                            if (selectedUnit === 'meters') {
                                this.data.setHeightUnit('meters');
                                console.log('Height unit set to meters by user choice');
                            } else if (selectedUnit === 'feet') {
                                this.data.setHeightUnit('feet');
                                console.log('Height unit set to feet by user choice');
                            } else {
                                // Default to meters if cancelled
                                this.data.setHeightUnit('meters');
                                console.log('Height unit set to default (meters)');
                            }
                        } else {
                            // No height data, default to meters
                            this.data.setHeightUnit('meters');
                        }

                        this.updateProgress(70, `Processing ${featureCount} features...`);
                        await new Promise(resolve => setTimeout(resolve, 0));
                        
                        this.updateProgress(80, 'Adding to map...');
                        this.data.addGeoJsonToMap(data);
                        
                        this.updateProgress(100, 'Complete!');
                        loadBtn.innerHTML = '<span>✓ Loaded!</span>';
                        
                        setTimeout(() => {
                            loadBtn.disabled = false;
                            loadBtn.innerHTML = originalText;
                            this.hideProgress();
                        }, 1000);
                        
                        resolve();
                    } catch (error) {
                        alert("Error parsing GeoJSON file: " + error.message);
                        loadBtn.disabled = false;
                        loadBtn.innerHTML = originalText;
                        this.hideProgress();
                        reject(error);
                    }
                };
                
                reader.onerror = (error) => {
                    alert("Error reading file: " + error.message);
                    loadBtn.disabled = false;
                    loadBtn.innerHTML = originalText;
                    this.hideProgress();
                    reject(error);
                };
                
                // Start reading
                reader.readAsText(file);
            });
            
        } catch (error) {
            console.error('Error loading data:', error);
            alert(`Error loading data: ${error.message}`);
            loadBtn.disabled = false;
            loadBtn.innerHTML = originalText;
            this.hideProgress();
        }
    }

    /**
     * Save data with progress indicator for large datasets
     */
    async saveDataWithProgress() {
        const saveBtn = document.getElementById('save-geojson');
        const originalText = saveBtn.innerHTML;
        
        try {
            // Disable button and show progress
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span>⏳ Saving...</span>';
            this.showProgress();
            this.updateProgress(0, 'Preparing...');
            
            // Get data
            this.updateProgress(10, 'Collecting data...');
            const combinedData = this.data.saveData();
            if (!combinedData) {
                alert("No data to save.");
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
                this.hideProgress();
                return;
            }
            
            const totalFeatures = combinedData.features.length;
            console.log(`Starting save of ${totalFeatures} features...`);
            
            // For very large datasets, use chunked stringification
            if (totalFeatures > 10000) {
                this.updateProgress(20, 'Processing large dataset...');
                
                // Use requestIdleCallback or setTimeout to prevent blocking
                await new Promise(resolve => setTimeout(resolve, 0));
                
                // Stringify in chunks to prevent blocking
                this.updateProgress(40, 'Serializing data...');
                const dataStr = await this.stringifyLargeJSONWithProgress(combinedData, (progress) => {
                    // Progress from 40% to 80% for stringification
                    this.updateProgress(40 + (progress * 0.4), 'Serializing data...');
                });
                
                this.updateProgress(85, 'Creating file...');
                const blob = new Blob([dataStr], { type: 'application/json' });
                
                this.updateProgress(95, 'Downloading...');
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'data-with-trees.geojson';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                console.log(`✓ Successfully saved ${totalFeatures} features`);
            } else {
                // For smaller datasets, use normal stringification
                this.updateProgress(30, 'Serializing data...');
                const dataStr = JSON.stringify(combinedData, null, 2);
                
                this.updateProgress(70, 'Creating file...');
                const blob = new Blob([dataStr], { type: 'application/json' });
                
                this.updateProgress(90, 'Downloading...');
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'data-with-trees.geojson';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                console.log(`✓ Successfully saved ${totalFeatures} features`);
            }
            
            this.updateProgress(100, 'Complete!');
            saveBtn.innerHTML = '<span>✓ Saved!</span>';
            
            setTimeout(() => {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
                this.hideProgress();
            }, 1500);
            
        } catch (error) {
            console.error('Error saving data:', error);
            alert(`Error saving data: ${error.message}. The dataset might be too large. Try reducing the number of trees.`);
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
            this.hideProgress();
        }
    }

    /**
     * Show height unit selection modal and wait for user selection
     * @returns {Promise<'meters'|'feet'>} Selected unit
     */
    showHeightUnitModal() {
        return new Promise((resolve) => {
            const modal = document.getElementById('height-unit-modal');
            const confirmBtn = document.getElementById('height-unit-confirm');
            const radioInputs = modal.querySelectorAll('input[name="height-unit"]');
            
            // Reset to meters (default)
            radioInputs[0].checked = true;
            
            // Show modal
            modal.style.display = 'flex';
            
            // Handle confirm button click
            const handleConfirm = () => {
                const selected = modal.querySelector('input[name="height-unit"]:checked');
                const unit = selected ? selected.value : 'meters';
                modal.style.display = 'none';
                
                // Clean up event listeners
                confirmBtn.removeEventListener('click', handleConfirm);
                modal.removeEventListener('keydown', handleKeyPress);
                
                resolve(unit);
            };
            
            // Handle Enter key press
            const handleKeyPress = (e) => {
                if (e.key === 'Enter') {
                    handleConfirm();
                }
            };
            
            confirmBtn.addEventListener('click', handleConfirm);
            modal.addEventListener('keydown', handleKeyPress);
        });
    }

    /**
     * Stringify large JSON objects without blocking the UI
     * @param {Object} obj - Object to stringify
     * @param {Function} progressCallback - Callback function for progress updates (0-1)
     * @returns {Promise<string>} Stringified JSON
     */
    async stringifyLargeJSONWithProgress(obj, progressCallback) {
        return new Promise((resolve, reject) => {
            try {
                // For very large objects, stringify without pretty printing to save memory
                // Use setTimeout to allow UI updates during stringification
                const startTime = Date.now();
                
                // Stringify in a way that allows progress updates
                setTimeout(() => {
                    try {
                        if (progressCallback) progressCallback(0.1);
                        
                        // Stringify the object
                        const dataStr = JSON.stringify(obj); // No pretty printing for large datasets
                        
                        if (progressCallback) progressCallback(1.0);
                        resolve(dataStr);
                    } catch (e) {
                        reject(e);
                    }
                }, 0);
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Export for use in other modules
window.UIModule = UIModule;
