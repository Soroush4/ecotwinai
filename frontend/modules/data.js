/**
 * Data Module - GeoJSON data management and building data handling
 * Handles data loading, processing, and management for buildings and trees
 */

class DataModule {
    constructor(coreModule) {
        this.core = coreModule;
        this.buildingData = { type: 'FeatureCollection', features: [] };
        this.treeTrunkData = { type: 'FeatureCollection', features: [] };
        this.treeCanopyData = { type: 'FeatureCollection', features: [] };
        this.treeIdCounter = 0;
        this.energyStats = { min: 0, max: 100, hasEnergyData: false };
        this.energyStatsModule = null;
        this.selectedEnergyColumn = 'Energy_UrbanWWR_kWh'; // Default energy column
        this.selectedColorScale = 'energy'; // Default color scale
    }

    /**
     * Set energy statistics module reference
     * @param {EnergyStatsModule} energyStatsModule - Energy statistics module instance
     */
    setEnergyStatsModule(energyStatsModule) {
        this.energyStatsModule = energyStatsModule;
    }

    /**
     * Add GeoJSON data to the map
     * @param {Object} data - GeoJSON data object
     */
    addGeoJsonToMap(data) {
        const map = this.core.getMap();
        const center = turf.center(data).geometry.coordinates;
        map.flyTo({ center, zoom: 16 });

        // Clear existing data
        this.buildingData.features = [];
        this.treeTrunkData.features = [];
        this.treeCanopyData.features = [];

        // Separate features into buildings and trees
        for (const feature of data.features) {
            if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                if (feature.properties.isCanopy) {
                    this.treeCanopyData.features.push(feature);
                } else if (feature.properties.isTrunk) {
                    this.treeTrunkData.features.push(feature);
                } else {
                    this.buildingData.features.push(feature);
                }
            } else if (feature.geometry.type === 'Point') {
                // Legacy support for old tree format (convert to new format)
                this.placeTree(feature.geometry.coordinates, feature.properties.height);
            }
        }

        // Calculate energy statistics for buildings
        this.energyStats = UtilsModule.calculateEnergyStats(this.buildingData.features, this.selectedEnergyColumn);

        // Update the sources
        map.getSource('geojson-data').setData(this.buildingData);
        map.getSource('tree-trunks-source').setData(this.treeTrunkData);
        map.getSource('tree-canopies-source').setData(this.treeCanopyData);

        // Update the building layer with new color scheme
        this.updateBuildingColors();

        // Update tree counter if tree module is available
        if (window.app && window.app.tree) {
            window.app.tree.updateTreeCounter();
        }

        // Log loading information
        const loadedBuildingsCount = this.buildingData.features.length;
        const loadedTreesCount = this.treeTrunkData.features.length;
        const loadedCanopiesCount = this.treeCanopyData.features.length;
        
        console.log(`✓ GeoJSON loaded: ${loadedBuildingsCount} buildings, ${loadedTreesCount} trees`);
        
        if (loadedTreesCount > 0) {
            console.log(`✓ Tree data: ${loadedTreesCount} trunks, ${loadedCanopiesCount} canopies`);
        }

