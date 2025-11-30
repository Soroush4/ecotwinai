/**
 * Energy Statistics Module - Energy consumption statistics and legend management
 * Handles energy statistics display, legend updates, and data visualization
 */

class EnergyStatsModule {
    constructor(coreModule, dataModule) {
        this.core = coreModule;
        this.data = dataModule;
        this.currentStats = {
            buildingCount: 0,
            minEnergy: 0,
            maxEnergy: 100,
            hasEnergyData: false
        };
    }

    /**
     * Initialize energy statistics module
     */
    initialize() {
        console.log('=== EnergyStatsModule.initialize called ===');
        console.log('Data module:', this.data);
        console.log('Core module:', this.core);
        
        this.setupEventListeners();
        this.updateDisplay();
        
        console.log('=== EnergyStatsModule.initialize completed ===');
    }

    /**
     * Setup event listeners for energy statistics
     */
    setupEventListeners() {
        console.log('=== EnergyStatsModule.setupEventListeners called ===');
        
        // Store reference to this for use in event handlers
        const self = this;
        
        // Use event delegation on document for reliability
        // This works even if button is added later
        const clickHandler = function(e) {
            const target = e.target;
            const button = target.closest('#delete-all-buildings') || 
                         (target.id === 'delete-all-buildings' ? target : null) ||
                         (target.closest('button') && target.closest('button').id === 'delete-all-buildings' ? target.closest('button') : null);
            
            if (button) {
                console.log('=== Delete All Buildings button clicked (via delegation) ===');
                console.log('Button element:', button);
                console.log('Event target:', target);
                e.preventDefault();
                e.stopPropagation();
                self.handleDeleteAllBuildings();
            }
        };
        
        document.addEventListener('click', clickHandler, true); // Use capture phase
        console.log('✓ Event delegation listener attached to document (capture phase)');
        
        // Also try direct attachment as backup
        const setupDeleteButton = () => {
            const deleteAllBuildingsBtn = document.getElementById('delete-all-buildings');
            console.log('Direct attachment: Looking for delete-all-buildings button:', deleteAllBuildingsBtn);
            
            if (deleteAllBuildingsBtn) {
                // Remove any existing listeners by cloning
                const newBtn = deleteAllBuildingsBtn.cloneNode(true);
                deleteAllBuildingsBtn.parentNode.replaceChild(newBtn, deleteAllBuildingsBtn);
                
                newBtn.addEventListener('click', (e) => {
                    console.log('=== Delete All Buildings button clicked (via direct) ===');
                    e.preventDefault();
                    e.stopPropagation();
                    self.handleDeleteAllBuildings();
                }, true); // Use capture phase
                console.log('✓ Direct event listener attached to delete-all-buildings button');
                return true;
            } else {
                console.warn('⚠ delete-all-buildings button not found for direct attachment');
                return false;
            }
        };
        
        // Try immediately
        if (!setupDeleteButton()) {
            // Retry after DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    console.log('DOMContentLoaded fired, retrying button attachment...');
                    setupDeleteButton();
                });
            } else {
                // DOM already loaded, retry after delay
                setTimeout(() => {
                    console.log('Retrying button attachment after delay...');
                    if (!setupDeleteButton()) {
                        setTimeout(() => {
                            console.log('Final retry for button attachment...');
                            setupDeleteButton();
                        }, 500);
                    }
                }, 100);
            }
        }
        
        console.log('=== setupEventListeners completed ===');
    }

    /**
     * Handle delete all buildings action
     */
    handleDeleteAllBuildings() {
        console.log('Delete all buildings button clicked');
        
        // Get data module - try multiple sources
        let dataModule = this.data;
        if (!dataModule && window.app && window.app.data) {
            console.log('Using data module from global app');
            dataModule = window.app.data;
        }
        
        if (!dataModule) {
            console.error('Data module not available');
            alert('Error: Data module not initialized. Please refresh the page.');
            return;
        }
        
        // Get building data
        let buildingData;
        try {
            if (typeof dataModule.getBuildingData === 'function') {
                buildingData = dataModule.getBuildingData();
            } else if (dataModule.buildingData) {
                // Direct access as fallback
                buildingData = dataModule.buildingData;
            } else {
                throw new Error('Cannot access building data');
            }
        } catch (error) {
            console.error('Error getting building data:', error);
            alert('Error: Could not access building data');
            return;
        }
        
        console.log('Building data:', buildingData);
        
        if (!buildingData || !buildingData.features) {
            console.error('Invalid building data structure');
            alert('Error: Invalid building data structure');
            return;
        }
        
        const buildingCount = buildingData.features.length;
        console.log(`Building count: ${buildingCount}`);
        
        // Check if buildings exist
        if (buildingCount === 0) {
            alert('No buildings to delete!');
            return;
        }
        
        // Confirm deletion
        if (confirm(`Are you sure you want to delete all ${buildingCount} buildings?`)) {
            console.log('User confirmed deletion');
            
            try {
                if (typeof dataModule.deleteAllBuildings === 'function') {
                    dataModule.deleteAllBuildings();
                } else {
                    // Fallback: manually delete buildings
                    console.log('Using fallback deletion method');
                    dataModule.buildingData = { type: 'FeatureCollection', features: [] };
                    const map = this.core.getMap();
                    if (map && map.getSource('geojson-data')) {
                        map.getSource('geojson-data').setData(dataModule.buildingData);
                    }
                    if (typeof dataModule.updateBuildingCounter === 'function') {
                        dataModule.updateBuildingCounter();
                    }
                    if (this.data.energyStatsModule) {
                        this.data.energyStatsModule.updateStats();
                    }
                }
                console.log('Buildings deleted successfully');
            } catch (error) {
                console.error('Error deleting buildings:', error);
                alert('Error: Could not delete buildings. ' + error.message);
            }
        } else {
            console.log('User cancelled deletion');
        }
    }

    /**
     * Update energy statistics from data module
     */
    updateStats() {
        const buildingData = this.data.getBuildingData();
        const energyStats = this.data.getEnergyStats();
        const selectedColumn = this.data.getSelectedEnergyColumn();
        
        // Calculate average energy consumption
        let averageEnergy = 0;
        if (energyStats.hasEnergyData && buildingData.features.length > 0) {
            const energyValues = buildingData.features
                .map(feature => feature.properties[selectedColumn])
                .filter(energy => energy !== null && energy !== undefined && !isNaN(energy))
                .map(energy => parseFloat(energy));
            
            if (energyValues.length > 0) {
                averageEnergy = energyValues.reduce((sum, energy) => sum + energy, 0) / energyValues.length;
            }
        }
        
        this.currentStats = {
            buildingCount: buildingData.features.length,
            minEnergy: energyStats.min,
            maxEnergy: energyStats.max,
            averageEnergy: averageEnergy,
            hasEnergyData: energyStats.hasEnergyData,
            selectedColumn: selectedColumn
        };

        this.updateDisplay();
    }

    /**
     * Update the display with current statistics
     */
    updateDisplay() {
        this.updateBuildingCount();
        this.updateEnergyRange();
        this.updateLegendValues();
        this.updateAverageEnergy();
        this.updateLegendValueRanges();
        this.updateDistributionInfo();
    }

    /**
     * Update building count display
     */
    updateBuildingCount() {
        const buildingCountElement = document.getElementById('building-count');
        if (buildingCountElement) {
            buildingCountElement.textContent = this.currentStats.buildingCount;
            this.animateValue(buildingCountElement);
        }
    }

    /**
     * Update energy range display
     */
    updateEnergyRange() {
        const energyRangeElement = document.getElementById('energy-range');
        if (energyRangeElement) {
            if (this.currentStats.hasEnergyData) {
                energyRangeElement.textContent = `${this.currentStats.minEnergy.toFixed(1)} - ${this.currentStats.maxEnergy.toFixed(1)}`;
            } else {
                energyRangeElement.textContent = 'No Data';
            }
            this.animateValue(energyRangeElement);
        }
    }

    /**
     * Update legend values
     */
    updateLegendValues() {
        const minEnergyElement = document.getElementById('min-energy');
        const maxEnergyElement = document.getElementById('max-energy');
        
        if (minEnergyElement && maxEnergyElement) {
            if (this.currentStats.hasEnergyData) {
                minEnergyElement.textContent = this.currentStats.minEnergy.toFixed(1);
                maxEnergyElement.textContent = this.currentStats.maxEnergy.toFixed(1);
            } else {
                minEnergyElement.textContent = '0';
                maxEnergyElement.textContent = '100';
            }
        }
    }

    /**
     * Update average energy display
     */
    updateAverageEnergy() {
        const avgEnergyElement = document.getElementById('avg-energy');
        if (avgEnergyElement) {
            if (this.currentStats.hasEnergyData && this.currentStats.averageEnergy > 0) {
                avgEnergyElement.textContent = this.currentStats.averageEnergy.toFixed(1);
            } else {
                avgEnergyElement.textContent = 'N/A';
            }
        }
    }

    /**
     * Animate value update
     * @param {HTMLElement} element - Element to animate
     */
    animateValue(element) {
        element.classList.add('updated');
        setTimeout(() => {
            element.classList.remove('updated');
        }, 600);
    }

    /**
     * Get current statistics
     * @returns {Object} Current energy statistics
     */
    getCurrentStats() {
        return { ...this.currentStats };
    }

    /**
     * Format energy value for display
     * @param {number} value - Energy value to format
     * @returns {string} Formatted energy value
     */
    formatEnergyValue(value) {
        if (value >= 1000) {
            return (value / 1000).toFixed(1) + 'k';
        }
        return value.toFixed(1);
    }

    /**
     * Get energy level for a given value
     * @param {number} value - Energy value
     * @returns {string} Energy level (low, medium, high)
     */
    getEnergyLevel(value) {
        if (!this.currentStats.hasEnergyData) {
            return 'unknown';
        }

        const range = this.currentStats.maxEnergy - this.currentStats.minEnergy;
        const normalizedValue = (value - this.currentStats.minEnergy) / range;

        if (normalizedValue <= 0.33) {
            return 'low';
        } else if (normalizedValue <= 0.66) {
            return 'medium';
        } else {
            return 'high';
        }
    }

    /**
     * Get color for energy level
     * @param {string} level - Energy level
     * @returns {string} Color class
     */
    getEnergyColorClass(level) {
        switch (level) {
            case 'low':
                return 'low';
            case 'medium':
                return 'medium';
            case 'high':
                return 'high';
            default:
                return 'low';
        }
    }


    /**
     * Update legend value ranges based on current energy statistics
     */
    updateLegendValueRanges() {
        if (!this.currentStats.hasEnergyData) {
            // Reset to default values
            const defaultValues = ['100', '85', '70', '50', '30', '15', '0'];
            const valueElements = [
                'legend-max-value', 'legend-high-value', 'legend-medium-high-value',
                'legend-medium-value', 'legend-medium-low-value', 'legend-low-value', 'legend-min-value'
            ];
            
            valueElements.forEach((id, index) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = defaultValues[index];
                }
            });
            return;
        }

        const minEnergy = this.currentStats.minEnergy;
        const maxEnergy = this.currentStats.maxEnergy;
        const energyRange = maxEnergy - minEnergy;

        let legendValues;
        let distribution = null;
        
        try {
            // Get building distribution analysis
            distribution = this.data.analyzeBuildingDistribution(minEnergy, maxEnergy);

            // Calculate values for each legend level using dynamic distribution
            const denseRange = distribution.denseEnd - distribution.denseStart;
            legendValues = [
                maxEnergy, // Very High (covers sparse range)
                distribution.denseEnd, // High (end of dense range)
                distribution.denseStart + (denseRange * 0.8), // Medium-High (80% of dense range)
                distribution.denseStart + (denseRange * 0.6), // Medium (60% of dense range)
                distribution.denseStart + (denseRange * 0.4), // Medium-Low (40% of dense range)
                distribution.denseStart + (denseRange * 0.2), // Low (20% of dense range)
                minEnergy // Very Low (minimum)
            ];
            
            console.log(`Legend values updated with dynamic distribution: Dense range=${distribution.denseStart.toFixed(2)}-${distribution.denseEnd.toFixed(2)} (${distribution.densePercentage}% of buildings), Dense range size=${denseRange.toFixed(2)}`);
        } catch (error) {
            console.warn('Error in legend calculation, using uniform distribution:', error);
            // Fallback to uniform distribution
            legendValues = [
                maxEnergy, // Very High
                minEnergy + (energyRange * 0.83), // High
                minEnergy + (energyRange * 0.67), // Medium-High
                minEnergy + (energyRange * 0.5), // Medium
                minEnergy + (energyRange * 0.33), // Medium-Low
                minEnergy + (energyRange * 0.17), // Low
                minEnergy // Very Low
            ];
        }

        const valueElements = [
            'legend-max-value', 'legend-high-value', 'legend-medium-high-value',
            'legend-medium-value', 'legend-medium-low-value', 'legend-low-value', 'legend-min-value'
        ];

        valueElements.forEach((id, index) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = legendValues[index].toFixed(1);
            }
        });
    }

    /**
     * Update distribution information display
     */
    updateDistributionInfo() {
        if (!this.currentStats.hasEnergyData) {
            const denseRangeElement = document.getElementById('dense-range');
            const densePercentageElement = document.getElementById('dense-percentage');
            
            if (denseRangeElement) denseRangeElement.textContent = 'N/A';
            if (densePercentageElement) densePercentageElement.textContent = 'N/A';
            return;
        }

        const minEnergy = this.currentStats.minEnergy;
        const maxEnergy = this.currentStats.maxEnergy;
        
        try {
            const distribution = this.data.analyzeBuildingDistribution(minEnergy, maxEnergy);

            const denseRangeElement = document.getElementById('dense-range');
            const densePercentageElement = document.getElementById('dense-percentage');
            
            if (denseRangeElement) {
                denseRangeElement.textContent = `${distribution.denseStart.toFixed(0)}-${distribution.denseEnd.toFixed(0)}`;
            }
            
            if (densePercentageElement) {
                densePercentageElement.textContent = `${distribution.densePercentage}%`;
            }
        } catch (error) {
            console.warn('Error updating distribution info:', error);
            const denseRangeElement = document.getElementById('dense-range');
            const densePercentageElement = document.getElementById('dense-percentage');
            
            if (denseRangeElement) denseRangeElement.textContent = 'N/A';
            if (densePercentageElement) densePercentageElement.textContent = 'N/A';
        }
    }

    /**
     * Reset statistics
     */
    reset() {
        this.currentStats = {
            buildingCount: 0,
            minEnergy: 0,
            maxEnergy: 100,
            averageEnergy: 0,
            hasEnergyData: false
        };
        this.updateDisplay();
    }
}

