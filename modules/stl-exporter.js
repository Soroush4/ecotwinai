/**
 * STL Exporter Module - Export trees to STL format
 * Handles STL file generation for tree trunks and canopies
 */

class STLExporterModule {
    constructor(coreModule, dataModule) {
        this.core = coreModule;
        this.data = dataModule;
    }

    /**
     * Initialize STL exporter module
     */
    initialize() {
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for STL export button
     */
    setupEventListeners() {
        const exportBtn = document.getElementById('export-stl-trees');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportTreesToSTL();
            });
        }
    }

    /**
     * Export trees to STL format
     */
    async exportTreesToSTL() {
        try {
            // Get starting number from input field
            const startNumberInput = document.getElementById('stl-start-number');
            let startNumber = 1; // Default value
            
            if (startNumberInput) {
                const inputValue = parseInt(startNumberInput.value, 10);
                if (!isNaN(inputValue) && inputValue >= 0) {
                    startNumber = inputValue;
                } else {
                    alert('Please enter a valid positive number for start number!');
                    startNumberInput.focus();
                    return;
                }
            } else {
                console.warn('stl-start-number input not found, using default value 1');
            }

            console.log(`Exporting trees with start number: ${startNumber}`);

            // Get file path from user
            const filePath = await this.getSaveFilePath();
            if (!filePath) {
                return; // User cancelled
            }

            // Get tree data
            const treeTrunkData = this.data.getTreeTrunkData();
            const treeCanopyData = this.data.getTreeCanopyData();

            if (treeTrunkData.features.length === 0) {
                alert('No trees to export!');
                return;
            }

            const totalTrees = treeTrunkData.features.length;
            const MAX_TREES_PER_FILE = 50000;

            // Check if we need to split into multiple files
            if (totalTrees > MAX_TREES_PER_FILE) {
                const numFiles = Math.ceil(totalTrees / MAX_TREES_PER_FILE);
                console.log(`Large dataset detected: ${totalTrees} trees. Will split into ${numFiles} files of ${MAX_TREES_PER_FILE} trees each.`);
                
                if (!confirm(`You have ${totalTrees} trees. They will be exported to ${numFiles} separate STL files (${MAX_TREES_PER_FILE} trees per file). Continue?`)) {
                    return; // User cancelled
                }

                // Get base filename (without extension)
                const baseFilename = filePath.replace(/\.stl$/i, '');
                
                // Export in chunks
                await this.exportSTLInChunks(treeTrunkData, treeCanopyData, startNumber, baseFilename, MAX_TREES_PER_FILE);
            } else {
                // Show progress for large datasets
                if (totalTrees > 1000) {
                    console.log(`Large dataset detected: ${totalTrees} trees. This may take a while...`);
                    alert(`Exporting ${totalTrees} trees to STL. This may take a few moments for large datasets.`);
                }

                // For large datasets, use streaming approach
                if (totalTrees > 50000) {
                    console.log(`Very large dataset (${totalTrees} trees). Using streaming export...`);
                    await this.exportSTLStreaming(treeTrunkData, treeCanopyData, startNumber, filePath);
                } else {
                    // Generate STL content (with progress for large datasets)
                    let stlContent;
                    try {
                        stlContent = this.generateSTLContent(treeTrunkData, treeCanopyData, startNumber);
                    } catch (error) {
                        if (error.message.includes('Invalid string length') || error.message.includes('string length')) {
                            console.warn('String concatenation failed, trying streaming approach...');
                            await this.exportSTLStreaming(treeTrunkData, treeCanopyData, startNumber, filePath);
                            return;
                        }
                        throw error;
                    }

                    // Save file
                    this.saveSTLFile(stlContent, filePath);
                }

                console.log(`✓ Exported ${totalTrees} trees to STL file`);
            }
        } catch (error) {
            console.error('Error exporting trees to STL:', error);
            alert(`Error exporting trees: ${error.message}`);
        }
    }

    /**
     * Get starting number from input field
     * @returns {number} Starting number (default: 1)
     */
    getStartNumber() {
        const startNumberInput = document.getElementById('stl-start-number');
        if (startNumberInput) {
            const value = parseInt(startNumberInput.value, 10);
            if (!isNaN(value) && value >= 0) {
                return value;
            }
        }
        return 1; // Default value
    }

    /**
     * Get save file path from user
     * @returns {Promise<string|null>} File path or null if cancelled
     */
    async getSaveFilePath() {
        return new Promise((resolve) => {
            // Get filename from user
            const filename = prompt('Enter filename (without extension):', 'trees');
            if (filename === null || filename.trim() === '') {
                resolve(null);
                return;
            }

            // Clean filename (remove invalid characters)
            const cleanFilename = filename.trim().replace(/[<>:"/\\|?*]/g, '_');
            resolve(cleanFilename + '.stl');
        });
    }

    /**
     * Generate STL content from tree data
     * Uses Array instead of string concatenation to handle large datasets
     * @param {Object} treeTrunkData - Tree trunk GeoJSON data
     * @param {Object} treeCanopyData - Tree canopy GeoJSON data
     * @param {number} startNumber - Starting number for tree numbering
     * @returns {string} STL file content
     */
    generateSTLContent(treeTrunkData, treeCanopyData, startNumber) {
        // Use Array to avoid "Invalid string length" error for large datasets
        const stlParts = [];
        let treeNumber = startNumber;

        console.log(`Generating STL for ${treeTrunkData.features.length} trees...`);

        // Create a map of tree IDs to their trunks and canopies
        const treeMap = new Map();

        // Group trunks by tree ID
        treeTrunkData.features.forEach(trunk => {
            const treeId = trunk.properties.id;
            if (!treeMap.has(treeId)) {
                treeMap.set(treeId, { trunk: null, canopy: null });
            }
            treeMap.get(treeId).trunk = trunk;
        });

        // Group canopies by tree ID
        treeCanopyData.features.forEach(canopy => {
            const treeId = canopy.properties.id;
            if (!treeMap.has(treeId)) {
                treeMap.set(treeId, { trunk: null, canopy: null });
            }
            treeMap.get(treeId).canopy = canopy;
        });

        console.log(`Tree map created: ${treeMap.size} unique trees`);

        // Calculate reference point (center of all trees) for coordinate offset
        // This prevents trees from being compressed in STL
        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;
        
        treeTrunkData.features.forEach(trunk => {
            if (trunk.geometry.type === 'Polygon' && trunk.geometry.coordinates[0]) {
                trunk.geometry.coordinates[0].forEach(coord => {
                    minLng = Math.min(minLng, coord[0]);
                    maxLng = Math.max(maxLng, coord[0]);
                    minLat = Math.min(minLat, coord[1]);
                    maxLat = Math.max(maxLat, coord[1]);
                });
            }
        });
        
        // Calculate center point
        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;
        
        console.log(`Coordinate bounds: lng [${minLng.toFixed(6)}, ${maxLng.toFixed(6)}], lat [${minLat.toFixed(6)}, ${maxLat.toFixed(6)}]`);
        console.log(`Reference center: [${centerLng.toFixed(6)}, ${centerLat.toFixed(6)}]`);
        
        // Store reference point for coordinate conversion
        this.referencePoint = { lng: centerLng, lat: centerLat };

        // Export each tree as a combined solid (trunk + canopy)
        let processedCount = 0;
        const totalTrees = treeMap.size;
        const progressInterval = Math.max(1, Math.floor(totalTrees / 100)); // Log every 1%

        for (const [treeId, tree] of treeMap) {
            const solidName = `tree_${treeNumber}`;
            
            // Combine trunk and canopy into one solid (with coordinate conversion)
            const treeSTL = this.treeToSTL(tree.trunk, tree.canopy, solidName);
            stlParts.push(treeSTL);

            treeNumber++;
            processedCount++;

            // Progress logging for large datasets
            if (totalTrees > 1000 && processedCount % progressInterval === 0) {
                const progress = ((processedCount / totalTrees) * 100).toFixed(1);
                console.log(`STL generation progress: ${progress}% (${processedCount}/${totalTrees} trees)`);
            }
        }

        console.log(`STL generation complete. Joining ${stlParts.length} parts...`);
        
        // Join all parts at once (more efficient than incremental concatenation)
        const stlContent = stlParts.join('');
        
        console.log(`STL content generated: ${(stlContent.length / 1024 / 1024).toFixed(2)} MB`);

        return stlContent;
    }

    /**
     * Convert a tree (trunk + canopy) to STL format as a single solid
     * All facets from trunk and canopy are combined into one solid without separation
     * @param {Object} trunkFeature - Tree trunk GeoJSON feature
     * @param {Object} canopyFeature - Tree canopy GeoJSON feature
     * @param {string} solidName - Name for the solid in STL
     * @returns {string} STL content for the combined tree
     */
    treeToSTL(trunkFeature, canopyFeature, solidName) {
        let stlContent = `solid ${solidName}\n`;

        // Add all facets from trunk (if exists)
        if (trunkFeature) {
            stlContent += this.polygonToSTLFacets(trunkFeature);
        }

        // Add all facets from canopy (if exists)
        // All facets are combined seamlessly in one solid
        if (canopyFeature) {
            stlContent += this.polygonToSTLFacets(canopyFeature);
        }

        stlContent += `endsolid ${solidName}\n`;

        return stlContent;
    }

    /**
     * Convert geographic coordinates to local 3D coordinates
     * @param {number} lng - Longitude
     * @param {number} lat - Latitude
     * @returns {Array} [x, y] in meters relative to reference point
     */
    convertToLocalCoordinates(lng, lat) {
        if (!this.referencePoint) {
            // Fallback: use coordinates as-is if no reference point
            return [lng, lat];
        }
        
        // Convert lat/lng to meters relative to reference point
        // 1 degree latitude ≈ 111320 meters
        // 1 degree longitude ≈ 111320 * cos(latitude) meters
        const latMeters = (lat - this.referencePoint.lat) * 111320;
        const lngMeters = (lng - this.referencePoint.lng) * 111320 * Math.cos(this.referencePoint.lat * Math.PI / 180);
        
        return [lngMeters, latMeters];
    }

    /**
     * Convert a polygon feature to STL facets (without solid/endsolid tags)
     * @param {Object} feature - GeoJSON feature with Polygon geometry
     * @returns {string} STL facets content
     */
    polygonToSTLFacets(feature) {
        const geometry = feature.geometry;
        const properties = feature.properties;
        const height = properties.height || 0;
        const base = properties.base || 0;

        if (geometry.type !== 'Polygon') {
            console.warn(`Skipping non-polygon geometry: ${geometry.type}`);
            return '';
        }

        let facetsContent = '';

        // Get the polygon coordinates and convert to local coordinates
        const geoCoordinates = geometry.coordinates[0]; // Outer ring
        const coordinates = geoCoordinates.map(coord => {
            const local = this.convertToLocalCoordinates(coord[0], coord[1]);
            return [local[0], local[1]]; // [x, y] in meters
        });
        
        const numVertices = coordinates.length - 1; // Last point is duplicate

        // Bottom face (base)
        if (numVertices >= 3) {
            const bottomNormal = [0, 0, -1];
            facetsContent += this.writeFacet(bottomNormal, coordinates.slice(0, numVertices), base);
        }

        // Top face (base + height)
        if (numVertices >= 3) {
            const topNormal = [0, 0, 1];
            const topCoords = coordinates.slice(0, numVertices).map(coord => [...coord]);
            facetsContent += this.writeFacet(topNormal, topCoords, base + height, true);
        }

        // Side faces (extrusion walls)
        for (let i = 0; i < numVertices; i++) {
            const nextI = (i + 1) % numVertices;
            const p1 = coordinates[i];
            const p2 = coordinates[nextI];

            // Create two triangles for each side face
            // Triangle 1: bottom-left, top-left, bottom-right
            const normal1 = this.calculateNormal(
                [p1[0], p1[1], base],
                [p1[0], p1[1], base + height],
                [p2[0], p2[1], base]
            );

            facetsContent += `  facet normal ${this.formatNumber(normal1[0])} ${this.formatNumber(normal1[1])} ${this.formatNumber(normal1[2])}\n`;
            facetsContent += `    outer loop\n`;
            facetsContent += `      vertex ${this.formatNumber(p1[0])} ${this.formatNumber(p1[1])} ${this.formatNumber(base)}\n`;
            facetsContent += `      vertex ${this.formatNumber(p1[0])} ${this.formatNumber(p1[1])} ${this.formatNumber(base + height)}\n`;
            facetsContent += `      vertex ${this.formatNumber(p2[0])} ${this.formatNumber(p2[1])} ${this.formatNumber(base)}\n`;
            facetsContent += `    endloop\n`;
            facetsContent += `  endfacet\n`;

            // Triangle 2: bottom-right, top-left, top-right
            const normal2 = this.calculateNormal(
                [p2[0], p2[1], base],
                [p1[0], p1[1], base + height],
                [p2[0], p2[1], base + height]
            );

            facetsContent += `  facet normal ${this.formatNumber(normal2[0])} ${this.formatNumber(normal2[1])} ${this.formatNumber(normal2[2])}\n`;
            facetsContent += `    outer loop\n`;
            facetsContent += `      vertex ${this.formatNumber(p2[0])} ${this.formatNumber(p2[1])} ${this.formatNumber(base)}\n`;
            facetsContent += `      vertex ${this.formatNumber(p1[0])} ${this.formatNumber(p1[1])} ${this.formatNumber(base + height)}\n`;
            facetsContent += `      vertex ${this.formatNumber(p2[0])} ${this.formatNumber(p2[1])} ${this.formatNumber(base + height)}\n`;
            facetsContent += `    endloop\n`;
            facetsContent += `  endfacet\n`;
        }

        return facetsContent;
    }

    /**
     * Convert a polygon feature to STL format
     * @param {Object} feature - GeoJSON feature with Polygon geometry
     * @param {string} solidName - Name for the solid in STL
     * @returns {string} STL content for this polygon
     */
    polygonToSTL(feature, solidName) {
        const geometry = feature.geometry;
        const properties = feature.properties;
        const height = properties.height || 0;
        const base = properties.base || 0;

        if (geometry.type !== 'Polygon') {
            console.warn(`Skipping non-polygon geometry: ${geometry.type}`);
            return '';
        }

        let stlContent = `solid ${solidName}\n`;

        // Get the polygon coordinates
        const coordinates = geometry.coordinates[0]; // Outer ring
        const numVertices = coordinates.length - 1; // Last point is duplicate

        // Convert coordinates to 3D points
        // Note: GeoJSON uses [lng, lat], we need to convert to local coordinates
        // For STL, we'll use the coordinates as-is but need to handle the extrusion

        // Bottom face (base)
        if (numVertices >= 3) {
            const bottomNormal = [0, 0, -1];
            stlContent += this.writeFacet(bottomNormal, coordinates.slice(0, numVertices), base);
        }

        // Top face (base + height)
        if (numVertices >= 3) {
            const topNormal = [0, 0, 1];
            const topCoords = coordinates.slice(0, numVertices).map(coord => [...coord]);
            stlContent += this.writeFacet(topNormal, topCoords, base + height, true);
        }

        // Side faces (extrusion walls)
        for (let i = 0; i < numVertices; i++) {
            const nextI = (i + 1) % numVertices;
            const p1 = coordinates[i];
            const p2 = coordinates[nextI];

            // Create two triangles for each side face
            // Triangle 1: bottom-left, top-left, bottom-right
            const normal1 = this.calculateNormal(
                [p1[0], p1[1], base],
                [p1[0], p1[1], base + height],
                [p2[0], p2[1], base]
            );

            stlContent += `  facet normal ${this.formatNumber(normal1[0])} ${this.formatNumber(normal1[1])} ${this.formatNumber(normal1[2])}\n`;
            stlContent += `    outer loop\n`;
            stlContent += `      vertex ${this.formatNumber(p1[0])} ${this.formatNumber(p1[1])} ${this.formatNumber(base)}\n`;
            stlContent += `      vertex ${this.formatNumber(p1[0])} ${this.formatNumber(p1[1])} ${this.formatNumber(base + height)}\n`;
            stlContent += `      vertex ${this.formatNumber(p2[0])} ${this.formatNumber(p2[1])} ${this.formatNumber(base)}\n`;
            stlContent += `    endloop\n`;
            stlContent += `  endfacet\n`;

            // Triangle 2: bottom-right, top-left, top-right
            const normal2 = this.calculateNormal(
                [p2[0], p2[1], base],
                [p1[0], p1[1], base + height],
                [p2[0], p2[1], base + height]
            );

            stlContent += `  facet normal ${this.formatNumber(normal2[0])} ${this.formatNumber(normal2[1])} ${this.formatNumber(normal2[2])}\n`;
            stlContent += `    outer loop\n`;
            stlContent += `      vertex ${this.formatNumber(p2[0])} ${this.formatNumber(p2[1])} ${this.formatNumber(base)}\n`;
            stlContent += `      vertex ${this.formatNumber(p1[0])} ${this.formatNumber(p1[1])} ${this.formatNumber(base + height)}\n`;
            stlContent += `      vertex ${this.formatNumber(p2[0])} ${this.formatNumber(p2[1])} ${this.formatNumber(base + height)}\n`;
            stlContent += `    endloop\n`;
            stlContent += `  endfacet\n`;
        }

        stlContent += `endsolid ${solidName}\n`;

        return stlContent;
    }

    /**
     * Write a facet (face) to STL format
     * @param {Array} normal - Normal vector [x, y, z]
     * @param {Array} coordinates - Array of [lng, lat] coordinates
     * @param {number} z - Z coordinate (height)
     * @param {boolean} reverse - Whether to reverse the vertex order
     * @returns {string} STL facet content
     */
    writeFacet(normal, coordinates, z, reverse = false) {
        if (coordinates.length < 3) {
            return '';
        }

        // Triangulate the polygon
        let stlContent = '';
        const numVertices = coordinates.length;

        // Simple fan triangulation from first vertex
        for (let i = 1; i < numVertices - 1; i++) {
            const v1 = coordinates[0];
            const v2 = coordinates[i];
            const v3 = coordinates[i + 1];

            // Calculate normal for this triangle
            const triNormal = this.calculateNormal(
                [v1[0], v1[1], z],
                reverse ? [v3[0], v3[1], z] : [v2[0], v2[1], z],
                reverse ? [v2[0], v2[1], z] : [v3[0], v3[1], z]
            );

            stlContent += `  facet normal ${this.formatNumber(triNormal[0])} ${this.formatNumber(triNormal[1])} ${this.formatNumber(triNormal[2])}\n`;
            stlContent += `    outer loop\n`;
            
            if (reverse) {
                stlContent += `      vertex ${this.formatNumber(v1[0])} ${this.formatNumber(v1[1])} ${this.formatNumber(z)}\n`;
                stlContent += `      vertex ${this.formatNumber(v3[0])} ${this.formatNumber(v3[1])} ${this.formatNumber(z)}\n`;
                stlContent += `      vertex ${this.formatNumber(v2[0])} ${this.formatNumber(v2[1])} ${this.formatNumber(z)}\n`;
            } else {
                stlContent += `      vertex ${this.formatNumber(v1[0])} ${this.formatNumber(v1[1])} ${this.formatNumber(z)}\n`;
                stlContent += `      vertex ${this.formatNumber(v2[0])} ${this.formatNumber(v2[1])} ${this.formatNumber(z)}\n`;
                stlContent += `      vertex ${this.formatNumber(v3[0])} ${this.formatNumber(v3[1])} ${this.formatNumber(z)}\n`;
            }
            
            stlContent += `    endloop\n`;
            stlContent += `  endfacet\n`;
        }

        return stlContent;
    }

    /**
     * Calculate normal vector for a triangle
     * @param {Array} v1 - First vertex [x, y, z]
     * @param {Array} v2 - Second vertex [x, y, z]
     * @param {Array} v3 - Third vertex [x, y, z]
     * @returns {Array} Normal vector [x, y, z]
     */
    calculateNormal(v1, v2, v3) {
        // Calculate two edge vectors
        const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
        const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];

        // Cross product
        const normal = [
            edge1[1] * edge2[2] - edge1[2] * edge2[1],
            edge1[2] * edge2[0] - edge1[0] * edge2[2],
            edge1[0] * edge2[1] - edge1[1] * edge2[0]
        ];

        // Normalize
        const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
        if (length > 0) {
            return [normal[0] / length, normal[1] / length, normal[2] / length];
        }

        return [0, 0, 1]; // Default normal
    }

    /**
     * Format number for STL (scientific notation with 6 decimal places)
     * @param {number} num - Number to format
     * @returns {string} Formatted number string
     */
    formatNumber(num) {
        if (num === 0) {
            return '0.000000e+00';
        }
        const absNum = Math.abs(num);
        const sign = num < 0 ? '-' : '';
        const exponent = Math.floor(Math.log10(absNum));
        const mantissa = absNum / Math.pow(10, exponent);
        const exponentStr = exponent >= 0 ? `+${String(exponent).padStart(2, '0')}` : String(exponent).padStart(3, '0');
        return `${sign}${mantissa.toFixed(6)}e${exponentStr}`;
    }

    /**
     * Export STL in chunks (multiple files for datasets > 50000 trees)
     * @param {Object} treeTrunkData - Tree trunk GeoJSON data
     * @param {Object} treeCanopyData - Tree canopy GeoJSON data
     * @param {number} startNumber - Starting number for tree numbering
     * @param {string} baseFilename - Base filename without extension
     * @param {number} chunkSize - Number of trees per file
     */
    async exportSTLInChunks(treeTrunkData, treeCanopyData, startNumber, baseFilename, chunkSize) {
        console.log(`=== Exporting STL in chunks ===`);
        console.log(`Total trees: ${treeTrunkData.features.length}`);
        console.log(`Chunk size: ${chunkSize}`);
        console.log(`Base filename: ${baseFilename}`);

        // Create a map of tree IDs to their trunks and canopies
        const treeMap = new Map();

        // Group trunks by tree ID
        treeTrunkData.features.forEach(trunk => {
            const treeId = trunk.properties.id;
            if (!treeMap.has(treeId)) {
                treeMap.set(treeId, { trunk: null, canopy: null });
            }
            treeMap.get(treeId).trunk = trunk;
        });

        // Group canopies by tree ID
        treeCanopyData.features.forEach(canopy => {
            const treeId = canopy.properties.id;
            if (!treeMap.has(treeId)) {
                treeMap.set(treeId, { trunk: null, canopy: null });
            }
            treeMap.get(treeId).canopy = canopy;
        });

        // Convert map to array for easier chunking
        const treesArray = Array.from(treeMap.entries());
        const totalTrees = treesArray.length;
        const numFiles = Math.ceil(totalTrees / chunkSize);

        console.log(`Will create ${numFiles} files`);

        // Calculate reference point from all trees (once for all files)
        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;
        
        treeTrunkData.features.forEach(trunk => {
            if (trunk.geometry.type === 'Polygon' && trunk.geometry.coordinates[0]) {
                trunk.geometry.coordinates[0].forEach(coord => {
                    minLng = Math.min(minLng, coord[0]);
                    maxLng = Math.max(maxLng, coord[0]);
                    minLat = Math.min(minLat, coord[1]);
                    maxLat = Math.max(maxLat, coord[1]);
                });
            }
        });
        
        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;
        this.referencePoint = { lng: centerLng, lat: centerLat };
        console.log(`Reference center: [${centerLng.toFixed(6)}, ${centerLat.toFixed(6)}]`);

        // Export each chunk
        let currentStartNumber = startNumber;
        for (let fileIndex = 0; fileIndex < numFiles; fileIndex++) {
            const startIdx = fileIndex * chunkSize;
            const endIdx = Math.min(startIdx + chunkSize, totalTrees);
            const chunkTrees = treesArray.slice(startIdx, endIdx);
            
            console.log(`\n=== Processing chunk ${fileIndex + 1}/${numFiles} ===`);
            console.log(`Trees ${startIdx + 1} to ${endIdx} (${chunkTrees.length} trees)`);
            console.log(`Start number: ${currentStartNumber}`);

            // Create chunk data
            const chunkTrunkData = { type: 'FeatureCollection', features: [] };
            const chunkCanopyData = { type: 'FeatureCollection', features: [] };

            chunkTrees.forEach(([treeId, tree]) => {
                if (tree.trunk) {
                    chunkTrunkData.features.push(tree.trunk);
                }
                if (tree.canopy) {
                    chunkCanopyData.features.push(tree.canopy);
                }
            });

            // Generate STL for this chunk
            let stlContent;
            try {
                stlContent = this.generateSTLContent(chunkTrunkData, chunkCanopyData, currentStartNumber);
            } catch (error) {
                console.error(`Error generating STL for chunk ${fileIndex + 1}:`, error);
                alert(`Error generating STL file ${fileIndex + 1}: ${error.message}`);
                continue; // Skip this chunk and continue with next
            }

            // Save chunk file
            const chunkFilename = `${baseFilename}_${fileIndex + 1}.stl`;
            this.saveSTLFile(stlContent, chunkFilename);
            
            console.log(`✓ Saved chunk ${fileIndex + 1}: ${chunkFilename} (${chunkTrees.length} trees)`);

            // Update start number for next chunk
            currentStartNumber += chunkTrees.length;

            // Allow UI to update between chunks
            if (fileIndex < numFiles - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`\n=== Export complete ===`);
        console.log(`✓ Exported ${totalTrees} trees in ${numFiles} files`);
        alert(`Successfully exported ${totalTrees} trees to ${numFiles} STL files:\n${baseFilename}_1.stl to ${baseFilename}_${numFiles}.stl`);
    }

    /**
     * Export STL using streaming approach for very large datasets
     * @param {Object} treeTrunkData - Tree trunk GeoJSON data
     * @param {Object} treeCanopyData - Tree canopy GeoJSON data
     * @param {number} startNumber - Starting number for tree numbering
     * @param {string} filename - Filename for the STL file
     */
    async exportSTLStreaming(treeTrunkData, treeCanopyData, startNumber, filename) {
        console.log('Using streaming export for large dataset...');
        
        // Create a map of tree IDs
        const treeMap = new Map();
        
        treeTrunkData.features.forEach(trunk => {
            const treeId = trunk.properties.id;
            if (!treeMap.has(treeId)) {
                treeMap.set(treeId, { trunk: null, canopy: null });
            }
            treeMap.get(treeId).trunk = trunk;
        });
        
        treeCanopyData.features.forEach(canopy => {
            const treeId = canopy.properties.id;
            if (!treeMap.has(treeId)) {
                treeMap.set(treeId, { trunk: null, canopy: null });
            }
            treeMap.get(treeId).canopy = canopy;
        });

        // Calculate reference point (center of all trees) for coordinate offset
        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;
        
        treeTrunkData.features.forEach(trunk => {
            if (trunk.geometry.type === 'Polygon' && trunk.geometry.coordinates[0]) {
                trunk.geometry.coordinates[0].forEach(coord => {
                    minLng = Math.min(minLng, coord[0]);
                    maxLng = Math.max(maxLng, coord[0]);
                    minLat = Math.min(minLat, coord[1]);
                    maxLat = Math.max(maxLat, coord[1]);
                });
            }
        });
        
        // Calculate center point
        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;
        
        console.log(`Streaming: Reference center: [${centerLng.toFixed(6)}, ${centerLat.toFixed(6)}]`);
        
        // Store reference point for coordinate conversion
        this.referencePoint = { lng: centerLng, lat: centerLat };

        // Use Blob with chunks
        const chunks = [];
        let treeNumber = startNumber;
        const totalTrees = treeMap.size;
        const chunkSize = 1000; // Process 1000 trees per chunk
        
        let processed = 0;
        for (const [treeId, tree] of treeMap) {
            const solidName = `tree_${treeNumber}`;
            const treeSTL = this.treeToSTL(tree.trunk, tree.canopy, solidName);
            chunks.push(treeSTL);
            
            treeNumber++;
            processed++;
            
            // Process in chunks to avoid memory issues
            if (chunks.length >= chunkSize) {
                // Allow UI to update
                await new Promise(resolve => setTimeout(resolve, 0));
                
                const progress = ((processed / totalTrees) * 100).toFixed(1);
                console.log(`Streaming progress: ${progress}% (${processed}/${totalTrees} trees)`);
            }
        }
        
        console.log('All chunks generated. Creating blob...');
        const blob = new Blob(chunks, { type: 'application/octet-stream' });
        
        console.log(`Blob created: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        this.downloadBlob(blob, filename);
    }

    /**
     * Save STL file to disk
     * @param {string} content - STL file content
     * @param {string} filename - Filename for the STL file
     */
    saveSTLFile(content, filename) {
        // Create blob
        const blob = new Blob([content], { type: 'application/octet-stream' });
        this.downloadBlob(blob, filename);
    }

    /**
     * Download blob as file
     * @param {Blob} blob - Blob to download
     * @param {string} filename - Filename for the file
     */
    downloadBlob(blob, filename) {
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Export for use in other modules
window.STLExporterModule = STLExporterModule;

