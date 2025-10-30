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
        this.setupEventListeners();
        this.updateDisplay();
    }

    /**
     * Setup event listeners for energy statistics
     */
    setupEventListeners() {
        // Listen for data changes from data module
        // This will be called when data is loaded or updated
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
