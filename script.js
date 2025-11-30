/**
 * Main Application Script - Modular EcoTwinAI Application
 * Coordinates all modules and initializes the application
 */

// Application state
let app = {
    core: null,
    data: null,
    tree: null,
    sun: null,
    energyStats: null,
    ui: null,
    stlExporter: null,
    isInitialized: false
};

/**
 * Validate that all required modules are available
 */
function validateModules() {
    const requiredModules = [
        'UtilsModule', 'CoreModule', 'DataModule', 
        'TreeModule', 'SunModule', 'EnergyStatsModule', 'UIModule'
    ];
    
    const missingModules = requiredModules.filter(moduleName => {
        return typeof window[moduleName] !== 'function';
    });
    
    if (missingModules.length > 0) {
        throw new Error(`Missing required modules: ${missingModules.join(', ')}`);
    }
    
    return true;
}

/**
 * Update status bar
 */
function updateStatus(message, showLoading = false) {
    const statusText = document.getElementById('status-text');
    const loadingIndicator = document.getElementById('loading-indicator');
    
    if (statusText) {
        statusText.textContent = message;
    }
    
    if (loadingIndicator) {
        loadingIndicator.style.display = showLoading ? 'flex' : 'none';
    }
}

/**
 * Initialize the application with all modules
 */
async function initializeApplication() {
    try {
        updateStatus('Initializing EcoTwinAI application...', true);
        console.log('Initializing EcoTwinAI application...');
        
        // Validate modules are loaded
        validateModules();
        updateStatus('All modules loaded successfully', false);
        console.log('✓ All required modules are available');

        // Initialize core module
        updateStatus('Initializing core module...', true);
        app.core = new CoreModule();
        await app.core.initialize();
        updateStatus('Core module ready', false);
        console.log('✓ Core module initialized');

        // Initialize data module
        updateStatus('Initializing data module...', true);
        app.data = new DataModule(app.core);
        app.data.updateBuildingCounter(); // Initialize building counter
        updateStatus('Data module ready', false);
        console.log('✓ Data module initialized');

        // Initialize tree module (but don't setup map layers yet)
        updateStatus('Initializing tree module...', true);
        app.tree = new TreeModule(app.core, app.data);
        app.tree.initialize();
        updateStatus('Tree module ready', false);
        console.log('✓ Tree module initialized');

        // Initialize sun module
        updateStatus('Initializing sun module...', true);
        app.sun = new SunModule(app.core);
        app.sun.initialize();
        updateStatus('Sun module ready', false);
        console.log('✓ Sun module initialized');

        // Initialize energy statistics module
        updateStatus('Initializing energy statistics module...', true);
        app.energyStats = new EnergyStatsModule(app.core, app.data);
        app.energyStats.initialize();
        app.data.setEnergyStatsModule(app.energyStats);
        updateStatus('Energy statistics module ready', false);
        console.log('✓ Energy statistics module initialized');

        // Initialize UI module (but don't setup map layers yet)
        updateStatus('Initializing UI module...', true);
        app.ui = new UIModule(app.core, app.data, app.tree);
        app.ui.initialize();
        updateStatus('UI module ready', false);
        console.log('✓ UI module initialized');

        // Initialize STL Exporter module
        updateStatus('Initializing STL exporter module...', true);
        app.stlExporter = new STLExporterModule(app.core, app.data);
        app.stlExporter.initialize();
        updateStatus('STL exporter module ready', false);
        console.log('✓ STL exporter module initialized');

        // Setup map load event - initialize modules that need map layers here
        const map = app.core.getMap();
        let mapLayersSetup = false;
        
        // Function to setup map layers when ready
        const setupMapLayersWhenReady = () => {
            if (map.isStyleLoaded() && !mapLayersSetup) {
                updateStatus('Setting up map layers...', true);
                
                // Now that map is loaded, setup map layers for modules
                app.tree.setupMapLayers();
                app.ui.setupMapLayers();
                
                // Set up lighting and initial sun position
                map.setConfigProperty('basemap', 'lightPreset', 'custom');
                app.sun.initializeSunPosition();
                
                mapLayersSetup = true;
                updateStatus('', false);
                console.log('✓ Map loaded and configured');
            } else if (!map.isStyleLoaded()) {
                // Retry after a short delay without showing loading message
                setTimeout(setupMapLayersWhenReady, 100);
            }
        };

        map.on('load', setupMapLayersWhenReady);
        map.on('styledata', setupMapLayersWhenReady);

        app.isInitialized = true;
        console.log('✓ Application fully initialized');
        
        // Make app globally accessible for modules
        window.app = app;
        
        // Setup delete buildings button after everything is ready
        setTimeout(() => {
            if (typeof window.setupDeleteBuildingsButton === 'function') {
                console.log('Setting up delete buildings button...');
                window.setupDeleteBuildingsButton();
            }
        }, 1000);
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        if (app.core) {
            app.core.showErrorMessage('Failed to initialize application. Please refresh the page.');
        } else {
            // Fallback error display if core module failed to initialize
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
                        <h3>🚫 Application Error</h3>
                        <p>Failed to initialize application: ${error.message}</p>
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
    }
}

/**
 * Get application instance (for debugging)
 */
function getApp() {
    return app;
}

// Start the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeApplication();
});