        // Notify energy statistics module
        if (this.energyStatsModule) {
            this.energyStatsModule.updateStats();
        }
    }

    /**
     * Update building colors based on energy statistics
     */
    updateBuildingColors() {
        const map = this.core.getMap();
        if (!map.getLayer('geojson-layer')) return;

        if (this.energyStats.hasEnergyData) {
            // Use dynamic color scheme based on actual data range
            const minEnergy = this.energyStats.min;
            const maxEnergy = this.energyStats.max;
            const energyRange = maxEnergy - minEnergy;
            
            // Create more granular color stops for better visualization
            const colorStops = this.createColorStops(minEnergy, maxEnergy, energyRange);
            
            console.log(`Color range: ${minEnergy.toFixed(2)} to ${maxEnergy.toFixed(2)} (Range: ${energyRange.toFixed(2)})`);
            console.log('Color stops:', colorStops);

            map.setPaintProperty('geojson-layer', 'fill-extrusion-color', [
                'interpolate', ['linear'], ['get', this.selectedEnergyColumn],
                ...colorStops
            ]);
        } else {
            // Use default color scheme when no energy data is available
            map.setPaintProperty('geojson-layer', 'fill-extrusion-color', '#808080'); // Gray
        }
    }

    /**
     * Create color stops for energy visualization
     * @param {number} minEnergy - Minimum energy value
     * @param {number} maxEnergy - Maximum energy value
     * @param {number} energyRange - Energy range (max - min)
     * @returns {Array} Array of color stops for Mapbox
     */
    createColorStops(minEnergy, maxEnergy, energyRange) {
        const colorStops = [];
        const colors = this.getColorScheme(this.selectedColorScale);
        
        try {
            // Analyze building distribution to find the densest range
            const distribution = this.analyzeBuildingDistribution(minEnergy, maxEnergy);
            
            console.log(`Building distribution analysis:`, distribution);
            
        // Create color stops based on building density
        for (let i = 0; i < colors.length; i++) {
            let energyValue;
            if (i < 6) {
                // First 6 levels: distribute across the densest range
                const denseRange = distribution.denseEnd - distribution.denseStart;
                if (denseRange > 0) {
                    energyValue = distribution.denseStart + (denseRange * i / 5);
                } else {
                    // Fallback to uniform distribution if dense range is zero
                    energyValue = minEnergy + (energyRange * i / 5);
                }
            } else {
                // Last level: covers the sparse range (ensure it's different from previous)
                const denseEnd = distribution.denseEnd > distribution.denseStart ? distribution.denseEnd : maxEnergy;
                energyValue = Math.max(denseEnd + (energyRange * 0.01), maxEnergy); // Add small offset to ensure ascending order
            }
            colorStops.push(energyValue, colors[i]);
        }
        } catch (error) {
            console.warn('Error in distribution analysis, using uniform distribution:', error);
            // Fallback to uniform distribution
            for (let i = 0; i < colors.length; i++) {
                const energyValue = minEnergy + (energyRange * i / (colors.length - 1));
                colorStops.push(energyValue, colors[i]);
            }
        }
        
        // Ensure ascending order for Mapbox interpolate expression
        const sortedColorStops = this.ensureAscendingOrder(colorStops);
        
        return sortedColorStops;
    }

    /**
     * Ensure color stops are in ascending order for Mapbox interpolate expression
     * @param {Array} colorStops - Array of color stops
     * @returns {Array} Sorted color stops
     */
    ensureAscendingOrder(colorStops) {
        const pairs = [];
        
        // Group into value-color pairs
        for (let i = 0; i < colorStops.length; i += 2) {
            pairs.push({
                value: colorStops[i],
                color: colorStops[i + 1]
            });
        }
        
        // Sort by value
        pairs.sort((a, b) => a.value - b.value);
        
        // Remove duplicates and ensure minimum difference
        const uniquePairs = [];
        let lastValue = -Infinity;
        
        for (const pair of pairs) {
            if (pair.value > lastValue) {
                uniquePairs.push(pair);
                lastValue = pair.value;
            } else {
                // Add small increment to ensure ascending order
                const adjustedValue = lastValue + 0.001;
                uniquePairs.push({
                    value: adjustedValue,
                    color: pair.color
                });
                lastValue = adjustedValue;
            }
        }
        
        // Flatten back to array
        const result = [];
        for (const pair of uniquePairs) {
            result.push(pair.value, pair.color);
        }
        
        return result;
    }

    /**
     * Analyze building distribution to find the densest energy range
     * @param {number} minEnergy - Minimum energy value
     * @param {number} maxEnergy - Maximum energy value
     * @returns {Object} Distribution analysis result
     */
    analyzeBuildingDistribution(minEnergy, maxEnergy) {
        const buildingData = this.buildingData.features;
        const energyValues = buildingData
            .map(feature => parseFloat(feature.properties[this.selectedEnergyColumn]))
            .filter(energy => !isNaN(energy))
            .sort((a, b) => a - b);
        
        if (energyValues.length === 0) {
            return {
                denseStart: minEnergy,
                denseEnd: maxEnergy,
                denseCount: 0,
                sparseCount: 0,
                totalCount: 0
            };
        }
        
        const energyRange = maxEnergy - minEnergy;
        const numBins = 20; // Divide range into 20 bins
        const binSize = energyRange / numBins;
        const bins = new Array(numBins).fill(0);
        
        // Count buildings in each bin
        energyValues.forEach(energy => {
            const binIndex = Math.min(Math.floor((energy - minEnergy) / binSize), numBins - 1);
            bins[binIndex]++;
        });
        
        // Find the range with maximum density
        let maxDensity = 0;
        let maxDensityStart = minEnergy;
        let maxDensityEnd = maxEnergy;
        
        // Check different range sizes (10%, 20%, 30%, 40%, 50% of total range)
        const rangeSizes = [0.1, 0.2, 0.3, 0.4, 0.5];
        
        rangeSizes.forEach(rangeSize => {
            const rangeBinCount = Math.max(1, Math.floor(numBins * rangeSize));
            
            for (let start = 0; start <= numBins - rangeBinCount; start++) {
                const end = start + rangeBinCount;
                const rangeCount = bins.slice(start, end).reduce((sum, count) => sum + count, 0);
                const density = rangeCount / rangeBinCount; // Average density per bin
                
                if (density > maxDensity) {
                    maxDensity = density;
                    maxDensityStart = minEnergy + (start * binSize);
                    maxDensityEnd = minEnergy + (end * binSize);
                }
            }
        });
        
        // Ensure we have a valid range
        if (maxDensityStart >= maxDensityEnd) {
            maxDensityStart = minEnergy;
            maxDensityEnd = minEnergy + (energyRange * 0.1); // Default to 10% of range
        }
        
        // Calculate counts
        const denseCount = energyValues.filter(energy => 
            energy >= maxDensityStart && energy <= maxDensityEnd
        ).length;
        
        const sparseCount = energyValues.length - denseCount;
        
        return {
            denseStart: maxDensityStart,
            denseEnd: maxDensityEnd,
            denseCount: denseCount,
            sparseCount: sparseCount,
            totalCount: energyValues.length,
            densePercentage: (denseCount / energyValues.length * 100).toFixed(1),
            sparsePercentage: (sparseCount / energyValues.length * 100).toFixed(1)
        };
    }

    /**
     * Get color scheme based on selected scale
     * @param {string} scaleType - Type of color scale
     * @returns {Array} Array of colors
     */
    getColorScheme(scaleType) {
        const colorSchemes = {
            'energy': [
                '#10b981', // Green (lowest)
                '#84cc16', // Light green
                '#eab308', // Yellow
                '#f59e0b', // Orange
                '#f97316', // Dark orange
                '#ef4444', // Red (highest)
                '#dc2626'  // Dark red
            ],
            'temperature': [
                '#3b82f6', // Blue (coldest)
                '#06b6d4', // Cyan
                '#10b981', // Green
                '#eab308', // Yellow
                '#f59e0b', // Orange
                '#ef4444', // Red (hottest)
                '#dc2626'  // Dark red
            ],
            'traffic': [
                '#10b981', // Green (good)
                '#84cc16', // Light green
                '#eab308', // Yellow
                '#f59e0b', // Orange
                '#f97316', // Dark orange
                '#ef4444', // Red (bad)
                '#dc2626'  // Dark red
            ],
            'rainbow': [
                '#ef4444', // Red
                '#f97316', // Orange
                '#eab308', // Yellow
                '#84cc16', // Green
                '#06b6d4', // Cyan
                '#3b82f6', // Blue
                '#8b5cf6'  // Purple
            ]
        };
        
        return colorSchemes[scaleType] || colorSchemes['energy'];
    }

    /**
     * Place a tree at the specified location
     * @param {Array|Object} lngLat - Longitude and latitude coordinates
     * @param {number} legacyHeight - Optional legacy height value
     */
    placeTree(lngLat, legacyHeight) {
        const totalHeight = legacyHeight || (() => {
            const min = Number(document.getElementById('tree-min-height').value);
            const max = Number(document.getElementById('tree-max-height').value);
            return Math.random() * (max - min) + min;
        })();

        const trunkHeight = totalHeight * 0.4;
        const canopyHeight = totalHeight * 0.6;
        const trunkRadius = 0.4; // in meters
        const canopyRadius = 2.5; // in meters
        const treeId = `tree-${this.treeIdCounter++}`;

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
        this.treeTrunkData.features.push(trunkFeature);

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
        this.treeCanopyData.features.push(canopyFeature);

        // Update both sources
        const map = this.core.getMap();
        map.getSource('tree-trunks-source').setData(this.treeTrunkData);
        map.getSource('tree-canopies-source').setData(this.treeCanopyData);

        // Update tree counter if tree module is available
        if (window.app && window.app.tree) {
            window.app.tree.updateTreeCounter();
        }
    }

    /**
     * Delete trees at the specified point
     * @param {Object} point - Point coordinates
     */
    deleteTreesAtPoint(point) {
        const map = this.core.getMap();
        const features = map.queryRenderedFeatures(point, { layers: ['tree-trunks-layer', 'tree-canopies-layer'] });
        if (!features.length) return;

        const idToDelete = features[0].properties.id;
        this.treeTrunkData.features = this.treeTrunkData.features.filter(f => f.properties.id !== idToDelete);
        this.treeCanopyData.features = this.treeCanopyData.features.filter(f => f.properties.id !== idToDelete);

        map.getSource('tree-trunks-source').setData(this.treeTrunkData);
        map.getSource('tree-canopies-source').setData(this.treeCanopyData);

        // Update tree counter if tree module is available
        if (window.app && window.app.tree) {
            window.app.tree.updateTreeCounter();
        }
    }

    /**
     * Reset all data
     */
    reset() {
        this.buildingData = { type: 'FeatureCollection', features: [] };
        this.treeTrunkData = { type: 'FeatureCollection', features: [] };
        this.treeCanopyData = { type: 'FeatureCollection', features: [] };
        this.energyStats = { min: 0, max: 100, hasEnergyData: false };
        this.treeIdCounter = 0;

        const map = this.core.getMap();
        map.getSource('geojson-data').setData(this.buildingData);
        map.getSource('tree-trunks-source').setData(this.treeTrunkData);
        map.getSource('tree-canopies-source').setData(this.treeCanopyData);
        this.updateBuildingColors();

        // Update tree counter if tree module is available
        if (window.app && window.app.tree) {
            window.app.tree.updateTreeCounter();
        }

        // Notify energy statistics module
        if (this.energyStatsModule) {
            this.energyStatsModule.updateStats();
        }
    }

    /**
     * Save current data as GeoJSON
     * @returns {Object} Combined GeoJSON data
     */
    saveData() {
        const buildings = this.buildingData.features;
        const trunks = this.treeTrunkData.features;
        const canopies = this.treeCanopyData.features;

        if (buildings.length || trunks.length) {
            return {
                type: 'FeatureCollection',
                features: [...buildings, ...trunks, ...canopies]
            };
        }
        return null;
    }

    /**
     * Get building data
     * @returns {Object} Building data
     */
    getBuildingData() {
        return this.buildingData;
    }

    /**
     * Get tree trunk data
     * @returns {Object} Tree trunk data
     */
    getTreeTrunkData() {
        return this.treeTrunkData;
    }

    /**
     * Get tree canopy data
     * @returns {Object} Tree canopy data
     */
    getTreeCanopyData() {
        return this.treeCanopyData;
    }

    /**
     * Get energy statistics
     * @returns {Object} Energy statistics
     */
    getEnergyStats() {
        return this.energyStats;
    }

    /**
     * Update a building feature
     * @param {number} featureId - Feature ID to update
     * @param {Object} newProperties - New properties for the feature
     */
    updateBuildingFeature(featureId, newProperties) {
        const featureToUpdate = this.buildingData.features.find(f => f.properties.ID === featureId);
        if (featureToUpdate) {
            featureToUpdate.properties = newProperties;
            const map = this.core.getMap();
            map.getSource('geojson-data').setData(this.buildingData);
            return true;
        }
        return false;
    }

    /**
     * Set the selected energy column
     * @param {string} energyColumn - Name of the energy column to use
     */
    setEnergyColumn(energyColumn) {
        this.selectedEnergyColumn = energyColumn;
        
        // Recalculate energy statistics with new column
        this.energyStats = UtilsModule.calculateEnergyStats(this.buildingData.features, this.selectedEnergyColumn);
        
        // Update building colors
        this.updateBuildingColors();
        
        // Notify energy statistics module
        if (this.energyStatsModule) {
            this.energyStatsModule.updateStats();
        }
    }

    /**
     * Get the currently selected energy column
     * @returns {string} Currently selected energy column
     */
    getSelectedEnergyColumn() {
        return this.selectedEnergyColumn;
    }

    /**
     * Set the selected color scale
     * @param {string} colorScale - Name of the color scale to use
     */
    setColorScale(colorScale) {
        this.selectedColorScale = colorScale;
        
        // Update building colors with new scale
        this.updateBuildingColors();
        
        console.log(`✓ Color scale changed to: ${colorScale}`);
    }

    /**
     * Get the currently selected color scale
     * @returns {string} Currently selected color scale
     */
    getSelectedColorScale() {
        return this.selectedColorScale;
    }
}

// Export for use in other modules
window.DataModule = DataModule;
