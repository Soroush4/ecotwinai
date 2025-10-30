/**
 * Core Module - Map initialization and basic functionality
 * Handles Mapbox configuration, map setup, and core application initialization
 */

class CoreModule {
    constructor() {
        this.mapboxConfig = null;
        this.map = null;
        this.isInitialized = false;
    }

    /**
     * Load Mapbox configuration from backend
     */
    async loadMapboxConfig() {
        try {
            const base = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : '';
            const response = await fetch(`${base}/api/mapbox-config`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.mapboxConfig = await response.json();
            
            // Initialize map with configuration from backend
            mapboxgl.accessToken = this.mapboxConfig.accessToken;
            
            this.map = new mapboxgl.Map({
                container: 'map',
                style: this.mapboxConfig.style,
                center: this.mapboxConfig.center,
                zoom: this.mapboxConfig.zoom,
                pitch: this.mapboxConfig.pitch,
                antialias: this.mapboxConfig.antialias,
                config: this.mapboxConfig.config
            });
            
            return this.map;
            
        } catch (error) {
            console.error('Failed to load Mapbox configuration:', error);
            this.showErrorMessage('Failed to load map configuration. Please check if the server is running.');
            throw error;
        }
    }

    /**
     * Show error message when map fails to load
     */
    showErrorMessage(message) {
        const mapContainer = document.getElementById('map');
        mapContainer.innerHTML = `
            <div style="
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100%;
                background-color: #f8f9fa;
                color: #dc3545;
                font-family: Arial, sans-serif;
                text-align: center;
                padding: 20px;
            ">
                <div>
                    <h3>🚫 Error Loading Map</h3>
                    <p>${message}</p>
                    <button onclick="location.reload()" style="
                        background-color: #007bff;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-top: 10px;
                    ">Retry</button>
                </div>
            </div>
        `;
    }

    /**
     * Initialize the core application
     */
    async initialize() {
        try {
            await this.loadMapboxConfig();
            this.map.addControl(new mapboxgl.NavigationControl());
            this.isInitialized = true;
            return this.map;
        } catch (error) {
            console.error('Failed to initialize core module:', error);
            throw error;
        }
    }

    /**
     * Get the map instance
     */
    getMap() {
        if (!this.isInitialized) {
            throw new Error('Core module not initialized. Call initialize() first.');
        }
        return this.map;
    }

    /**
     * Check if core module is initialized
     */
    isReady() {
        return this.isInitialized && this.map !== null;
    }
}

// Export for use in other modules
window.CoreModule = CoreModule;