// Export for use in other modules
window.EnergyStatsModule = EnergyStatsModule;

// Global function to setup delete button - call this after page loads
window.setupDeleteBuildingsButton = function() {
    console.log('=== setupDeleteBuildingsButton called ===');
    const btn = document.getElementById('delete-all-buildings');
    console.log('Button found:', btn);
    
    if (!btn) {
        console.error('❌ delete-all-buildings button not found!');
        return false;
    }
    
    // Remove existing listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    // Add click listener
    newBtn.addEventListener('click', function(e) {
        console.log('=== Delete All Buildings button clicked ===');
        e.preventDefault();
        e.stopPropagation();
        
        if (window.app && window.app.energyStats) {
            window.app.energyStats.handleDeleteAllBuildings();
        } else if (window.app && window.app.data) {
            // Fallback: call deleteAllBuildings directly
            console.log('Calling deleteAllBuildings directly from data module');
            window.app.data.deleteAllBuildings();
        } else {
            alert('Error: Application not initialized');
        }
    });
    
    console.log('✓ Delete button listener attached');
    return true;
};

// Auto-setup when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(window.setupDeleteBuildingsButton, 500);
    });
} else {
    setTimeout(window.setupDeleteBuildingsButton, 500);
}

// Debug helper - test delete button manually
window.testDeleteBuildings = function() {
    console.log('=== Manual Test: Delete All Buildings ===');
    const btn = document.getElementById('delete-all-buildings');
    console.log('Button found:', btn);
    if (btn) {
        console.log('Button visible:', btn.offsetParent !== null);
        console.log('Button disabled:', btn.disabled);
        console.log('Button style:', window.getComputedStyle(btn).display);
        
        // Try to trigger click programmatically
        console.log('Attempting programmatic click...');
        btn.click();
    } else {
        console.error('Button not found!');
    }
    
    // Also try via app
    if (window.app && window.app.energyStats) {
        console.log('Trying via app.energyStats...');
        window.app.energyStats.handleDeleteAllBuildings();
    } else if (window.app && window.app.data) {
        console.log('Trying via app.data...');
        window.app.data.deleteAllBuildings();
    } else {
        console.error('app.energyStats and app.data not available!');
    }
};
