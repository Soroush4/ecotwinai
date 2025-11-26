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
        this.brushShape = null; // Current brush shape feature
        this.polygonPoints = []; // Points for custom polygon
        this.isDrawingPolygon = false; // Flag for polygon drawing mode
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
        const treeModeBrushBtn = document.getElementById('tree-mode-brush');
        const treeModeDeleteBtn = document.getElementById('tree-mode-delete');
        const treeCreatorBtns = [treeModeMultiBtn, treeModeBrushBtn, treeModeDeleteBtn];

        treeCreatorBtns.forEach(btn => {
            const btnMode = btn.id.split('-')[2];
            if (btnMode === this.currentTreeMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Show/hide brush parameters
        const brushParams = document.getElementById('brush-params');
        if (brushParams) {
            brushParams.style.display = this.currentTreeMode === 'brush' ? 'block' : 'none';
        }
        
        // Clear brush shape when mode changes
        if (this.currentTreeMode !== 'brush') {
            this.clearBrushShape();
            this.cancelPolygon();
        } else {
            this.updateBrushShapeUI();
        }
    }

    /**
     * Setup event listeners for tree functionality
     */
    setupEventListeners() {
        const treeModeMultiBtn = document.getElementById('tree-mode-multi');
        const treeModeBrushBtn = document.getElementById('tree-mode-brush');
        const treeModeDeleteBtn = document.getElementById('tree-mode-delete');
        const treeDeleteAllBtn = document.getElementById('tree-delete-all');
        const treeCreatorBtns = [treeModeMultiBtn, treeModeBrushBtn, treeModeDeleteBtn];

        treeCreatorBtns.forEach(btn => {
            btn.addEventListener('click', () => this.setTreeMode(btn.id.split('-')[2]));
        });

        // Delete all trees button
        treeDeleteAllBtn.addEventListener('click', () => {
            this.deleteAllTrees();
        });
        
        // Brush shape selector - update UI immediately on change
        const brushShapeSelector = document.getElementById('brush-shape');
        if (brushShapeSelector) {
            brushShapeSelector.addEventListener('change', () => {
                this.updateBrushShapeUI();
            });
        }

        const map = this.core.getMap();

        // Map click events
        map.on('click', (e) => {
            if (this.currentTreeMode === 'delete') {
                this.data.deleteTreesAtPoint(e.point);
            } else if (this.currentTreeMode === 'brush') {
                const brushShape = document.getElementById('brush-shape').value;
                
                if (brushShape === 'polygon') {
                    // Handle polygon drawing
                    if (this.isDrawingPolygon) {
                        // Add point to polygon
                        this.polygonPoints.push([e.lngLat.lng, e.lngLat.lat]);
                        this.updatePolygonPreview();
                    } else {
                        // Start drawing polygon
                        this.startDrawingPolygon(e.lngLat);
                    }
                } else {
                    // Place trees in shape (circle or square)
                    const brushSize = Number(document.getElementById('brush-radius').value);
                    const brushCount = Number(document.getElementById('brush-count').value);
                    this.data.placeTreesInShape(e.lngLat, brushShape, brushSize, brushCount);
                }
            }
        });
        
        // Double-click to finish polygon
        map.on('dblclick', (e) => {
            if (this.currentTreeMode === 'brush' && this.isDrawingPolygon) {
                e.preventDefault();
                this.finishPolygon();
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

        // Throttled mouse move for tree placement and brush preview
        map.on('mousemove', UtilsModule.throttle((e) => {
            if (this.currentTreeMode === 'brush' && !this.isDrawingPolygon) {
                // Update brush shape preview
                this.updateBrushShape(e.lngLat);
            } else if (this.isDrawingPolygon && this.polygonPoints.length > 0) {
                // Update polygon preview with current mouse position
                this.updatePolygonPreview(e.lngLat);
            } else if (this.isDragging) {
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
            }
        }, 50));

        map.on('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.lastTreePosition = null;
                if (!this.currentTreeMode) {
                    map.dragPan.enable();
                }
            }
            if (this.currentTreeMode !== 'multi' && this.currentTreeMode !== 'delete' && this.currentTreeMode !== 'brush') {
                map.dragPan.enable();
            }
        });
        
        // Disable drag pan when brush mode is active
        map.on('mousedown', (e) => {
            if (this.currentTreeMode === 'brush' && e.originalEvent.button === 0) {
                map.dragPan.disable();
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

        // Add source and layer for brush circle preview
        map.addSource('brush-circle-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        map.addLayer({
            'id': 'brush-circle-layer',
            'type': 'fill',
            'source': 'brush-circle-source',
            'paint': {
                'fill-color': '#3b82f6',
                'fill-opacity': 0.2
            }
        });

        map.addLayer({
            'id': 'brush-circle-outline-layer',
            'type': 'line',
            'source': 'brush-circle-source',
            'paint': {
                'line-color': '#3b82f6',
                'line-width': 2,
                'line-opacity': 0.6,
                'line-dasharray': [2, 2]
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

    /**
     * Update brush shape preview at mouse position
     * @param {Object} lngLat - Longitude and latitude coordinates
     */
    updateBrushShape(lngLat) {
        if (this.currentTreeMode !== 'brush' || this.isDrawingPolygon) return;
        
        const map = this.core.getMap();
        if (!map.getSource('brush-circle-source')) return;
        
        const brushShape = document.getElementById('brush-shape').value;
        const brushSize = Number(document.getElementById('brush-radius').value);
        const centerPoint = turf.point([lngLat.lng, lngLat.lat]);
        
        let shapeFeature;
        
        if (brushShape === 'circle') {
            const circle = turf.circle(centerPoint, brushSize, { units: 'meters', steps: 64 });
            shapeFeature = {
                type: 'Feature',
                geometry: circle.geometry,
                properties: {}
            };
        } else if (brushShape === 'square') {
            // Create square: half size in each direction
            const halfSize = brushSize / 2;
            // Convert meters to degrees (approximate)
            const latOffset = halfSize / 111320; // 1 degree latitude ≈ 111320 meters
            const lngOffset = halfSize / (111320 * Math.cos(lngLat.lat * Math.PI / 180));
            
            const bbox = [
                lngLat.lng - lngOffset, // min longitude
                lngLat.lat - latOffset, // min latitude
                lngLat.lng + lngOffset, // max longitude
                lngLat.lat + latOffset  // max latitude
            ];
            const square = turf.bboxPolygon(bbox);
            shapeFeature = {
                type: 'Feature',
                geometry: square.geometry,
                properties: {}
            };
        } else {
            return; // Polygon is handled separately
        }
        
        this.brushShape = shapeFeature;
        
        map.getSource('brush-circle-source').setData({
            type: 'FeatureCollection',
            features: [this.brushShape]
        });
    }

    /**
     * Clear brush shape preview
     */
    clearBrushShape() {
        const map = this.core.getMap();
        if (map.getSource('brush-circle-source')) {
            map.getSource('brush-circle-source').setData({
                type: 'FeatureCollection',
                features: []
            });
        }
        this.brushShape = null;
    }

    /**
     * Update brush shape UI based on selected shape
     */
    updateBrushShapeUI() {
        const brushShape = document.getElementById('brush-shape').value;
        const brushSizeRow = document.getElementById('brush-size-row');
        const brushSizeGroup = document.getElementById('brush-size-group');
        const brushCountGroup = document.getElementById('brush-count-group');
        const polygonControls = document.getElementById('polygon-controls');
        const brushSizeLabel = document.getElementById('brush-size-label');
        
        if (brushShape === 'polygon') {
            // Hide only size parameter, keep Tree Count visible
            if (brushSizeGroup) brushSizeGroup.style.display = 'none';
            if (brushCountGroup) brushCountGroup.style.display = 'block';
            if (brushSizeRow) brushSizeRow.style.display = 'flex';
            if (polygonControls) polygonControls.style.display = 'block';
        } else {
            // Show both size and count parameters
            if (brushSizeGroup) brushSizeGroup.style.display = 'block';
            if (brushCountGroup) brushCountGroup.style.display = 'block';
            if (brushSizeRow) brushSizeRow.style.display = 'flex';
            if (polygonControls) polygonControls.style.display = 'none';
            
            // Update label text immediately
            if (brushSizeLabel) {
                if (brushShape === 'circle') {
                    brushSizeLabel.textContent = 'Radius (m)';
                } else if (brushShape === 'square') {
                    brushSizeLabel.textContent = 'Side Length (m)';
                }
            }
            
            this.cancelPolygon();
        }
    }

    /**
     * Start drawing custom polygon
     * @param {Object} lngLat - Initial point coordinates
     */
    startDrawingPolygon(lngLat) {
        this.isDrawingPolygon = true;
        this.polygonPoints = [[lngLat.lng, lngLat.lat]];
        this.updatePolygonPreview();
        
        const map = this.core.getMap();
        map.getCanvas().style.cursor = 'crosshair';
    }

    /**
     * Update polygon preview
     * @param {Object} currentLngLat - Current mouse position (optional)
     */
    updatePolygonPreview(currentLngLat = null) {
        if (this.polygonPoints.length < 2) return;
        
        const map = this.core.getMap();
        if (!map.getSource('brush-circle-source')) return;
        
        let points = [...this.polygonPoints];
        if (currentLngLat) {
            points.push([currentLngLat.lng, currentLngLat.lat]);
        }
        
        // Close polygon if we have at least 3 points
        if (points.length >= 3) {
            points.push(points[0]); // Close the polygon
        }
        
        const polygon = turf.polygon([points]);
        
        this.brushShape = {
            type: 'Feature',
            geometry: polygon.geometry,
            properties: {}
        };
        
        map.getSource('brush-circle-source').setData({
            type: 'FeatureCollection',
            features: [this.brushShape]
        });
    }

    /**
     * Finish polygon and place trees
     */
    finishPolygon() {
        if (this.polygonPoints.length < 3) {
            alert('Polygon needs at least 3 points');
            return;
        }
        
        // Close the polygon
        const closedPoints = [...this.polygonPoints, this.polygonPoints[0]];
        const polygon = turf.polygon([closedPoints]);
        
        const brushCount = Number(document.getElementById('brush-count').value);
        this.data.placeTreesInPolygon(polygon, brushCount);
        
        // Reset polygon drawing
        this.cancelPolygon();
    }

    /**
     * Cancel polygon drawing
     */
    cancelPolygon() {
        this.isDrawingPolygon = false;
        this.polygonPoints = [];
        this.clearBrushShape();
        
        const map = this.core.getMap();
        if (map) {
            map.getCanvas().style.cursor = '';
        }
    }
}

// Export for use in other modules
window.TreeModule = TreeModule;
