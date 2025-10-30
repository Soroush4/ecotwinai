/**
 * Utilities Module - Helper functions and common utilities
 * Contains utility functions used across different modules
 */

class UtilsModule {
    /**
     * Find height property with different spellings
     * @param {Object} properties - Feature properties object
     * @returns {number} Height value or default height
     */
    static getHeightProperty(properties) {
        const heightKeys = ['Height', 'height', 'HEIGHT', 'building_height', 'buildingHeight', 'elevation', 'Elevation', 'ELEVATION'];
        
        for (const key of heightKeys) {
            if (properties.hasOwnProperty(key) && properties[key] !== null && properties[key] !== undefined) {
                return properties[key];
            }
        }
        
        // Default height if no height property is found
        return 10; // Default height in feet
    }

    /**
     * Calculate energy statistics from features
     * @param {Array} features - Array of GeoJSON features
     * @param {string} energyColumn - Name of the energy column to use (default: 'TotalEnergy')
     * @returns {Object} Energy statistics object
     */
    static calculateEnergyStats(features, energyColumn = 'TotalEnergy') {
        const energyValues = [];
        
        for (const feature of features) {
            if (feature.properties && feature.properties[energyColumn] !== null && feature.properties[energyColumn] !== undefined) {
                const energy = parseFloat(feature.properties[energyColumn]);
                if (!isNaN(energy)) {
                    energyValues.push(energy);
                }
            }
        }
        
        if (energyValues.length > 0) {
            const min = Math.min(...energyValues);
            const max = Math.max(...energyValues);
            console.log(`Energy range detected for column '${energyColumn}': ${min} to ${max}`);
            return { min, max, hasEnergyData: true, column: energyColumn };
        } else {
            console.log(`No ${energyColumn} data found, using default range`);
            return { min: 0, max: 100, hasEnergyData: false, column: energyColumn };
        }
    }

    /**
     * Throttle function to limit function calls
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    static throttle(func, limit) {
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

    /**
     * Validate date values for sun calculation
     * @param {number} year - Year
     * @param {number} month - Month (0-11)
     * @param {number} day - Day (1-31)
     * @param {number} hour - Hour (0-23)
     * @param {number} minute - Minute (0-59)
     * @returns {boolean} True if date is valid
     */
    static validateDate(year, month, day, hour, minute) {
        const date = new Date(year, month, day, hour, minute);
        return !isNaN(date.getTime());
    }

    /**
     * Generate unique ID
     * @param {string} prefix - Prefix for the ID
     * @returns {string} Unique ID
     */
    static generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Deep clone an object
     * @param {Object} obj - Object to clone
     * @returns {Object} Cloned object
     */
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Check if a value is a valid number
     * @param {any} value - Value to check
     * @returns {boolean} True if value is a valid number
     */
    static isValidNumber(value) {
        return !isNaN(Number(value)) && value !== '';
    }

    /**
     * Convert feet to meters
     * @param {number} feet - Value in feet
     * @returns {number} Value in meters
     */
    static feetToMeters(feet) {
        return feet * 0.3048;
    }

    /**
     * Convert meters to feet
     * @param {number} meters - Value in meters
     * @returns {number} Value in feet
     */
    static metersToFeet(meters) {
        return meters / 0.3048;
    }
}

// Export for use in other modules
window.UtilsModule = UtilsModule;
