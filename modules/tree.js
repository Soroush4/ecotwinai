/**
 * Tree Module - Tree simulation and management
 * Handles tree creation, deletion, and interaction
 */

class TreeModule {
    constructor(coreModule, dataModule) {
        this.core = coreModule;
        this.data = dataModule;
        this.currentTreeMode = null;
        this.isDragging = false;
        this.lastTreePosition = null;
        this.layersSetup = false;
    }

    /**
     * Initialize tree module (without map layers)
     */
    initialize() {
        this.setupEventListeners();
        this.updateTreeCounter();
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
     * Set tree mode (multi, delete, or null)
     * @param {string|null} mode - Tree mode
     */
    setTreeMode(mode) {
        if (this.currentTreeMode === mode) {
            this.currentTreeMode = null;
        } else {
            this.currentTreeMode = mode;
        }

        this.updateTreeButtons();
        const map = this.core.getMap();
        map.getCanvas().style.cursor = this.currentTreeMode ? 'crosshair' : '';
    }

    /**
     * Update tree button states
     */
    updateTreeButtons() {
        const treeModeMultiBtn = document.getElementById('tree-mode-multi');
        const treeModeDeleteBtn = document.getElementById('tree-mode-delete');
        const treeCreatorBtns = [treeModeMultiBtn, treeModeDeleteBtn];

        treeCreatorBtns.forEach(btn => {
            const btnMode = btn.id.split('-')[2];
            if (btnMode === this.currentTreeMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * Setup event listeners for tree functionality
     */
    setupEventListeners() {
        const treeModeMultiBtn = document.getElementById('tree-mode-multi');
        const treeModeDeleteBtn = document.getElementById('tree-mode-delete');
        const treeDeleteAllBtn = document.getElementById('tree-delete-all');
        const treeCreatorBtns = [treeModeMultiBtn, treeModeDeleteBtn];

        treeCreatorBtns.forEach(btn => {
            btn.addEventListener('click', () => this.setTreeMode(btn.id.split('-')[2]));
        });

        // Delete all trees button
        treeDeleteAllBtn.addEventListener('click', () => {
            this.deleteAllTrees();
        });

        const map = this.core.getMap();

        // Map click events
        map.on('click', (e) => {
            if (this.currentTreeMode === 'delete') {
                this.data.deleteTreesAtPoint(e.point);
            }
        });

        // Mouse events for tree placement
        map.on('mousedown', (e) => {
            if (e.originalEvent.button !== 0) return;
            if (this.currentTreeMode) e.preventDefault();

            if (this.currentTreeMode === 'multi') {
                this.isDragging = true;
                map.dragPan.disable();
                this.data.placeTree(e.lngLat);
                this.lastTreePosition = e.lngLat;
            } else if (this.currentTreeMode === 'delete') {
                this.isDragging = true;
                map.dragPan.disable();
                this.data.deleteTreesAtPoint(e.point);
            }
        });

        // Throttled mouse move for tree placement
        map.on('mousemove', UtilsModule.throttle((e) => {
            if (!this.isDragging) return;
            if (this.currentTreeMode === 'multi') {
                const distance = turf.distance(
                    [this.lastTreePosition.lng, this.lastTreePosition.lat],
                    [e.lngLat.lng, e.lngLat.lat],
                    { units: 'meters' }
                );
                const minDistance = document.getElementById('tree-distance').value;
                if (distance > minDistance) {
                    this.data.placeTree(e.lngLat);
                    this.lastTreePosition = e.lngLat;
                }
            } else if (this.currentTreeMode === 'delete') {
                this.data.deleteTreesAtPoint(e.point);
            }
        }, 100));

        map.on('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.lastTreePosition = null;
                if (!this.currentTreeMode) {
                    map.dragPan.enable();
                }
            }
            if (this.currentTreeMode !== 'multi' && this.currentTreeMode !== 'delete') {
                map.dragPan.enable();
            }
        });

        // Cursor changes for tree layers
        map.on('mouseenter', 'tree-trunks-layer', () => { 
            if (!this.currentTreeMode) map.getCanvas().style.cursor = 'pointer'; 
        });
        map.on('mouseleave', 'tree-trunks-layer', () => { 
            if (!this.currentTreeMode) map.getCanvas().style.cursor = ''; 
        });
        map.on('mouseenter', 'tree-canopies-layer', () => { 
            if (!this.currentTreeMode) map.getCanvas().style.cursor = 'pointer'; 
        });
        map.on('mouseleave', 'tree-canopies-layer', () => { 
            if (!this.currentTreeMode) map.getCanvas().style.cursor = ''; 
        });
    }

    /**
     * Setup map layers for trees (internal method)
     */
    setupMapLayersInternal() {
        const map = this.core.getMap();

        // Check if map is ready
        if (!map.isStyleLoaded()) {
            console.warn('Map style not loaded yet, retrying...');
            setTimeout(() => this.setupMapLayersInternal(), 100);
            return;
        }

        // Add sources for tree parts
        map.addSource('tree-trunks-source', {
            type: 'geojson',
            data: this.data.getTreeTrunkData()
        });
        map.addSource('tree-canopies-source', {
            type: 'geojson',
            data: this.data.getTreeCanopyData()
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

        this.layersSetup = true;
        console.log('✓ Tree layers setup complete');
    }

    /**
     * Get current tree mode
     * @returns {string|null} Current tree mode
     */
    getCurrentTreeMode() {
        return this.currentTreeMode;
    }

    /**
     * Reset tree mode
     */
    resetTreeMode() {
        this.setTreeMode(null);
    }

    /**
     * Delete all trees
     */
    deleteAllTrees() {
        // Reset tree data
        this.data.treeTrunkData = { type: 'FeatureCollection', features: [] };
        this.data.treeCanopyData = { type: 'FeatureCollection', features: [] };
        this.data.treeIdCounter = 0;

        // Update map sources
        const map = this.core.getMap();
        map.getSource('tree-trunks-source').setData(this.data.treeTrunkData);
        map.getSource('tree-canopies-source').setData(this.data.treeCanopyData);

        // Update tree counter
        this.updateTreeCounter();

        console.log('✓ All trees deleted');
    }

    /**
     * Update tree counter display
     */
    updateTreeCounter() {
        const treeCount = this.data.treeTrunkData.features.length;
        const counterElement = document.getElementById('tree-count');
        if (counterElement) {
            counterElement.textContent = treeCount;
            
            // Add visual feedback for loaded trees
            if (treeCount > 0) {
                counterElement.style.color = '#10b981';
                counterElement.style.fontWeight = '600';
            } else {
                counterElement.style.color = '#6b7280';
                counterElement.style.fontWeight = '500';
            }
        }
    }
}

// Export for use in other modules
window.TreeModule = TreeModule;
