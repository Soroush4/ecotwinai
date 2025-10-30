/**
 * Sun Module - Sun simulation and lighting effects
 * Handles sun position calculation and lighting effects
 */

class SunModule {
    constructor(coreModule) {
        this.core = coreModule;
        this.sunSimUIPairs = [
            { slider: 'sun-month-slider', input: 'sun-month-input' },
            { slider: 'sun-day-slider', input: 'sun-day-input' },
            { slider: 'sun-hour-slider', input: 'sun-hour-input' },
            { slider: 'sun-minute-slider', input: 'sun-minute-input' }
        ];
    }

    /**
     * Initialize sun module (without updating sun position)
     */
    initialize() {
        this.setupEventListeners();
    }

    /**
     * Initialize sun position (call this after map is loaded)
     */
    initializeSunPosition() {
        this.updateSunPosition();
    }

    /**
     * Setup event listeners for sun simulation controls
     */
    setupEventListeners() {
        this.sunSimUIPairs.forEach(pair => {
            const slider = document.getElementById(pair.slider);
            const input = document.getElementById(pair.input);
            this.syncInputs(slider, input);
        });
    }

    /**
     * Sync slider and input controls
     * @param {HTMLElement} sliderEl - Slider element
     * @param {HTMLElement} inputEl - Input element
     */
    syncInputs(sliderEl, inputEl) {
        sliderEl.addEventListener('input', () => {
            inputEl.value = sliderEl.value;
            this.updateSunPosition();
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
            this.updateSunPosition();
        });
    }

    /**
     * Update sun position and lighting
     */
    updateSunPosition() {
        const map = this.core.getMap();
        
        // Check if map is ready
        if (!map.isStyleLoaded()) {
            console.warn('Map style not loaded yet, retrying sun position update...');
            setTimeout(() => this.updateSunPosition(), 100);
            return;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = parseInt(document.getElementById('sun-month-slider').value) - 1;
        const day = parseInt(document.getElementById('sun-day-slider').value);
        const hour = parseInt(document.getElementById('sun-hour-slider').value);
        const minute = parseInt(document.getElementById('sun-minute-slider').value);

        // Validate date
        if (!UtilsModule.validateDate(year, month, day, hour, minute)) {
            console.error("Invalid date values for sun calculation.");
            return;
        }

        // Create a local date object to match the user's perception of time
        const date = new Date(year, month, day, hour, minute);
        const lat = 40.7128; // New York City latitude
        const lon = -74.0060; // New York City longitude

        const sunPosition = SunCalc.getPosition(date, lat, lon);

        // Calculate sun properties for Mapbox's modern lighting system
        const sunAzimuth = (sunPosition.azimuth * 180 / Math.PI) + 180;
        const sunPolarAngle = 90 - (sunPosition.altitude * 180 / Math.PI);

        // When the sun is below the horizon, altitude is negative.
        // The light should have zero intensity and a valid polar angle.
        const sunIntensity = Math.max(0, Math.sin(sunPosition.altitude));

        try {
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
        } catch (error) {
            console.warn('Failed to set sun lights, retrying...', error);
            setTimeout(() => this.updateSunPosition(), 100);
        }
    }

    /**
     * Get current sun simulation values
     * @returns {Object} Current sun simulation values
     */
    getCurrentValues() {
        return {
            month: parseInt(document.getElementById('sun-month-slider').value),
            day: parseInt(document.getElementById('sun-day-slider').value),
            hour: parseInt(document.getElementById('sun-hour-slider').value),
            minute: parseInt(document.getElementById('sun-minute-slider').value)
        };
    }

    /**
     * Set sun simulation values
     * @param {Object} values - Values to set
     */
    setValues(values) {
        if (values.month !== undefined) {
            document.getElementById('sun-month-slider').value = values.month;
            document.getElementById('sun-month-input').value = values.month;
        }
        if (values.day !== undefined) {
            document.getElementById('sun-day-slider').value = values.day;
            document.getElementById('sun-day-input').value = values.day;
        }
        if (values.hour !== undefined) {
            document.getElementById('sun-hour-slider').value = values.hour;
            document.getElementById('sun-hour-input').value = values.hour;
        }
        if (values.minute !== undefined) {
            document.getElementById('sun-minute-slider').value = values.minute;
            document.getElementById('sun-minute-input').value = values.minute;
        }
        this.updateSunPosition();
    }

    /**
     * Reset sun simulation to current time
     */
    resetToCurrentTime() {
        const now = new Date();
        this.setValues({
            month: now.getMonth() + 1,
            day: now.getDate(),
            hour: now.getHours(),
            minute: now.getMinutes()
        });
    }
}

// Export for use in other modules
window.SunModule = SunModule;
