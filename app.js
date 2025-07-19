// Scene setup
let scene, camera, renderer, controls;
let ground, buildings = [], trees = [];
let stlObjects = []; // Array to store STL objects
let colliderMeshes = []; // Array to store all objects with collider meshes
let gridHelper = null; // Track the grid helper
let isDrawingStreet = false;
let isDrawingGreen = false;
let isPlantingTree = false; // New variable to track tree planting mode
let isSelecting = false; // Track selection mode
let selectedObjects = []; // Array to store selected objects
let currentDrawing = null;
let northDirection = new THREE.Vector3(0, 0, -1); // Global -Z axis direction
let viewCube = null;
let viewCubeCamera = null;
let viewCubeRenderer = null;
let globalAxisVisible = false;
let gridVisible = true;
let plantingMode = 'single'; // Track planting mode (single or brush)
let brushDistance = 5; // Brush distance in meters
let brushDensity = 3; // Brush density (number of trees per brush operation)
let isDragging = false; // Track if user is dragging
let lastMousePosition = new THREE.Vector2();
let brushPreview = null; // Visual preview for brush tool // Store last mouse position

// Undo/Redo system
let undoStack = [];
let redoStack = [];
let maxUndoSteps = 50; // Maximum number of undo steps to keep

// Initialize the scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    // Fog is disabled by default - scene.fog = null;

    // Create camera
    camera = new THREE.PerspectiveCamera(75, (window.innerWidth - 60) / (window.innerHeight - 80), 0.1, 100000);
    
    // Set custom default camera position and angle
    camera.position.set(0, 80, -140); // Custom position: x=80, y=60, z=80
    camera.lookAt(0, 0, 0); // Look at the center of the scene
    
    // Alternative: Set specific rotation angles
    // camera.rotation.set(
    //     -Math.PI / 6,  // X rotation (pitch) - looking down slightly
    //     Math.PI / 4,   // Y rotation (yaw) - 45 degrees
    //     0              // Z rotation (roll) - no roll
    // );

    // Create renderer with enhanced settings
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth - 60, window.innerHeight - 80); // Account for toolbar and top panel
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Enhanced shadow settings
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
    renderer.physicallyCorrectLights = true;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    document.getElementById('scene-container').appendChild(renderer.domElement);

    // Add orbit controls with damping
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent going below ground
    controls.minDistance = 0.5;
    controls.maxDistance = 100000;
    controls.zoomSpeed = 1; // Increase zoom sensitivity
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE
    };
    controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.PAN
    };

    // Add lights with enhanced settings
    const ambientLight = new THREE.AmbientLight(0x404040, 1.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    
    // Enhanced shadow settings for directional light
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.bias = -0.0001;
    directionalLight.shadow.normalBias = 0.02;
    directionalLight.shadow.radius = 1.5;
    
    scene.add(directionalLight);

    // Create ground with enhanced material
    const groundGeometry = new THREE.PlaneGeometry(200, 200, 32, 32);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x7CFC00,
        //side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.2
    });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData = { type: 'collider', surfaceType: 'ground' };
    scene.add(ground);
    colliderMeshes.push(ground);

    // Add infinite grid
    gridHelper = new THREE.GridHelper(500, 100, 0x444444, 0x888888);
    gridHelper.position.y = 0.1; // Slightly above ground to avoid z-fighting
    scene.add(gridHelper);

    // Add global axes helper
    createArrowAxes();

    // Create random buildings with enhanced materials
    createRandomBuildings();

    // Add event listeners
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', onSceneClick);
    renderer.domElement.addEventListener('dblclick', onSceneDoubleClick);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('contextmenu', onRightClick);
    renderer.domElement.addEventListener('mouseleave', () => {
        // Remove brush preview when mouse leaves the scene
        if (!isDragging && isPlantingTree && plantingMode === 'brush') {
            removeBrushPreview();
        }
    }); // Add right-click handler
    //renderer.domElement.addEventListener('mousemove', onMouseMove);
    
    // Add keyboard event listener for delete key
    document.addEventListener('keydown', onKeyDown);

    // Initialize UI controls
    initUIControls();
    
    // Set select tool as default and show its panel
    switchTool('select-tool');
    
    // Ensure brush settings are properly initialized
    const brushSettings = document.getElementById('brush-settings');
    const brushDensityGroup = document.getElementById('brush-density-group');
    if (plantingMode === 'brush') {
        brushSettings.style.display = 'inline-block';
        brushDensityGroup.style.display = 'inline-block';
    } else {
        brushSettings.style.display = 'none';
        brushDensityGroup.style.display = 'none';
    }
    
    // Initialize brush density value display
    document.getElementById('brush-density-value').textContent = brushDensity;

    // Initialize day range based on default month
    updateDayRange(7); // Default month is July (7)

    // Set initial sun position based on default parameters
    updateSunPosition();

    // Initialize main menu
    initMainMenu();

    // Initialize hierarchy panel
    initHierarchyPanel();

    // Debug: Check if ground is properly added to collider meshes
    console.log('🔍 Initial collider meshes count:', colliderMeshes.length);
    console.log('🔍 Ground object:', ground);
    console.log('🔍 Ground in collider meshes:', colliderMeshes.includes(ground));
    console.log('🔍 Ground userData:', ground.userData);

    // Start animation loop
    animate();
}

// Create random buildings with enhanced materials
function createRandomBuildings() {
    for (let i = 0; i < 10; i++) {
        const width = 5 + Math.random() * 10;
        const height = 10 + Math.random() * 30;
        const depth = 5 + Math.random() * 10;
        
        const geometry = new THREE.BoxGeometry(width, height, depth, 2, 2, 2);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
            //side: THREE.DoubleSide,
            roughness: 0.7,
            metalness: 0.2,
            flatShading: false
        });
        
        const building = new THREE.Mesh(geometry, material);
        building.position.x = Math.random() * 180 - 90;
        building.position.z = Math.random() * 180 - 90;
        building.position.y = height / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        building.userData = { type: 'collider', surfaceType: 'building' };
        
        scene.add(building);
        buildings.push(building);
        colliderMeshes.push(building);
    }
    
    // Update hierarchy counts and children
    updateHierarchyCounts();
}

// Create a tree with enhanced materials
function createTree(position, properties) {
    // Default to ground surface normal (upward)
    const groundNormal = new THREE.Vector3(0, 1, 0);
    const tree = createTreeOnSurface(position, groundNormal, properties, 'ground');
    
    // Save state after creating tree
    saveSceneState('Add Tree');
    
    return tree;
}

// Create a tree oriented to a specific surface
function createTreeOnSurface(position, surfaceNormal, properties, surfaceType, intersectObject = null) {
    console.log('🌳 createTreeOnSurface called with position:', position, 'height:', properties.height, 'color:', properties.color);
    
    const { height, color } = properties;
    
    // Create trunk with enhanced geometry
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, height * 0.3, 8, 4);
    const trunkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.9,
        metalness: 0.1,
        //side: THREE.DoubleSide
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    
    // Create foliage with enhanced geometry
    const foliageGeometry = new THREE.ConeGeometry(height * 0.4, height * 0.7, 8, 4);
    const foliageMaterial = new THREE.MeshStandardMaterial({ 
        color: color,
        roughness: 0.8,
        metalness: 0.1,
        //side: THREE.DoubleSide
    });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = height * 0.5;
    
    // Create tree group
    const tree = new THREE.Group();
    tree.add(trunk);
    tree.add(foliage);
    
    // Position tree at the surface point
    tree.position.copy(position);
    
    // Orient tree to surface normal
    if (surfaceNormal) {
        // Transform the normal to world space if the object has rotation
        if (intersectObject && intersectObject.rotation) {
            surfaceNormal.applyMatrix4(intersectObject.matrixWorld);
        }
        
        // Calculate rotation to align tree with surface normal
        const upVector = new THREE.Vector3(0, 1, 0);
        
        // For ground surface, use upward normal
        if (surfaceType === 'ground') {
            // Ground surface - no rotation needed, trees grow upward
            tree.rotation.set(0, 0, 0);
        } else {
            // For other surfaces, calculate rotation to align tree trunk with surface normal
            const rotationAxis = new THREE.Vector3();
            rotationAxis.crossVectors(upVector, surfaceNormal).normalize();
            const rotationAngle = Math.acos(upVector.dot(surfaceNormal));
            
            if (rotationAxis.length() > 0.001) {
                tree.rotation.setFromAxisAngle(rotationAxis, rotationAngle);
            }
        }
    }
    
    // Adjust position based on surface type
    if (surfaceType === 'ground') {
        tree.position.y = height * 0.15; // Slightly above ground
    } else {
        // For other surfaces, position at the surface point
        tree.position.y = position.y;
    }
    
    // Ensure tree is always visible and properly oriented
    if (surfaceType === 'ground') {
        // For ground, ensure tree is upright
        tree.rotation.set(0, 0, 0);
    }
    
    // Add properties
    tree.userData = { height, color, surfaceType };
    
    // Add shadows
    trunk.castShadow = true;
    foliage.castShadow = true;
    
    scene.add(tree);
    trees.push(tree);
    console.log('🌳 Tree created and added to scene. Total trees:', trees.length);
    
    // Update hierarchy counts
    updateHierarchyCounts();
    
    return tree;
}

// Create arrow axes
function createArrowAxes() {
    const arrowLength = 20;
    const arrowHeadLength = 5;
    const arrowHeadWidth = 2;
    const shaftWidth = 1;
    
    // Create arrow geometries
    const arrowGeometry = new THREE.CylinderGeometry(shaftWidth, shaftWidth, arrowLength, 8);
    const arrowHeadGeometry = new THREE.ConeGeometry(arrowHeadWidth, arrowHeadLength, 8);
    
    // Create arrow materials
    const xMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red for X
    const yMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green for Y
    const zMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff }); // Blue for Z
    
    // Create X axis arrow (red)
    const xShaft = new THREE.Mesh(arrowGeometry, xMaterial);
    const xHead = new THREE.Mesh(arrowHeadGeometry, xMaterial);
    xShaft.rotation.z = -Math.PI / 2;
    xHead.rotation.z = -Math.PI / 2;
    xShaft.position.x = arrowLength / 2;
    xHead.position.x = arrowLength + arrowHeadLength / 2;
    
    const xArrow = new THREE.Group();
    xArrow.add(xShaft);
    xArrow.add(xHead);
    xArrow.userData = { type: 'axes' };
    xArrow.visible = globalAxisVisible;
    scene.add(xArrow);
    
    // Create Y axis arrow (green)
    const yShaft = new THREE.Mesh(arrowGeometry, yMaterial);
    const yHead = new THREE.Mesh(arrowHeadGeometry, yMaterial);
    yShaft.position.y = arrowLength / 2;
    yHead.position.y = arrowLength + arrowHeadLength / 2;
    
    const yArrow = new THREE.Group();
    yArrow.add(yShaft);
    yArrow.add(yHead);
    yArrow.userData = { type: 'axes' };
    yArrow.visible = globalAxisVisible;
    scene.add(yArrow);
    
    // Create Z axis arrow (blue)
    const zShaft = new THREE.Mesh(arrowGeometry, zMaterial);
    const zHead = new THREE.Mesh(arrowHeadGeometry, zMaterial);
    zShaft.rotation.x = Math.PI / 2;
    zHead.rotation.x = Math.PI / 2;
    zShaft.position.z = arrowLength / 2;
    zHead.position.z = arrowLength + arrowHeadLength / 2;
    
    const zArrow = new THREE.Group();
    zArrow.add(zShaft);
    zArrow.add(zHead);
    zArrow.userData = { type: 'axes' };
    zArrow.visible = globalAxisVisible;
    scene.add(zArrow);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = (window.innerWidth - 60) / (window.innerHeight - 80);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth - 60, window.innerHeight - 80);
}

// Handle scene click
function onSceneClick(event) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Account for toolbar offset (60px) and top panel offset (80px)
    mouse.x = ((event.clientX - 60) / (window.innerWidth - 60)) * 2 - 1;
    mouse.y = -((event.clientY - 80) / (window.innerHeight - 80)) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Handle selection mode
    if (isSelecting && event.button === 0) {
        handleObjectSelection(event, raycaster);
        return;
    }
    
    // Check for tree selection/deletion
    const treeIntersects = raycaster.intersectObjects(trees, true);
    if (treeIntersects.length > 0) {
        const selectedObject = treeIntersects[0].object;
        const tree = selectedObject.parent;
        
        // Right click to delete tree (works in both single and brush modes)
        if (event.button === 2) {
            console.log('🗑️ Deleting tree');
            scene.remove(tree);
            trees = trees.filter(t => t !== tree);
            
            // Update hierarchy counts
            updateHierarchyCounts();
            
            return;
        }
        
        // Left click to select tree (for future functionality if needed)
        if (event.button === 0) {
            console.log('🌳 Tree selected');
            // Tree selection functionality removed
        }
        return;
    }
    
    // Check for collider mesh intersection for planting or drawing
    const colliderIntersects = raycaster.intersectObjects(colliderMeshes, false);
    
    if (colliderIntersects.length > 0) {
        const intersect = colliderIntersects[0];
        const point = intersect.point;
        const surfaceNormal = intersect.face.normal.clone();
        const surfaceType = intersect.object.userData.surfaceType;
        
        console.log(`🌍 Clicked on ${surfaceType} at position:`, point);
        
        if (isDrawingStreet) {
            drawStreet(point);
        } else if (isDrawingGreen) {
            drawGreenSpace(point);
        } else if (isPlantingTree && plantingMode === 'single') {
            // Plant tree on any surface
            plantTreeOnSurface(point, surfaceNormal, surfaceType, intersect.object);
        }
        // Brush mode is now handled in onMouseDown for proper mouse button tracking
    } else {
        console.log('❌ No collider intersection found');
        
        // Fallback: try to intersect with ground directly
        const groundIntersects = raycaster.intersectObject(ground);
        if (groundIntersects.length > 0) {
            const point = groundIntersects[0].point;
            const surfaceNormal = new THREE.Vector3(0, 1, 0); // Ground normal is always up
            console.log(`🌍 Fallback: Clicked on ground at position:`, point);
            
            if (isPlantingTree && plantingMode === 'single') {
                plantTreeOnSurface(point, surfaceNormal, 'ground', ground);
            }
            // Brush mode is now handled in onMouseDown for proper mouse button tracking
        }
    }
}

// Handle double-click to zoom to object
function onSceneDoubleClick(event) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Account for toolbar offset (60px) and top panel offset (80px)
    mouse.x = ((event.clientX - 60) / (window.innerWidth - 60)) * 2 - 1;
    mouse.y = -((event.clientY - 80) / (window.innerHeight - 80)) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Get all selectable objects
    const allSelectableObjects = [];
    
    // Add ground if it exists
    if (ground) {
        allSelectableObjects.push(ground);
    }
    
    // Add all buildings
    allSelectableObjects.push(...buildings);
    
    // Add all trees
    allSelectableObjects.push(...trees);
    
    // Add current drawing if it exists
    if (currentDrawing) {
        allSelectableObjects.push(currentDrawing);
    }
    
    // Add all STL objects
    allSelectableObjects.push(...stlObjects);
    
    const intersects = raycaster.intersectObjects(allSelectableObjects, true);
    
    if (intersects.length > 0) {
        const selectedObject = intersects[0].object;
        let targetObject = selectedObject;
        
        // If we clicked on a child of a tree (trunk or foliage), get the parent tree
        if (selectedObject.parent && selectedObject.parent.type === 'Group' && trees.includes(selectedObject.parent)) {
            targetObject = selectedObject.parent;
        }
        // If we clicked on a child of any group, get the parent group
        if (selectedObject.parent && selectedObject.parent.type === 'Group') {
            targetObject = selectedObject.parent;
        }
        
        console.log('🔍 Double-clicked on object:', getObjectName(targetObject));
        zoomToObject(targetObject);
    }
}

// Zoom camera to focus on a specific object
function zoomToObject(obj) {
    if (!obj) {
        console.log('❌ No object provided for zoom');
        return;
    }
    
    console.log('🔍 Zooming to object:', getObjectName(obj));
    
    // Create a bounding box for the object
    const boundingBox = new THREE.Box3().setFromObject(obj);
    const objectCenter = boundingBox.getCenter(new THREE.Vector3());
    const objectSize = boundingBox.getSize(new THREE.Vector3());
    
    // Calculate appropriate distance based on object size
    const maxDim = Math.max(objectSize.x, objectSize.y, objectSize.z);
    const distance = Math.max(maxDim * 2, 10); // At least 10 units away, or 2x the object size
    
    // Get current camera direction (where it's looking)
    const currentDirection = new THREE.Vector3();
    camera.getWorldDirection(currentDirection);
    
    // Calculate new camera position by moving along the current direction from the object center
    const cameraPosition = objectCenter.clone().sub(currentDirection.multiplyScalar(distance));
    
    // Animate camera movement
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const endPosition = cameraPosition;
    const endTarget = objectCenter;
    
    const duration = 1000; // 1 second animation
    const startTime = Date.now();
    
    function animateCamera() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easing function for smooth animation
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        
        // Interpolate camera position and target
        camera.position.lerpVectors(startPosition, endPosition, easeProgress);
        controls.target.lerpVectors(startTarget, endTarget, easeProgress);
        controls.update();
        
        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        } else {
            console.log('✅ Camera zoom animation complete');
        }
    }
    
    animateCamera();
}

// Plant a tree on any surface
function plantTreeOnSurface(position, surfaceNormal, surfaceType) {
    console.log('🌳 plantTreeOnSurface called with position:', position, 'surfaceType:', surfaceType, 'plantingMode:', plantingMode);
    
    const heightMin = parseFloat(document.getElementById('tree-height-min').value);
    const heightMax = parseFloat(document.getElementById('tree-height-max').value);
    const color = document.getElementById('tree-color').value;
    
    // Generate random height within the range
    const baseHeight = Math.random() * (heightMax - heightMin) + heightMin;
    
    if (plantingMode === 'single') {
        console.log('🌳 Planting single tree');
        // Plant single tree on surface
        createTreeOnSurface(position, surfaceNormal, { height: baseHeight, color }, surfaceType, null);
    } else if (plantingMode === 'brush') {
        console.log('🌳 Planting brush trees - distance:', brushDistance, 'density:', brushDensity);
        // Plant multiple trees with avoidance radius on surface
        const numTrees = brushDensity; // Number of trees based on density setting
        let plantedCount = 0;
        let attempts = 0;
        const maxAttempts = numTrees * 10; // Prevent infinite loops
        
        while (plantedCount < numTrees && attempts < maxAttempts) {
            // Generate random position within brush radius on the surface
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * brushDistance;
            const offsetX = Math.cos(angle) * distance;
            const offsetZ = Math.sin(angle) * distance;
            
            const brushPosition = new THREE.Vector3(
                position.x + offsetX,
                position.y,
                position.z + offsetZ
            );
            
            // Check if position is far enough from existing trees
            if (isPositionValid(brushPosition)) {
                // Generate random height within the range
                const heightVariation = Math.random() * (heightMax - heightMin) + heightMin;
                const colorVariation = adjustColor(color, Math.random() * 0.2 - 0.1); // ±10% color variation
                
                createTreeOnSurface(brushPosition, surfaceNormal, { height: heightVariation, color: colorVariation }, surfaceType, null);
                plantedCount++;
                console.log('🌳 Planted tree', plantedCount, 'at:', brushPosition);
            }
            attempts++;
        }
        console.log('🌳 Finished planting', plantedCount, 'trees');
    }
}

// Plant a tree (legacy function for backward compatibility)
function plantTree(position) {
    // Default to ground surface normal (upward)
    const groundNormal = new THREE.Vector3(0, 1, 0);
    plantTreeOnSurface(position, groundNormal, 'ground');
}

// Check if a position is valid (far enough from existing trees)
function isPositionValid(position) {
    // Use a smaller avoidance radius based on density - higher density means trees can be closer
    const avoidanceRadius = Math.max(1, brushDistance / brushDensity);
    
    for (let tree of trees) {
        const distance = position.distanceTo(tree.position);
        if (distance < avoidanceRadius) {
            return false; // Too close to existing tree
        }
    }
    return true; // Position is valid
}

// Helper function to adjust color brightness
function adjustColor(color, factor) {
    // Convert hex to RGB
    const r = parseInt(color.substr(1, 2), 16);
    const g = parseInt(color.substr(3, 2), 16);
    const b = parseInt(color.substr(5, 2), 16);
    
    // Adjust brightness
    const newR = Math.max(0, Math.min(255, Math.round(r * (1 + factor))));
    const newG = Math.max(0, Math.min(255, Math.round(g * (1 + factor))));
    const newB = Math.max(0, Math.min(255, Math.round(b * (1 + factor))));
    
    // Convert back to hex
    return '#' + newR.toString(16).padStart(2, '0') + 
                 newG.toString(16).padStart(2, '0') + 
                 newB.toString(16).padStart(2, '0');
}

// Draw street
function drawStreet(point) {
    if (!currentDrawing) {
        currentDrawing = new THREE.Group();
        scene.add(currentDrawing);
    }
    
    const geometry = new THREE.BoxGeometry(5, 0.1, 5);
    const material = new THREE.MeshStandardMaterial({ color: 0x808080, /*side: THREE.DoubleSide */});
    const segment = new THREE.Mesh(geometry, material);
    segment.position.copy(point);
    segment.position.y = 0.05;
    
    currentDrawing.add(segment);
}

// Draw green space
function drawGreenSpace(point) {
    if (!currentDrawing) {
        currentDrawing = new THREE.Group();
        scene.add(currentDrawing);
    }
    
    const geometry = new THREE.BoxGeometry(10, 0.1, 10);
    const material = new THREE.MeshStandardMaterial({ color: 0x90EE90, /*side: THREE.DoubleSide */});
    const segment = new THREE.Mesh(geometry, material);
    segment.position.copy(point);
    segment.position.y = 0.05;
    
    currentDrawing.add(segment);
}

// Calculate sun position
function calculateSunPosition(month, day, hour, minute, latitude, longitude) {
    // Create date with fixed year 2025, month, day, hour, and minute
    const date = new Date(2025, month - 1, day, hour, minute);
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    
    // Calculate solar declination
    const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);
    
    // Calculate hour angle (0 at solar noon, negative in morning, positive in afternoon)
    const decimalHour = hour + minute / 60;
    const hourAngle = (decimalHour - 12) * 15;
    
    // Adjust latitude by subtracting 40
    const adjustedLatitude = latitude - 40;
    
    // Calculate elevation
    const elevation = Math.asin(
        Math.sin(declination * Math.PI / 180) * Math.sin(adjustedLatitude * Math.PI / 180) +
        Math.cos(declination * Math.PI / 180) * Math.cos(adjustedLatitude * Math.PI / 180) * 
        Math.cos(hourAngle * Math.PI / 180)
    );
    
    // Calculate azimuth (0 = North, 90 = East, 180 = South, 270 = West)
    const azimuth = Math.atan2(
        Math.sin(hourAngle * Math.PI / 180),
        Math.cos(hourAngle * Math.PI / 180) * Math.sin(adjustedLatitude * Math.PI / 180) -
        Math.tan(declination * Math.PI / 180) * Math.cos(adjustedLatitude * Math.PI / 180)
    );
    
    return { elevation, azimuth };
}

// Update day range based on selected month
function updateDayRange(month) {
    const dayInput = document.getElementById('day');
    const dayValue = document.getElementById('day-value');
    
    // Get the number of days in the selected month
    const daysInMonth = getDaysInMonth(month);
    
    // Update the max attribute of the day input
    dayInput.max = daysInMonth;
    
    // If current day value exceeds the new max, reset it to the max
    const currentDay = parseInt(dayInput.value);
    if (currentDay > daysInMonth) {
        dayInput.value = daysInMonth;
        dayValue.textContent = daysInMonth;
    }
}

// Get the number of days in a month
function getDaysInMonth(month) {
    // Month is 1-based (1-12)
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return daysInMonth[month - 1];
}

// Update sun position
function updateSunPosition() {
    const month = parseInt(document.getElementById('month').value);
    const day = parseInt(document.getElementById('day').value);
    const hour = parseInt(document.getElementById('hour').value);
    const minute = parseInt(document.getElementById('minute').value);
    const latitude = parseFloat(document.getElementById('latitude').value);
    const longitude = parseFloat(document.getElementById('longitude').value);
    
    const { elevation, azimuth } = calculateSunPosition(month, day, hour, minute, latitude, longitude);
    
    // Update directional light position
    const distance = 100;
    const x = distance * Math.cos(elevation) * Math.sin(azimuth);
    const y = distance * Math.sin(elevation);
    const z = distance * Math.cos(elevation) * Math.cos(azimuth);
    
    // Check if it's daylight hours (between 5:00 and 21:00)
    const isDaylight = hour >= 5 && hour <= 21;
    
    scene.children.forEach(child => {
        if (child instanceof THREE.DirectionalLight) {
            child.position.set(x, y, z);
            child.castShadow = isDaylight;
            child.intensity = isDaylight ? 1 : 0.3; // Reduce intensity at night
        }
    });
}

// Update orbit controls based on current mode
function updateOrbitControls() {
    console.log('🔄 Updating orbit controls - isPlantingTree:', isPlantingTree, 'plantingMode:', plantingMode, 'isSelecting:', isSelecting);
    
    if (isPlantingTree && plantingMode === 'brush') {
        // For brush tool, completely disable orbit controls to allow our mouse events
        controls.enabled = false;
        console.log('🌳 Brush mode: Disabled orbit controls completely');
    } else if (isPlantingTree && plantingMode === 'single') {
        // Disable left mouse button for camera control when planting single trees
        controls.enabled = true;
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.NONE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE
        };
        console.log('🌳 Single mode: Disabled left mouse, enabled middle/right for camera');
    } else if (isSelecting) {
        // For selection tool, disable left mouse button for camera control
        controls.enabled = true;
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.NONE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE
        };
        console.log('👆 Selection mode: Disabled left mouse, enabled middle/right for camera');
    } else {
        // Enable all mouse buttons for camera control when not planting or selecting
        controls.enabled = true;
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE
        };
        console.log('📷 Normal mode: Enabled all mouse buttons for camera');
    }
    
    console.log('🔄 Controls enabled after update:', controls.enabled);
}

// Function to switch tools
function switchTool(activeToolId) {
    const toolButtons = document.querySelectorAll('.tool-btn');
    const parameterPanels = document.querySelectorAll('.parameter-panel');
    
    // Update toolbar button states
    toolButtons.forEach(btn => btn.classList.remove('active'));
    document.getElementById(activeToolId).classList.add('active');
    
    // Reset all modes
    isPlantingTree = false;
    isDrawingStreet = false;
    isDrawingGreen = false;
    isSelecting = false;
    
    // Remove brush preview if it exists
    removeBrushPreview();
    
    // Update orbit controls
    updateOrbitControls();
    
    // Update cursor style for different modes
    renderer.domElement.classList.remove('brush-mode-active', 'selection-mode-active');
    
    if (activeToolId === 'tree-tool') {
        renderer.domElement.classList.add('brush-mode-active');
        
        // Show/hide brush settings based on current planting mode
        const brushSettings = document.getElementById('brush-settings');
        const brushDensityGroup = document.getElementById('brush-density-group');
        const separator = document.querySelector('#tree-panel .separator');
        if (plantingMode === 'brush') {
            brushSettings.style.display = 'inline-block';
            brushDensityGroup.style.display = 'inline-block';
            if (separator) separator.style.display = 'inline-block';
        } else {
            brushSettings.style.display = 'none';
            brushDensityGroup.style.display = 'none';
            if (separator) separator.style.display = 'none';
        }
    } else if (activeToolId === 'select-tool') {
        renderer.domElement.classList.add('selection-mode-active');
    }
    
    // Set selection mode
    if (activeToolId === 'select-tool') {
        isSelecting = true;
        console.log('👆 Selection tool activated');
    }
    
    // Reset plant tree button
    const plantTreeButton = document.getElementById('plant-tree');
    plantTreeButton.textContent = 'Plant Tree';
    plantTreeButton.classList.remove('active');
    
    // Show/hide parameter panels based on active tool
    parameterPanels.forEach(panel => {
        panel.classList.remove('active');
        panel.style.display = 'none'; // Explicitly hide all panels
    });
    
    // Show only the appropriate parameter panel
        if (activeToolId === 'tree-tool') {
        const treePanel = document.getElementById('tree-panel');
        treePanel.classList.add('active');
        treePanel.style.display = 'block';
        } else if (activeToolId === 'sun-tool') {
        const sunPanel = document.getElementById('sun-panel');
        sunPanel.classList.add('active');
        sunPanel.style.display = 'block';
        } else if (activeToolId === 'location-tool') {
        const locationPanel = document.getElementById('location-panel');
        locationPanel.classList.add('active');
        locationPanel.style.display = 'block';
    }
}

// Initialize UI controls
function initUIControls() {
    // Toolbar controls
    const toolButtons = document.querySelectorAll('.tool-btn');
    
    // Add event listeners for toolbar buttons
    toolButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTool(btn.id);
        });
    });
    
    // Tree planting controls
    const plantTreeButton = document.getElementById('plant-tree');
    plantTreeButton.addEventListener('click', () => {
        isPlantingTree = !isPlantingTree;
        console.log('🌳 Plant tree button clicked, isPlantingTree set to:', isPlantingTree);
        console.log('🌳 Current planting mode:', plantingMode);
        isDrawingStreet = false;
        isDrawingGreen = false;
        
        // Update button text and appearance
        if (isPlantingTree) {
            plantTreeButton.textContent = 'Cancel Planting';
            plantTreeButton.classList.add('active');
        } else {
            plantTreeButton.textContent = 'Plant Tree';
            plantTreeButton.classList.remove('active');
            // Remove brush preview when canceling
            removeBrushPreview();
        }
        
        // Update orbit controls
        updateOrbitControls();
    });
    
    // Planting mode controls
    document.getElementById('single-mode').addEventListener('click', () => {
        plantingMode = 'single';
        console.log('🌳 Single mode selected, plantingMode set to:', plantingMode);
        updatePlantingModeButtons();
        
        const brushSettings = document.getElementById('brush-settings');
        const brushDensityGroup = document.getElementById('brush-density-group');
        const separator = document.querySelector('#tree-panel .separator');
        brushSettings.style.display = 'none';
        brushDensityGroup.style.display = 'none';
        if (separator) separator.style.display = 'none';
        console.log('🌳 Brush settings visibility set to:', brushSettings.style.display);
    });
    
    document.getElementById('brush-mode').addEventListener('click', () => {
        plantingMode = 'brush';
        console.log('🌳 Brush mode selected, plantingMode set to:', plantingMode);
        updatePlantingModeButtons();
        
        const brushSettings = document.getElementById('brush-settings');
        const brushDensityGroup = document.getElementById('brush-density-group');
        const separator = document.querySelector('#tree-panel .separator');
        brushSettings.style.display = 'inline-block';
        brushDensityGroup.style.display = 'inline-block';
        if (separator) separator.style.display = 'inline-block';
        console.log('🌳 Brush settings visibility set to:', brushSettings.style.display);
        
        // Update orbit controls if planting is active
        if (isPlantingTree) {
            console.log('🌳 Updating orbit controls after brush mode selection');
            updateOrbitControls();
        }
    });
    
    // Function to update button states
    function updatePlantingModeButtons() {
        document.getElementById('single-mode').classList.toggle('active', plantingMode === 'single');
        document.getElementById('brush-mode').classList.toggle('active', plantingMode === 'brush');
    }
    
    // Brush distance control
    document.getElementById('brush-distance').addEventListener('input', (e) => {
        brushDistance = parseFloat(e.target.value);
        document.getElementById('brush-distance-value').textContent = brushDistance;
    });
    
    // Brush density control
    document.getElementById('brush-density').addEventListener('input', (e) => {
        brushDensity = parseInt(e.target.value);
        document.getElementById('brush-density-value').textContent = brushDensity;
    });
    
    // Sunlight controls
    ['month', 'day', 'hour', 'minute'].forEach(id => {
        document.getElementById(id).addEventListener('input', (e) => {
            document.getElementById(`${id}-value`).textContent = e.target.value;
            
            // Update day range when month changes
            if (id === 'month') {
                updateDayRange(parseInt(e.target.value));
            }
            
            updateSunPosition();
        });
    });
    
    // Location controls
    ['latitude', 'longitude'].forEach(id => {
        const slider = document.getElementById(id);
        const numberInput = document.getElementById(`${id}-number`);
        
        // Slider event listener
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            numberInput.value = value.toFixed(6);
            updateSunPosition();
        });
        
        // Number input event listener
        numberInput.addEventListener('input', (e) => {
            let value = parseFloat(e.target.value);
            
            // Clamp values to valid ranges
            if (id === 'latitude') {
                value = Math.max(-90, Math.min(90, value));
            } else if (id === 'longitude') {
                value = Math.max(-180, Math.min(180, value));
            }
            
            slider.value = value;
            e.target.value = value.toFixed(6);
            updateSunPosition();
        });
    });
    
    // Settings controls
    document.getElementById('global-axis-toggle').addEventListener('change', (e) => {
        globalAxisVisible = e.target.checked;
        // Find the arrow axes in the scene and toggle their visibility
        scene.children.forEach(child => {
            if (child.userData && child.userData.type === 'axes') {
                child.visible = globalAxisVisible;
            }
        });
    });
    
    document.getElementById('grid-toggle').addEventListener('change', (e) => {
        gridVisible = e.target.checked;
        // Find the grid helper in the scene and toggle its visibility
        scene.children.forEach(child => {
            if (child instanceof THREE.GridHelper) {
                child.visible = gridVisible;
            }
        });
    });
    
    // Fog controls
    document.getElementById('fog-toggle').addEventListener('change', (e) => {
        if (e.target.checked) {
            // Enable fog
            const fogDistance = parseFloat(document.getElementById('fog-distance').value);
            scene.fog = new THREE.FogExp2(0x87CEEB, fogDistance);
            console.log('🌫️ Fog enabled with distance:', fogDistance);
        } else {
            // Disable fog
            scene.fog = null;
            console.log('🌫️ Fog disabled');
        }
    });
    
    document.getElementById('fog-distance').addEventListener('input', (e) => {
        const fogDistance = parseFloat(e.target.value);
        document.getElementById('fog-distance-value').textContent = fogDistance;
        
        // Update fog if it's enabled
        if (document.getElementById('fog-toggle').checked) {
            scene.fog = new THREE.FogExp2(0x87CEEB, fogDistance);
            console.log('🌫️ Fog distance updated:', fogDistance);
        }
    });
    
    // Drawing tools (kept for compatibility)
    document.getElementById('draw-street').addEventListener('click', () => {
        isDrawingStreet = true;
        isDrawingGreen = false;
        isPlantingTree = false;
        currentDrawing = null;
        
        // Remove brush preview when switching tools
        removeBrushPreview();
        
        // Reset plant tree button
        const plantTreeButton = document.getElementById('plant-tree');
        plantTreeButton.textContent = 'Plant Tree';
        plantTreeButton.classList.remove('active');
        
        // Update orbit controls
        updateOrbitControls();
    });
    
    document.getElementById('draw-green').addEventListener('click', () => {
        isDrawingStreet = false;
        isDrawingGreen = true;
        isPlantingTree = false;
        currentDrawing = null;
        
        // Remove brush preview when switching tools
        removeBrushPreview();
        
        // Reset plant tree button
        const plantTreeButton = document.getElementById('plant-tree');
        plantTreeButton.classList.remove('active');
        
        // Update orbit controls
        updateOrbitControls();
    });
    
    // Export/Import controls
    document.getElementById('export-scene').addEventListener('click', () => {
        const sceneData = {
            trees: trees.map(tree => ({
                position: tree.position.toArray(),
                userData: tree.userData
            })),
            buildings: buildings.map(building => ({
                position: building.position.toArray(),
                dimensions: {
                    width: building.geometry.parameters.width,
                    height: building.geometry.parameters.height,
                    depth: building.geometry.parameters.depth
                }
            }))
        };
        
        const blob = new Blob([JSON.stringify(sceneData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'digital-twin-scene.json';
        a.click();
    });
    
    document.getElementById('import-button').addEventListener('click', () => {
        document.getElementById('import-scene').click();
    });
    
    document.getElementById('import-scene').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const sceneData = JSON.parse(event.target.result);
                
                // Clear existing scene
                trees.forEach(tree => scene.remove(tree));
                buildings.forEach(building => scene.remove(building));
                trees = [];
                buildings = [];
                
                // Load trees
                sceneData.trees.forEach(treeData => {
                    const tree = createTree(
                        new THREE.Vector3(...treeData.position),
                        treeData.userData
                    );
                });
                
                // Load buildings
                sceneData.buildings.forEach(buildingData => {
                    // Use the original building dimensions if available, otherwise use default
                    const width = buildingData.dimensions ? buildingData.dimensions.width : 10;
                    const height = buildingData.dimensions ? buildingData.dimensions.height : 20;
                    const depth = buildingData.dimensions ? buildingData.dimensions.depth : 10;
                    
                    const geometry = new THREE.BoxGeometry(width, height, depth, 2, 2, 2);
                    const material = new THREE.MeshStandardMaterial({ 
                        color: 0x808080,
                        //side: THREE.DoubleSide,
                        roughness: 0.7,
                        metalness: 0.2,
                        flatShading: false
                    });
                    const building = new THREE.Mesh(geometry, material);
                    building.position.set(...buildingData.position);
                    building.position.y = height / 2; // Position building correctly on ground
                    building.castShadow = true;
                    building.receiveShadow = true;
                    building.userData = { type: 'collider', surfaceType: 'building' };
                    scene.add(building);
                    buildings.push(building);
                    colliderMeshes.push(building);
                });
            };
            reader.readAsText(file);
        }
    });
    

    
    // Camera navigation controls
    document.getElementById('move-up').addEventListener('click', () => {
        camera.position.y += 10;
        console.log('📷 Camera moved up');
    });
    
    document.getElementById('move-down').addEventListener('click', () => {
        camera.position.y -= 10;
        console.log('📷 Camera moved down');
    });
    
    document.getElementById('move-left').addEventListener('click', () => {
        camera.position.x -= 10;
        console.log('📷 Camera moved left');
    });
    
    document.getElementById('move-right').addEventListener('click', () => {
        camera.position.x += 10;
        console.log('📷 Camera moved right');
    });
    
    document.getElementById('rotate-up').addEventListener('click', () => {
        camera.rotation.x -= 0.1;
        console.log('📷 Camera rotated up');
    });
    
    document.getElementById('rotate-down').addEventListener('click', () => {
        camera.rotation.x += 0.1;
        console.log('📷 Camera rotated down');
    });
    
    document.getElementById('rotate-left').addEventListener('click', () => {
        camera.rotation.y -= 0.1;
        console.log('📷 Camera rotated left');
    });
    
    document.getElementById('rotate-right').addEventListener('click', () => {
        camera.rotation.y += 0.1;
        console.log('📷 Camera rotated right');
    });
    
    document.getElementById('zoom-in').addEventListener('click', () => {
        camera.position.multiplyScalar(0.9);
        console.log('📷 Camera zoomed in');
    });
    
    document.getElementById('zoom-out').addEventListener('click', () => {
        camera.position.multiplyScalar(1.1);
        console.log('📷 Camera zoomed out');
    });
    
    document.getElementById('zoom-extended').addEventListener('click', () => {
        camera.position.set(100, 100, 100);
        camera.lookAt(0, 0, 0);
        console.log('📷 Camera zoomed to extended view');
    });
    
    document.getElementById('reset-camera').addEventListener('click', () => {
        camera.position.set(50, 50, 50);
        camera.rotation.set(0, 0, 0);
        camera.lookAt(0, 0, 0);
        console.log('📷 Camera reset to default position');
    });
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    
    // Update compass to align with global -Z axis
    updateCompass();
}

// Handle mouse down
function onMouseDown(event) {
    console.log('🖱️ Mouse down event triggered:', event.button, 'isPlantingTree:', isPlantingTree, 'plantingMode:', plantingMode);
    console.log('🖱️ Controls enabled:', controls.enabled);
    console.log('🖱️ Plant tree button text:', document.getElementById('plant-tree').textContent);
    console.log('🖱️ Brush mode button active:', document.getElementById('brush-mode').classList.contains('active'));
    
    // Prevent default behavior to ensure our events work
    event.preventDefault();
    event.stopPropagation();
    
    if (isPlantingTree && plantingMode === 'brush') {
        // Check if it's right click (button 2) for tree removal
        if (event.button === 2) {
            console.log('🗑️ Right click in brush mode - removing trees in radius');
            removeTreesInBrushRadius(event);
            return;
        }
        
        // Left click for planting trees
        if (event.button === 0) {
            console.log('🌳 Brush mode mouse down detected, starting tree planting');
        isDragging = true;
            
            // Get the starting point for brush
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            
            // Account for toolbar offset (60px) and top panel offset (80px)
            mouse.x = ((event.clientX - 60) / (window.innerWidth - 60)) * 2 - 1;
            mouse.y = -((event.clientY - 80) / (window.innerHeight - 80)) * 2 + 1;
            
            raycaster.setFromCamera(mouse, camera);
            // Filter out brush preview from collision detection
            const objectsToCheck = colliderMeshes.filter(obj => 
                !obj.userData || obj.userData.type !== 'brush-preview'
            );
            const colliderIntersects = raycaster.intersectObjects(objectsToCheck, false);
            
            if (colliderIntersects.length > 0) {
                const point = colliderIntersects[0].point;
                const surfaceNormal = colliderIntersects[0].face.normal.clone();
                const surfaceType = colliderIntersects[0].object.userData.surfaceType;
                
                console.log('🌳 Planting first tree at:', point);
        // Plant first tree immediately
                plantTreeOnSurface(point, surfaceNormal, surfaceType, colliderIntersects[0].object);
            } else {
                console.log('❌ No surface intersection found for brush start');
            }
        }
        // Right click for removing trees
        else if (event.button === 2) {
            console.log('🗑️ Brush mode right mouse down detected, starting tree removal');
            isDragging = true;
            
            // Remove trees at the initial click point
            removeTreesInBrushRadius(event);
        }
    } else {
        console.log('❌ Brush mode not active - isPlantingTree:', isPlantingTree, 'plantingMode:', plantingMode);
    }
}

// Handle mouse move
function onMouseMove(event) {
    // Show brush preview when not dragging but in brush mode
    if (!isDragging && isPlantingTree && plantingMode === 'brush') {
        console.log('🖱️ Showing brush preview, isPlantingTree:', isPlantingTree, 'plantingMode:', plantingMode);
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        // Account for toolbar offset (60px) and top panel offset (80px)
        mouse.x = ((event.clientX - 60) / (window.innerWidth - 60)) * 2 - 1;
        mouse.y = -((event.clientY - 80) / (window.innerHeight - 80)) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        // Filter out brush preview and rectangle from collision detection
        const objectsToCheck = colliderMeshes.filter(obj => 
            !obj.userData || obj.userData.type !== 'brush-preview' && obj.userData.type !== 'brush-rectangle'
        );
        const colliderIntersects = raycaster.intersectObjects(objectsToCheck, false);
        
        if (colliderIntersects.length > 0) {
            const currentPoint = colliderIntersects[0].point;
            // Show brush preview circle - green for planting, red for removal
            const isRemoval = event.buttons & 2; // Check if right mouse button is pressed
            createBrushPreview(currentPoint, brushDistance, isRemoval);
        }
    }
    
    // Plant trees continuously while dragging with brush tool
    if (isDragging && isPlantingTree && plantingMode === 'brush') {
        console.log('🖱️ Mouse move in brush mode - isDragging:', isDragging, 'buttons:', event.buttons);
        
        // Check if left mouse button is still pressed (planting trees)
        if (event.buttons & 1) { // Left mouse button (bit 0)
            console.log('🌳 Planting trees while mouse is held down');
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            
            // Account for toolbar offset (60px) and top panel offset (80px)
            mouse.x = ((event.clientX - 60) / (window.innerWidth - 60)) * 2 - 1;
            mouse.y = -((event.clientY - 80) / (window.innerHeight - 80)) * 2 + 1;
            
            raycaster.setFromCamera(mouse, camera);
            // Filter out brush preview from collision detection
            const objectsToCheck = colliderMeshes.filter(obj => 
                !obj.userData || obj.userData.type !== 'brush-preview'
            );
            const colliderIntersects = raycaster.intersectObjects(objectsToCheck, false);
            
            if (colliderIntersects.length > 0) {
                const currentPoint = colliderIntersects[0].point;
                console.log('🌳 Planting trees at:', currentPoint);
                // Plant trees continuously while mouse is held down
                plantTreeOnSurface(currentPoint, colliderIntersects[0].face.normal.clone(), colliderIntersects[0].object.userData.surfaceType, colliderIntersects[0].object);
            }
        }
        // Check if right mouse button is still pressed (removing trees)
        else if (event.buttons & 2) { // Right mouse button (bit 1)
            console.log('🗑️ Removing trees while mouse is held down');
            removeTreesInBrushRadius(event);
        }
        else {
            // No mouse buttons pressed, stop dragging
            console.log('🖱️ Mouse buttons released, stopping brush operations');
            isDragging = false;
        }
    }
    
    // Plant trees continuously while dragging with brush tool (now handled in brush rectangle update)
    // if (isDragging && isPlantingTree && plantingMode === 'brush') {
    //     console.log('Planting tree during drag');
    //     plantTreeAtMousePosition(event);
    // }
    
    // Handle drawing tools (existing functionality)
    if (isDrawingStreet || isDrawingGreen) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        // Account for toolbar offset (60px) and top panel offset (80px)
        mouse.x = ((event.clientX - 60) / (window.innerWidth - 60)) * 2 - 1;
        mouse.y = -((event.clientY - 80) / (window.innerHeight - 80)) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(colliderMeshes, false);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            if (isDrawingStreet) {
                drawStreet(point);
            } else if (isDrawingGreen) {
                drawGreenSpace(point);
            }
        }
    }
}

// Handle mouse up
function onMouseUp(event) {
    if (isDragging && isPlantingTree && plantingMode === 'brush') {
        console.log('Stopping tree planting - mouse button released');
    }
    isDragging = false;
}

// Brush rectangle functions removed - no longer needed

// Create brush preview circle
function createBrushPreview(position, brushDistance, isRemoval = false) {
    // Remove existing preview if any
    if (brushPreview) {
        scene.remove(brushPreview);
    }
    
    // Create circle geometry for brush preview
    const geometry = new THREE.CircleGeometry(brushDistance, 32);
    const material = new THREE.MeshBasicMaterial({
        color: isRemoval ? 0xff0000 : 0x00ff00, // Red for removal, green for planting
        transparent: true,
        opacity: 0.2,
        //side: THREE.DoubleSide
    });
    
    brushPreview = new THREE.Mesh(geometry, material);
    brushPreview.position.copy(position);
    brushPreview.rotation.x = -Math.PI / 2; // Lay flat on ground
    
    // Make sure the preview doesn't interfere with mouse events
    brushPreview.userData = { type: 'brush-preview' };
    
    // Add to scene
    scene.add(brushPreview);
}

// Remove brush preview
function removeBrushPreview() {
    if (brushPreview) {
        scene.remove(brushPreview);
        brushPreview = null;
    }
}

// Remove all trees within brush radius at mouse position
function removeTreesInBrushRadius(event) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Account for toolbar offset (60px) and top panel offset (80px)
    mouse.x = ((event.clientX - 60) / (window.innerWidth - 60)) * 2 - 1;
    mouse.y = -((event.clientY - 80) / (window.innerHeight - 80)) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    // Filter out brush preview from collision detection
    const objectsToCheck = colliderMeshes.filter(obj => 
        !obj.userData || obj.userData.type !== 'brush-preview'
    );
    const colliderIntersects = raycaster.intersectObjects(objectsToCheck, false);
    
    if (colliderIntersects.length > 0) {
        const centerPoint = colliderIntersects[0].point;
        console.log('🗑️ Removing trees around point:', centerPoint, 'with radius:', brushDistance);
        
        // Show red brush preview to indicate removal mode
        createBrushPreview(centerPoint, brushDistance, true);
        
        // Find all trees within the brush radius
        const treesToRemove = [];
        for (let i = trees.length - 1; i >= 0; i--) {
            const tree = trees[i];
            const distance = centerPoint.distanceTo(tree.position);
            
            if (distance <= brushDistance) {
                treesToRemove.push(tree);
                console.log('🗑️ Tree marked for removal at distance:', distance);
            }
        }
        
        // Remove the trees from scene and array
        treesToRemove.forEach(tree => {
            scene.remove(tree);
            const index = trees.indexOf(tree);
            if (index > -1) {
                trees.splice(index, 1);
            }
        });
        
        console.log('🗑️ Removed', treesToRemove.length, 'trees from the scene');
        
        // Update hierarchy counts
        updateHierarchyCounts();
    } else {
        console.log('❌ No surface intersection found for tree removal');
    }
}

// Helper function to plant tree at mouse position
function plantTreeAtMousePosition(event) {
    console.log('plantTreeAtMousePosition called with event:', event.type);
    
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Account for toolbar offset (60px) and top panel offset (80px)
    mouse.x = ((event.clientX - 60) / (window.innerWidth - 60)) * 2 - 1;
    mouse.y = -((event.clientY - 80) / (window.innerHeight - 80)) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    // Filter out brush preview from collision detection
    const objectsToCheck = colliderMeshes.filter(obj => 
        !obj.userData || obj.userData.type !== 'brush-preview'
    );
    const colliderIntersects = raycaster.intersectObjects(objectsToCheck, false);
    
    if (colliderIntersects.length > 0) {
        const intersect = colliderIntersects[0];
        const point = intersect.point;
        const surfaceNormal = intersect.face.normal.clone();
        const surfaceType = intersect.object.userData.surfaceType;
        
        console.log('Planting tree at:', point, 'on surface:', surfaceType);
        plantTreeOnSurface(point, surfaceNormal, surfaceType, null);
    } else {
        console.log('No surface intersection found for tree planting');
    }
}

// Update compass to align with global -Z axis
function updateCompass() {
    const compass = document.getElementById('compass');
    if (!compass) return;
    
    // Get camera's forward direction in world space
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);
    
    // Project camera direction onto XZ plane (ignore Y component)
    const cameraDirectionXZ = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
    
    // Calculate angle between camera direction and global -Z axis
    const negativeZAxis = new THREE.Vector3(0, 0, -1);
    const angle = Math.atan2(cameraDirectionXZ.x, cameraDirectionXZ.z);
    
    // Rotate compass to align with global -Z axis
    compass.style.transform = `rotate(${angle}rad)`;
}

// Handle right click for tree deletion
function onRightClick(event) {
    event.preventDefault(); // Prevent default context menu
    
    // If in brush mode, let the brush handle right-click
    if (isPlantingTree && plantingMode === 'brush') {
        return;
    }
    
    // Allow tree deletion in single mode or when not planting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Account for toolbar offset (60px) and top panel offset (80px)
    mouse.x = ((event.clientX - 60) / (window.innerWidth - 60)) * 2 - 1;
    mouse.y = -((event.clientY - 80) / (window.innerHeight - 80)) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Check for tree intersection
    const treeIntersects = raycaster.intersectObjects(trees, true);
    if (treeIntersects.length > 0) {
        const selectedObject = treeIntersects[0].object;
        const tree = selectedObject.parent;
        
        console.log('🗑️ Deleting tree via right-click');
        scene.remove(tree);
        trees = trees.filter(t => t !== tree);
        
        // Update hierarchy counts
        updateHierarchyCounts();
    }
}

// Function to reset the scene
function resetScene() {
    // Clear trees
    trees.forEach(tree => scene.remove(tree));
    trees = [];
    
    // Clear buildings
    buildings.forEach(building => scene.remove(building));
    buildings = [];
    
    // Clear collider meshes
    colliderMeshes = [];
    
    // Clear current drawing
    if (currentDrawing) {
        scene.remove(currentDrawing);
        currentDrawing = null;
    }
    
    // Clear ground, grid, and axes
    if (ground) {
        scene.remove(ground);
        ground = null;
    }
    
    if (gridHelper) {
        scene.remove(gridHelper);
        gridHelper = null;
    }
    
    scene.children.forEach(child => {
        // Hide global axes (child.userData && child.userData.type === 'axes')
        if (child.userData && child.userData.type === 'axes') {
            child.visible = false;
        }
    });
    
    // Disable grid and global axis checkboxes
    document.getElementById('grid-toggle').checked = false;
    document.getElementById('global-axis-toggle').checked = false;
    
    // Update hierarchy counts
    updateHierarchyCounts();
    
    console.log('🧹 Scene reset - all objects cleared including ground, grid, and axes');
}

// Initialize main menu
function initMainMenu() {
    // File menu options
    document.getElementById('new-empty-scene').addEventListener('click', () => {
        if (confirm('Are you sure you want to create an empty scene? This will clear all current objects.')) {
        resetScene();
    }
    });
    
    document.getElementById('new-random-scene').addEventListener('click', () => {
        if (confirm('Are you sure you want to refresh to default scene? This will clear all current objects and restore the default scene.')) {
        resetScene();
            initDefaultScene();
        }
    });
    
    document.getElementById('open-scene').addEventListener('click', () => {
        document.getElementById('import-scene').click();
    });
    
    document.getElementById('import-stl').addEventListener('click', () => {
        importSTLFile();
    });
    
    document.getElementById('save-scene').addEventListener('click', () => {
        document.getElementById('export-scene').click();
    });
    
    // Edit menu options
    document.getElementById('undo').addEventListener('click', () => {
        console.log('↩️ Undo action triggered');
        undo();
    });
    
    document.getElementById('redo').addEventListener('click', () => {
        console.log('↪️ Redo action triggered');
        redo();
    });
    
    document.getElementById('select-all').addEventListener('click', () => {
        console.log('👆 Select all objects in scene');
        
        // Clear current selection
        clearSelection();
        
        // Select all objects in the scene
        const allSelectableObjects = [];
        
        // Add ground if it exists
        if (ground) {
            allSelectableObjects.push(ground);
        }
        
        // Add all buildings
        allSelectableObjects.push(...buildings);
        
        // Add all trees
        allSelectableObjects.push(...trees);
        
        // Add current drawing if it exists
        if (currentDrawing) {
            allSelectableObjects.push(currentDrawing);
        }
        
        // Add all STL objects
        allSelectableObjects.push(...stlObjects);
        
        // Set all objects as selected
        selectedObjects = [...allSelectableObjects];
        
        // Update visual feedback
        updateSelectionVisuals();
        updateHierarchySelectionVisuals();
        
        console.log('👆 Selected', selectedObjects.length, 'objects');
    });
    
    document.getElementById('clear-selection').addEventListener('click', () => {
        console.log('👆 Clear selection');
        clearSelection();
        updateSelectionVisuals();
        updateHierarchySelectionVisuals();
    });
    
    document.getElementById('delete-selected').addEventListener('click', () => {
        console.log('🗑️ Delete selected objects');
        deleteSelectedObjects();
    });
    
    // Settings menu options
    document.getElementById('settings-panel-toggle').addEventListener('click', () => {
        openPreferencesWindow();
    });
}

// Function to open preferences window
function openPreferencesWindow() {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'preferences-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    
    // Create preferences window
    const preferencesWindow = document.createElement('div');
    preferencesWindow.style.cssText = `
        background: #2a2a2a;
        border: 1px solid #404040;
        border-radius: 8px;
        padding: 20px;
        min-width: 400px;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;
    
    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 1px solid #404040;
    `;
    
    const title = document.createElement('h2');
    title.textContent = 'Preferences';
    title.style.cssText = `
        margin: 0;
        color: #e0e0e0;
        font-size: 18px;
        font-weight: 500;
    `;
    
    header.appendChild(title);
    
    // Create settings content
    const content = document.createElement('div');
    content.innerHTML = `
        <div style="margin-bottom: 20px;">
            <label style="display: flex; align-items: center; margin-bottom: 10px; color: #e0e0e0; font-size: 14px;">
                <input type="checkbox" id="pref-global-axis" ${globalAxisVisible ? 'checked' : ''} style="margin-right: 8px;">
                Show Global Axis
            </label>
            <label style="display: flex; align-items: center; margin-bottom: 10px; color: #e0e0e0; font-size: 14px;">
                <input type="checkbox" id="pref-grid" ${gridVisible ? 'checked' : ''} style="margin-right: 8px;">
                Show Grid
            </label>
            <label style="display: flex; align-items: center; margin-bottom: 10px; color: #e0e0e0; font-size: 14px;">
                <input type="checkbox" id="pref-fog" ${scene.fog ? 'checked' : ''} style="margin-right: 8px;">
                Enable Fog
            </label>
                </div>
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: #e0e0e0; font-size: 14px;">
                Fog Density:
                <span id="pref-fog-value" style="margin-left: 8px; color: #c0c0c0;">${document.getElementById('fog-distance') ? document.getElementById('fog-distance').value : '0.0008'}</span>
            </label>
            <input type="range" id="pref-fog-distance" min="0.0001" max="0.03" value="${document.getElementById('fog-distance') ? document.getElementById('fog-distance').value : '0.0008'}" step="0.0001" style="width: 100%;">
                </div>
        <div style="text-align: right;">
            <button id="pref-apply" style="
                background: #0078d4;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                margin-right: 8px;
            ">Apply</button>
            <button id="pref-cancel" style="
                background: #404040;
                color: #e0e0e0;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            ">Cancel</button>
            </div>
        `;
    
    preferencesWindow.appendChild(header);
    preferencesWindow.appendChild(content);
    modal.appendChild(preferencesWindow);
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('pref-apply').onclick = () => {
        applyPreferences();
        document.body.removeChild(modal);
    };
    
    document.getElementById('pref-cancel').onclick = () => {
        document.body.removeChild(modal);
    };
    
    // Update fog value display
    document.getElementById('pref-fog-distance').oninput = (e) => {
        document.getElementById('pref-fog-value').textContent = e.target.value;
    };
    
    // Close on escape key
    modal.onkeydown = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
        }
    };
    
    // Close on background click
    modal.onclick = (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
    
    console.log('⚙️ Preferences window opened');
}

// Function to apply preferences
function applyPreferences() {
    const globalAxis = document.getElementById('pref-global-axis').checked;
    const grid = document.getElementById('pref-grid').checked;
    const fog = document.getElementById('pref-fog').checked;
    const fogDistance = parseFloat(document.getElementById('pref-fog-distance').value);
    
    // Apply global axis setting
    globalAxisVisible = globalAxis;
    scene.children.forEach(child => {
        if (child.userData && child.userData.type === 'axes') {
            child.visible = globalAxisVisible;
        }
    });
    
    // Apply grid setting
    gridVisible = grid;
    scene.children.forEach(child => {
        if (child instanceof THREE.GridHelper) {
            child.visible = gridVisible;
        }
    });
    
    // Apply fog setting
    if (fog) {
        scene.fog = new THREE.FogExp2(0x87CEEB, fogDistance);
    } else {
        scene.fog = null;
    }
    
    // Update UI checkboxes to match
    if (document.getElementById('global-axis-toggle')) {
        document.getElementById('global-axis-toggle').checked = globalAxis;
    }
    if (document.getElementById('grid-toggle')) {
        document.getElementById('grid-toggle').checked = grid;
    }
    if (document.getElementById('fog-toggle')) {
        document.getElementById('fog-toggle').checked = fog;
    }
    if (document.getElementById('fog-distance')) {
        document.getElementById('fog-distance').value = fogDistance;
        document.getElementById('fog-distance-value').textContent = fogDistance;
    }
    
    console.log('⚙️ Preferences applied');
}

// Initialize default scene
function initDefaultScene() {
    // Create ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200, 32, 32);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x7CFC00,
        //side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.2
    });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData = { type: 'collider', surfaceType: 'ground' };
    scene.add(ground);
    colliderMeshes.push(ground);

    // Add infinite grid
    gridHelper = new THREE.GridHelper(500, 100, 0x444444, 0x888888);
    gridHelper.position.y = 0.1;
    scene.add(gridHelper);

    // Add global axes helper
    createArrowAxes();

    // Create random buildings
    createRandomBuildings();
    
    // Reset camera to default position
    camera.position.set(0, 80, -140);
    camera.lookAt(0, 0, 0);
    
    // Update UI
    document.getElementById('grid-toggle').checked = true;
    document.getElementById('global-axis-toggle').checked = false;
    
    // Update hierarchy children
    updateHierarchyChildren();
    
    // Update toggle button states
    updateToggleButtonStates();
    
    console.log('🔄 Scene refreshed to default state with camera reset');
}

// Initialize the application
init();

// Hierarchy Panel Functions
function initHierarchyPanel() {
    console.log('🔧 Initializing hierarchy panel...');
    
    const hamburgerBtn = document.getElementById('hamburger-menu');
    const hierarchyPanel = document.getElementById('hierarchy-panel');
    const closeBtn = document.getElementById('hierarchy-close');
    
    console.log('🔧 Hamburger button found:', !!hamburgerBtn);
    console.log('🔧 Hierarchy panel found:', !!hierarchyPanel);
    console.log('🔧 Close button found:', !!closeBtn);
    
    // Toggle hierarchy panel
    hamburgerBtn.addEventListener('click', () => {
        hierarchyPanel.classList.toggle('open');
        hamburgerBtn.classList.toggle('active');
    });
    
    // Close hierarchy panel
    closeBtn.addEventListener('click', () => {
        hierarchyPanel.classList.remove('open');
        hamburgerBtn.classList.remove('active');
    });
    
    // Add expand/collapse functionality
    const hierarchyItems = document.querySelectorAll('.hierarchy-item');
    console.log('🔧 Hierarchy items found:', hierarchyItems.length);
    
    hierarchyItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't expand if clicking on the count, icon, or toggle button
            if (e.target.classList.contains('hierarchy-count') || 
                e.target.classList.contains('hierarchy-icon') ||
                e.target.classList.contains('hierarchy-toggle')) {
                return;
            }
    
            const itemType = item.getAttribute('data-type');
            const childrenContainer = document.querySelector(`[data-parent="${itemType}"]`);
            
            if (childrenContainer) {
                item.classList.toggle('expanded');
                childrenContainer.classList.toggle('expanded');
            }
        });
    });
    
    // Add toggle functionality for parent hierarchy items
    hierarchyItems.forEach(item => {
        const toggleBtn = item.querySelector('.hierarchy-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemType = item.getAttribute('data-type');
                toggleCategoryVisibility(itemType, toggleBtn);
            });
        }
    });
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && hierarchyPanel.classList.contains('open')) {
            hierarchyPanel.classList.remove('open');
            hamburgerBtn.classList.remove('active');
        }
    });
    
    // Update initial counts
    updateHierarchyCounts();
    
    // Update hierarchy children
    updateHierarchyChildren();
    
    // Update toggle button states
    updateToggleButtonStates();
    
    console.log('🔧 Hierarchy panel initialization complete');
}

// Update hierarchy with dynamic children
function updateHierarchyChildren() {
    console.log('🔄 updateHierarchyChildren called');
    console.log('🏢 Buildings count:', buildings.length);
    console.log('🌳 Trees count:', trees.length);
    console.log('✏️ Current drawing:', currentDrawing ? 'exists' : 'none');
    
    // Update buildings children
    const buildingsContainer = document.querySelector('[data-parent="buildings"]');
    if (buildingsContainer) {
        console.log('🏢 Found buildings container, updating children');
        buildingsContainer.innerHTML = '';
        buildings.forEach((building, index) => {
            const child = document.createElement('div');
            child.className = 'hierarchy-child';
            child.innerHTML = `
                <button class="hierarchy-toggle" title="Toggle Visibility">👁️</button>
                <span class="hierarchy-icon">🏢</span>
                <span class="hierarchy-name">Building ${index + 1}</span>
            `;
            // Add click handler for selection
            child.addEventListener('click', (e) => {
                if (e.target.classList.contains('hierarchy-toggle')) {
                    e.stopPropagation();
                    toggleObjectVisibility(building, e.target);
                    return;
                }
                console.log('🏢 Building clicked in hierarchy:', index + 1);
                e.stopPropagation();
                selectObjectFromHierarchy(building, e);
            });
            
            // Add double-click handler for zoom
            child.addEventListener('dblclick', (e) => {
                if (e.target.classList.contains('hierarchy-toggle')) {
                    return; // Don't zoom when double-clicking toggle button
                }
                console.log('🔍 Building double-clicked in hierarchy:', index + 1);
                e.stopPropagation();
                zoomToObject(building);
            });
            buildingsContainer.appendChild(child);
        });
    } else {
        console.log('❌ Buildings container not found');
    }
    
    // Update trees children
    const treesContainer = document.querySelector('[data-parent="trees"]');
    if (treesContainer) {
        console.log('🌳 Found trees container, updating children');
        treesContainer.innerHTML = '';
        trees.forEach((tree, index) => {
            const child = document.createElement('div');
            child.className = 'hierarchy-child';
            child.innerHTML = `
                <button class="hierarchy-toggle" title="Toggle Visibility">👁️</button>
                <span class="hierarchy-icon">🌳</span>
                <span class="hierarchy-name">Tree ${index + 1}</span>
            `;
            // Add click handler for selection
            child.addEventListener('click', (e) => {
                if (e.target.classList.contains('hierarchy-toggle')) {
                    e.stopPropagation();
                    toggleObjectVisibility(tree, e.target);
                    return;
                }
                console.log('🌳 Tree clicked in hierarchy:', index + 1);
                e.stopPropagation();
                selectObjectFromHierarchy(tree, e);
            });
            
            // Add double-click handler for zoom
            child.addEventListener('dblclick', (e) => {
                if (e.target.classList.contains('hierarchy-toggle')) {
                    return; // Don't zoom when double-clicking toggle button
                }
                console.log('🔍 Tree double-clicked in hierarchy:', index + 1);
                e.stopPropagation();
                zoomToObject(tree);
            });
            treesContainer.appendChild(child);
        });
    } else {
        console.log('❌ Trees container not found');
    }
    
    // Update drawings children
    const drawingsContainer = document.querySelector('[data-parent="drawings"]');
    if (drawingsContainer) {
        console.log('✏️ Found drawings container, updating children');
        drawingsContainer.innerHTML = '';
        if (currentDrawing) {
            const child = document.createElement('div');
            child.className = 'hierarchy-child';
            child.innerHTML = `
                <button class="hierarchy-toggle" title="Toggle Visibility">👁️</button>
                <span class="hierarchy-icon">✏️</span>
                <span class="hierarchy-name">Drawing 1</span>
            `;
            // Add click handler for selection
            child.addEventListener('click', (e) => {
                if (e.target.classList.contains('hierarchy-toggle')) {
                    e.stopPropagation();
                    toggleObjectVisibility(currentDrawing, e.target);
                    return;
                }
                e.stopPropagation();
                selectObjectFromHierarchy(currentDrawing, e);
            });
            
            // Add double-click handler for zoom
            child.addEventListener('dblclick', (e) => {
                if (e.target.classList.contains('hierarchy-toggle')) {
                    return; // Don't zoom when double-clicking toggle button
                }
                console.log('🔍 Drawing double-clicked in hierarchy');
                e.stopPropagation();
                zoomToObject(currentDrawing);
            });
            drawingsContainer.appendChild(child);
        }
    } else {
        console.log('❌ Drawings container not found');
    }
    
    // Update STL objects children
    const stlContainer = document.querySelector('[data-parent="stl-objects"]');
    if (stlContainer) {
        console.log('📦 Found STL objects container, updating children');
        console.log('📦 Total STL objects:', stlObjects.length);
        stlContainer.innerHTML = '';
        
        // Group STL objects by category
        const categorizedSTLObjects = {
            buildings: [],
            trees: [],
            roads: [],
            highways: [],
            ground: [],
            greenAreas: [],
            other: []
        };
        
        // Categorize STL objects
        stlObjects.forEach((stlObject, index) => {
            console.log(`📦 STL object ${index}:`, stlObject.userData);
            const category = stlObject.userData.category || 'other';
            if (categorizedSTLObjects[category]) {
                categorizedSTLObjects[category].push({ object: stlObject, index });
            } else {
                categorizedSTLObjects.other.push({ object: stlObject, index });
            }
        });
        
        // Log categorization results
        Object.keys(categorizedSTLObjects).forEach(category => {
            if (categorizedSTLObjects[category].length > 0) {
                console.log(`📦 ${category}: ${categorizedSTLObjects[category].length} objects`);
            }
        });
        
        // Create hierarchy children for each category
        Object.keys(categorizedSTLObjects).forEach(category => {
            const objects = categorizedSTLObjects[category];
            if (objects.length > 0) {
                const categoryIcon = getCategoryIcon(category);
                const categoryName = getCategoryName(category);
                
                objects.forEach(({ object, index }) => {
                    const child = document.createElement('div');
                    child.className = 'hierarchy-child';
                    const fileName = object.userData.fileName || `${categoryName} ${index + 1}`;
                    child.innerHTML = `
                        <button class="hierarchy-toggle" title="Toggle Visibility">👁️</button>
                        <span class="hierarchy-icon">${categoryIcon}</span>
                        <span class="hierarchy-name">${fileName}</span>
                    `;
                    
                    // Add click handler for selection
                    child.addEventListener('click', (e) => {
                        if (e.target.classList.contains('hierarchy-toggle')) {
                            e.stopPropagation();
                            toggleObjectVisibility(object, e.target);
                            return;
                        }
                        console.log(`📦 ${categoryName} clicked in hierarchy:`, fileName);
                        e.stopPropagation();
                        selectObjectFromHierarchy(object, e);
                    });
                    
                    // Add double-click handler for zoom
                    child.addEventListener('dblclick', (e) => {
                        if (e.target.classList.contains('hierarchy-toggle')) {
                            return; // Don't zoom when double-clicking toggle button
                        }
                        console.log(`🔍 ${categoryName} double-clicked in hierarchy:`, fileName);
                        e.stopPropagation();
                        zoomToObject(object);
                    });
                    stlContainer.appendChild(child);
                });
            }
        });
    } else {
        console.log('❌ STL objects container not found');
    }
    
    // Update ground children
    const groundContainer = document.querySelector('[data-parent="ground"]');
    if (groundContainer) {
        console.log('🌍 Found ground container, updating children');
        console.log('🌍 Ground container element:', groundContainer);
        console.log('🌍 Ground object exists:', !!ground);
        // Find existing ground child or create new one
        let groundChild = groundContainer.querySelector('.hierarchy-child');
        if (!groundChild) {
            groundChild = document.createElement('div');
            groundChild.className = 'hierarchy-child';
            groundChild.innerHTML = `
                <button class="hierarchy-toggle" title="Toggle Visibility">👁️</button>
                <span class="hierarchy-icon">🌍</span>
                <span class="hierarchy-name">Ground Plane</span>
            `;
            groundContainer.appendChild(groundChild);
        }
        
        // Remove existing click handlers and add new one
        groundChild.replaceWith(groundChild.cloneNode(true));
        groundChild = groundContainer.querySelector('.hierarchy-child');
        groundChild.addEventListener('click', (e) => {
            if (e.target.classList.contains('hierarchy-toggle')) {
                e.stopPropagation();
                toggleObjectVisibility(ground, e.target);
                return;
            }
            console.log('🌍 Ground plane clicked in hierarchy');
            e.stopPropagation();
            selectObjectFromHierarchy(ground, e);
        });
        
        // Add double-click handler for zoom
        groundChild.addEventListener('dblclick', (e) => {
            if (e.target.classList.contains('hierarchy-toggle')) {
                return; // Don't zoom when double-clicking toggle button
            }
            console.log('🔍 Ground plane double-clicked in hierarchy');
            e.stopPropagation();
            zoomToObject(ground);
        });
    } else {
        console.log('❌ Ground container not found');
    }
}

// Update hierarchy counts
function updateHierarchyCounts() {
    const buildingCount = document.getElementById('building-count');
    const treeCount = document.getElementById('tree-count');
    const drawingCount = document.getElementById('drawing-count');
    const stlCount = document.getElementById('stl-count');
    
    // Count categorized STL objects
    const categorizedCounts = {
        buildings: 0,
        trees: 0,
        roads: 0,
        highways: 0,
        ground: 0,
        greenAreas: 0,
        other: 0
    };
    
    stlObjects.forEach(obj => {
        const category = obj.userData.category || 'other';
        if (categorizedCounts[category] !== undefined) {
            categorizedCounts[category]++;
        } else {
            categorizedCounts.other++;
        }
    });
    
    // Update regular counts
    if (buildingCount) buildingCount.textContent = buildings.length + categorizedCounts.buildings;
    if (treeCount) treeCount.textContent = trees.length + categorizedCounts.trees;
    if (drawingCount) drawingCount.textContent = currentDrawing ? 1 : 0;
    if (stlCount) stlCount.textContent = stlObjects.length;
    
    // Log categorization summary
    console.log('📊 STL Object Categorization Summary:');
    Object.keys(categorizedCounts).forEach(category => {
        if (categorizedCounts[category] > 0) {
            console.log(`  ${getCategoryName(category)}: ${categorizedCounts[category]}`);
        }
    });
    
    // Update children as well
    updateHierarchyChildren();
    
    // Update toggle button states
    updateToggleButtonStates();
}

// Save current scene state for undo/redo
function saveSceneState(action = '') {
    const state = {
        action: action,
        timestamp: Date.now(),
        ground: ground ? {
            position: ground.position.clone(),
            rotation: ground.rotation.clone(),
            scale: ground.scale.clone(),
            visible: ground.visible,
            userData: { ...ground.userData }
        } : null,
        buildings: buildings.map(building => ({
            position: building.position.clone(),
            rotation: building.rotation.clone(),
            scale: building.scale.clone(),
            visible: building.visible,
            geometry: {
                width: building.geometry.parameters.width,
                height: building.geometry.parameters.height,
                depth: building.geometry.parameters.depth
            },
            userData: { ...building.userData }
        })),
        trees: trees.map(tree => ({
            position: tree.position.clone(),
            rotation: tree.rotation.clone(),
            scale: tree.scale.clone(),
            visible: tree.visible,
            userData: { ...tree.userData }
        })),
        stlObjects: stlObjects.map(stlObj => ({
            position: stlObj.position.clone(),
            rotation: stlObj.rotation.clone(),
            scale: stlObj.scale.clone(),
            visible: stlObj.visible,
            geometry: stlObj.geometry.parameters,
            material: { color: stlObj.material.color.getHexString() },
            userData: { ...stlObj.userData }
        })),
        currentDrawing: currentDrawing ? {
            position: currentDrawing.position.clone(),
            rotation: currentDrawing.rotation.clone(),
            scale: currentDrawing.scale.clone(),
            visible: currentDrawing.visible,
            children: currentDrawing.children.map(child => ({
                position: child.position.clone(),
                rotation: child.rotation.clone(),
                scale: child.scale.clone(),
                visible: child.visible,
                geometry: child.geometry.parameters,
                material: { color: child.material.color.getHexString() }
            }))
        } : null,
        colliderMeshes: colliderMeshes.map(mesh => ({
            position: mesh.position.clone(),
            rotation: mesh.rotation.clone(),
            scale: mesh.scale.clone(),
            visible: mesh.visible,
            userData: { ...mesh.userData }
        }))
    };
    
    // Add to undo stack
    undoStack.push(state);
    
    // Limit undo stack size
    if (undoStack.length > maxUndoSteps) {
        undoStack.shift();
    }
    
    // Clear redo stack when new action is performed
    redoStack = [];
    
    console.log('💾 Saved scene state for action:', action, 'Undo stack size:', undoStack.length);
}

// Restore scene state from undo/redo
function restoreSceneState(state) {
    console.log('🔄 Restoring scene state for action:', state.action);
    
    // Clear current scene objects
    buildings.forEach(building => scene.remove(building));
    trees.forEach(tree => scene.remove(tree));
    stlObjects.forEach(stlObj => scene.remove(stlObj));
    if (currentDrawing) scene.remove(currentDrawing);
    
    // Restore ground
    if (state.ground && ground) {
        ground.position.copy(state.ground.position);
        ground.rotation.copy(state.ground.rotation);
        ground.scale.copy(state.ground.scale);
        ground.visible = state.ground.visible;
        ground.userData = { ...state.ground.userData };
    }
    
    // Restore buildings
    buildings = [];
    state.buildings.forEach(buildingData => {
        const geometry = new THREE.BoxGeometry(
            buildingData.geometry.width,
            buildingData.geometry.height,
            buildingData.geometry.depth,
            2, 2, 2
        );
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
            //side: THREE.DoubleSide,
            roughness: 0.7,
            metalness: 0.2,
            flatShading: false
        });
        const building = new THREE.Mesh(geometry, material);
        building.position.copy(buildingData.position);
        building.rotation.copy(buildingData.rotation);
        building.scale.copy(buildingData.scale);
        building.visible = buildingData.visible;
        building.castShadow = true;
        building.receiveShadow = true;
        building.userData = { ...buildingData.userData };
        scene.add(building);
        buildings.push(building);
    });
    
    // Restore trees
    trees = [];
    state.trees.forEach(treeData => {
        const tree = new THREE.Group();
        
        // Create trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, treeData.userData.height * 0.3, 8, 4);
        const trunkMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            roughness: 0.9,
            metalness: 0.1,
            //side: THREE.DoubleSide
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        
        // Create foliage
        const foliageGeometry = new THREE.ConeGeometry(treeData.userData.height * 0.4, treeData.userData.height * 0.7, 8, 4);
        const foliageMaterial = new THREE.MeshStandardMaterial({ 
            color: treeData.userData.color,
            roughness: 0.8,
            metalness: 0.1,
            //side: THREE.DoubleSide
        });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.y = treeData.userData.height * 0.5;
        
        tree.add(trunk);
        tree.add(foliage);
        tree.position.copy(treeData.position);
        tree.rotation.copy(treeData.rotation);
        tree.scale.copy(treeData.scale);
        tree.visible = treeData.visible;
        tree.userData = { ...treeData.userData };
        
        trunk.castShadow = true;
        foliage.castShadow = true;
        scene.add(tree);
        trees.push(tree);
    });
    
    // Restore STL objects
    stlObjects = [];
    if (state.stlObjects) {
        state.stlObjects.forEach(stlData => {
            // Recreate geometry from STL data
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(stlData.geometry.attributes.position.array, 3));
            geometry.setAttribute('normal', new THREE.BufferAttribute(stlData.geometry.attributes.normal.array, 3));
            
            const material = new THREE.MeshStandardMaterial({
                color: parseInt(stlData.material.color, 16),
                roughness: 0.7,
                metalness: 0.2,
                flatShading: true,
                //side: THREE.DoubleSide
            });
            
            const stlMesh = new THREE.Mesh(geometry, material);
            stlMesh.position.copy(stlData.position);
            stlMesh.rotation.copy(stlData.rotation);
            stlMesh.scale.copy(stlData.scale);
            stlMesh.visible = stlData.visible;
            stlMesh.castShadow = true;
            stlMesh.receiveShadow = true;
            stlMesh.userData = { ...stlData.userData };
            
            scene.add(stlMesh);
            stlObjects.push(stlMesh);
        });
    }
    
    // Restore current drawing
    if (state.currentDrawing) {
        currentDrawing = new THREE.Group();
        currentDrawing.position.copy(state.currentDrawing.position);
        currentDrawing.rotation.copy(state.currentDrawing.rotation);
        currentDrawing.scale.copy(state.currentDrawing.scale);
        currentDrawing.visible = state.currentDrawing.visible;
        
        state.currentDrawing.children.forEach(childData => {
            const geometry = new THREE.BoxGeometry(
                childData.geometry.width,
                childData.geometry.height,
                childData.geometry.depth
            );
            const material = new THREE.MeshStandardMaterial({ 
                color: parseInt(childData.material.color, 16),
                //side: THREE.DoubleSide
            });
            const child = new THREE.Mesh(geometry, material);
            child.position.copy(childData.position);
            child.rotation.copy(childData.rotation);
            child.scale.copy(childData.scale);
            child.visible = childData.visible;
            currentDrawing.add(child);
        });
        scene.add(currentDrawing);
    } else {
        currentDrawing = null;
    }
    
    // Restore collider meshes
    colliderMeshes = [];
    state.colliderMeshes.forEach(meshData => {
        if (meshData.userData.surfaceType === 'ground' && ground) {
            ground.position.copy(meshData.position);
            ground.rotation.copy(meshData.rotation);
            ground.scale.copy(meshData.scale);
            ground.visible = meshData.visible;
            ground.userData = { ...meshData.userData };
            colliderMeshes.push(ground);
        } else if (meshData.userData.surfaceType === 'building') {
            // Buildings are already restored above
            buildings.forEach(building => colliderMeshes.push(building));
        }
    });
    
    // Clear selection
    clearSelection();
    
    // Update UI
    updateHierarchyCounts();
    updateSelectionVisuals();
    updateHierarchySelectionVisuals();
    
    console.log('✅ Scene state restored');
}

// Handle object selection
function handleObjectSelection(event, raycaster) {
    const isCtrlPressed = event.ctrlKey || event.metaKey; // Ctrl for Windows, Cmd for Mac
    
    // Get all objects in the scene that can be selected
    const allSelectableObjects = [];
    
    // Add all scene children that have geometry and are not selection outlines, and skip grid/axes
    scene.children.forEach(child => {
        if ((child.userData && child.userData.type === 'axes') ||
            (child.userData && child.userData.isSelectionOutline) ||
            (child instanceof THREE.GridHelper)) {
            return;
        }
        if (child.geometry) {
            allSelectableObjects.push(child);
        }
        // Also check children of groups (like trees)
        if (child.type === 'Group') {
            child.children.forEach(groupChild => {
                if (groupChild.geometry && (!groupChild.userData || !groupChild.userData.isSelectionOutline)) {
                    allSelectableObjects.push(groupChild);
                }
            });
        }
    });
    // Explicitly add ground if not already included
    if (ground && !allSelectableObjects.includes(ground)) {
        allSelectableObjects.push(ground);
    }
    
    const intersects = raycaster.intersectObjects(allSelectableObjects, true);
    
    if (intersects.length > 0) {
        const selectedObject = intersects[0].object;
        let targetObject = selectedObject;
        
        // If we clicked on a child of a tree (trunk or foliage), get the parent tree
        if (selectedObject.parent && selectedObject.parent.type === 'Group' && trees.includes(selectedObject.parent)) {
            targetObject = selectedObject.parent;
        }
        // If we clicked on a child of any group, get the parent group
        if (selectedObject.parent && selectedObject.parent.type === 'Group') {
            targetObject = selectedObject.parent;
        }
        if (!isCtrlPressed) {
            // Single selection - clear previous selection
            clearSelection();
            selectedObjects.push(targetObject);
            console.log('👆 Selected object:', getObjectName(targetObject));
        } else {
            // Multi-selection - add to existing selection
            if (selectedObjects.includes(targetObject)) {
                // Remove from selection if already selected
                selectedObjects = selectedObjects.filter(obj => obj !== targetObject);
                console.log('👆 Removed object from selection:', getObjectName(targetObject));
            } else {
                // Add to selection
                selectedObjects.push(targetObject);
                console.log('👆 Added object to selection:', getObjectName(targetObject));
            }
        }
        // Update visual feedback
        updateSelectionVisuals();
        updateHierarchySelectionVisuals();
    } else {
        // Clicked on empty space
        if (!isCtrlPressed) {
            // Clear selection if not holding Ctrl/Cmd
            clearSelection();
            updateSelectionVisuals();
            updateHierarchySelectionVisuals();
        }
    }
}

// Clear all selected objects
function clearSelection() {
    // Remove selection outlines from groups
    selectedObjects.forEach(obj => {
        if (obj.type === 'Group') {
            obj.children.forEach(child => {
                if (child.userData && child.userData.isSelectionOutline) {
                    obj.remove(child);
                }
            });
        }
    });
    
    selectedObjects = [];
    console.log('👆 Selection cleared');
    
    // Clear hierarchy visual feedback
    updateHierarchySelectionVisuals();
}

// Update visual feedback for selected objects
function updateSelectionVisuals() {
    // Remove previous selection visuals from scene
    scene.children.forEach(child => {
        if (child.userData && child.userData.isSelectionOutline) {
            scene.remove(child);
        }
    });
    
    // Remove previous selection visuals from groups
    scene.children.forEach(child => {
        if (child.type === 'Group') {
            child.children.forEach(groupChild => {
                if (groupChild.userData && groupChild.userData.isSelectionOutline) {
                    child.remove(groupChild);
                }
            });
        }
    });
    
    // Add selection outlines for selected objects
    selectedObjects.forEach(obj => {
        if (obj.type === 'Group') {
            // For groups (like trees), create outlines for all children
            obj.children.forEach(child => {
                if (child.geometry) {
                    const outlineGeometry = new THREE.EdgesGeometry(child.geometry);
                    const outlineMaterial = new THREE.LineBasicMaterial({ 
                        color: 0x00ff00, 
                        linewidth: 2 
                    });
                    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
                    
                    // Position the outline relative to the group
                    outline.position.copy(child.position);
                    outline.rotation.copy(child.rotation);
                    outline.scale.copy(child.scale);
                    
                    // Add the outline as a child of the group so it moves with it
                    obj.add(outline);
                    outline.userData = { isSelectionOutline: true };
                }
            });
        } else if (obj.geometry) {
            // For individual objects with geometry
            const outlineGeometry = new THREE.EdgesGeometry(obj.geometry);
            const outlineMaterial = new THREE.LineBasicMaterial({ 
                color: 0x00ff00, 
                linewidth: 2 
            });
            const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
            
            // Position the outline to match the object
            outline.position.copy(obj.position);
            outline.rotation.copy(obj.rotation);
            outline.scale.copy(obj.scale);
            
            outline.userData = { isSelectionOutline: true };
            scene.add(outline);
        }
    });
    
    console.log('👆 Selection visuals updated. Selected objects:', selectedObjects.length);
}

// Get descriptive name for an object
function getObjectName(obj) {
    if (trees.includes(obj)) {
        const index = trees.indexOf(obj);
        return `Tree ${index + 1}`;
    } else if (buildings.includes(obj)) {
        const index = buildings.indexOf(obj);
        return `Building ${index + 1}`;
    } else if (stlObjects.includes(obj)) {
        const index = stlObjects.indexOf(obj);
        const fileName = obj.userData.fileName || `STL Object ${index + 1}`;
        return fileName;
    } else if (obj === ground) {
        return 'Ground Plane';
    } else if (obj.userData && obj.userData.type === 'axes') {
        return 'Global Axis';
    } else if (obj instanceof THREE.GridHelper) {
        return 'Grid';
    } else if (obj.type === 'Group') {
        return 'Group Object';
    } else {
        return 'Object';
    }
}

// Handle keyboard events
function onKeyDown(event) {
    // Delete key (keyCode 46 or key 'Delete')
    if (event.key === 'Delete' || event.keyCode === 46) {
        deleteSelectedObjects();
    }
    
    // Undo: Ctrl+Z (Windows) or Cmd+Z (Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        console.log('↩️ Undo keyboard shortcut triggered');
        undo();
    }
    
    // Redo: Ctrl+Y (Windows) or Cmd+Shift+Z (Mac)
    if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.shiftKey && event.key === 'z'))) {
        event.preventDefault();
        console.log('↪️ Redo keyboard shortcut triggered');
        redo();
    }
}

// Delete selected objects
function deleteSelectedObjects() {
    if (selectedObjects.length === 0) {
        console.log('🗑️ No objects selected for deletion');
        return;
    }
    
    console.log('🗑️ Deleting', selectedObjects.length, 'selected objects');
    
    // Save state before deletion
    saveSceneState('Delete Objects');
    
    selectedObjects.forEach(obj => {
        console.log('🗑️ Deleting:', getObjectName(obj));
        
        // Remove from scene
        scene.remove(obj);
        
        // Remove from arrays
        if (trees.includes(obj)) {
            trees = trees.filter(tree => tree !== obj);
        } else if (buildings.includes(obj)) {
            buildings = buildings.filter(building => building !== obj);
        } else if (stlObjects.includes(obj)) {
            stlObjects = stlObjects.filter(stlObj => stlObj !== obj);
        } else if (colliderMeshes.includes(obj)) {
            colliderMeshes = colliderMeshes.filter(mesh => mesh !== obj);
        }
        
        // Special handling for ground
        if (obj === ground) {
        ground = null;
    }
    });
    
    // Clear selection
    clearSelection();
    updateSelectionVisuals();
    
    // Update hierarchy counts
    updateHierarchyCounts();
    
    console.log('🗑️ Deletion complete');
}

// Select object from hierarchy panel
function selectObjectFromHierarchy(obj, event) {
    if (!obj) {
        console.log('❌ No object provided for selection');
        return;
    }
    
    console.log('👆 Selecting object from hierarchy:', getObjectName(obj));
    
    // Check if Ctrl/Cmd is pressed for multi-selection
    const isCtrlPressed = event.ctrlKey || event.metaKey;
    
    if (!isCtrlPressed) {
        // Single selection - clear previous selection
        clearSelection();
        selectedObjects.push(obj);
        console.log('👆 Selected object from hierarchy:', getObjectName(obj));
    } else {
        // Multi-selection - add to existing selection
        if (selectedObjects.includes(obj)) {
            // Remove from selection if already selected
            selectedObjects = selectedObjects.filter(selectedObj => selectedObj !== obj);
            console.log('👆 Removed object from selection:', getObjectName(obj));
        } else {
            // Add to selection
            selectedObjects.push(obj);
            console.log('👆 Added object to selection:', getObjectName(obj));
        }
    }
    
    // Update visual feedback
    updateSelectionVisuals();
    
    // Update hierarchy visual feedback
    updateHierarchySelectionVisuals();
}

// Update visual feedback for selected objects in hierarchy panel
function updateHierarchySelectionVisuals() {
    console.log('🎨 Updating hierarchy selection visuals for', selectedObjects.length, 'selected objects');
    
    // Remove previous selection highlighting from all hierarchy children
    const allHierarchyChildren = document.querySelectorAll('.hierarchy-child');
    allHierarchyChildren.forEach(child => {
        child.classList.remove('selected');
    });
    
    // Add selection highlighting to hierarchy children
    selectedObjects.forEach(obj => {
        console.log('🎨 Processing selected object:', getObjectName(obj));
        // Find the corresponding hierarchy child
        const hierarchyChild = findHierarchyChildForObject(obj);
        if (hierarchyChild) {
            hierarchyChild.classList.add('selected');
            console.log('✅ Added selected class to hierarchy child');
        } else {
            console.log('❌ No hierarchy child found for object');
        }
    });
}

// Find hierarchy child element for a given object
function findHierarchyChildForObject(obj) {
    const allHierarchyChildren = document.querySelectorAll('.hierarchy-child');
    
    for (let child of allHierarchyChildren) {
        const nameElement = child.querySelector('.hierarchy-name');
        if (nameElement) {
            const objectName = getObjectName(obj);
            console.log('🔍 Looking for object:', objectName, 'in hierarchy child:', nameElement.textContent);
            if (nameElement.textContent === objectName) {
                console.log('✅ Found matching hierarchy child for:', objectName);
                return child;
            }
        }
    }
    
    console.log('❌ No hierarchy child found for object:', getObjectName(obj));
    return null;
}

// Toggle visibility for individual objects
function toggleObjectVisibility(obj, toggleBtn) {
    if (!obj) {
        console.log('❌ No object provided for visibility toggle');
        return;
    }
    
    console.log('👁️ Toggling visibility for:', getObjectName(obj));
    
    // Save state before visibility change
    saveSceneState('Toggle Visibility');
    
    // Toggle visibility in the scene
    obj.visible = !obj.visible;
    
    // Update toggle button appearance
    if (obj.visible) {
        toggleBtn.textContent = '👁️';
        toggleBtn.classList.remove('hidden');
    } else {
        toggleBtn.textContent = '👁️‍🗨️';
        toggleBtn.classList.add('hidden');
    }
    
    // Remove from selection if hidden
    if (!obj.visible && selectedObjects.includes(obj)) {
        selectedObjects = selectedObjects.filter(selectedObj => selectedObj !== obj);
        updateSelectionVisuals();
        updateHierarchySelectionVisuals();
    }
    
    console.log('👁️ Visibility toggled for:', getObjectName(obj), 'Visible:', obj.visible);
}

// Toggle visibility for entire categories
function toggleCategoryVisibility(categoryType, toggleBtn) {
    console.log('👁️ Toggling visibility for category:', categoryType);
    
    // Save state before visibility change
    saveSceneState('Toggle Category Visibility');
    
    let objects = [];
    let isVisible = true;
    
    // Get objects for the category
    switch (categoryType) {
        case 'ground':
            objects = [ground];
            isVisible = ground ? ground.visible : true;
            break;
        case 'buildings':
            objects = buildings;
            isVisible = buildings.length > 0 ? buildings[0].visible : true;
            break;
        case 'trees':
            objects = trees;
            isVisible = trees.length > 0 ? trees[0].visible : true;
            break;
        case 'drawings':
            objects = currentDrawing ? [currentDrawing] : [];
            isVisible = currentDrawing ? currentDrawing.visible : true;
            break;
        case 'stl-objects':
            objects = stlObjects;
            isVisible = stlObjects.length > 0 ? stlObjects[0].visible : true;
            break;
    }
    
    // Toggle visibility for all objects in the category
    const newVisibility = !isVisible;
    objects.forEach(obj => {
        if (obj) {
            obj.visible = newVisibility;
        }
    });
    
    // Update toggle button appearance
    if (newVisibility) {
        toggleBtn.textContent = '👁️';
        toggleBtn.classList.remove('hidden');
    } else {
        toggleBtn.textContent = '👁️‍🗨️';
        toggleBtn.classList.add('hidden');
    }
    
    // Remove hidden objects from selection
    if (!newVisibility) {
        selectedObjects = selectedObjects.filter(obj => !objects.includes(obj));
        updateSelectionVisuals();
        updateHierarchySelectionVisuals();
    }
    
    // Update individual toggle buttons in children
    updateCategoryToggleButtons(categoryType, newVisibility);
    
    console.log('👁️ Category visibility toggled for:', categoryType, 'Visible:', newVisibility);
}

// Update individual toggle buttons for a category
function updateCategoryToggleButtons(categoryType, isVisible) {
    const childrenContainer = document.querySelector(`[data-parent="${categoryType}"]`);
    if (childrenContainer) {
        const toggleButtons = childrenContainer.querySelectorAll('.hierarchy-toggle');
        toggleButtons.forEach(btn => {
            if (isVisible) {
                btn.textContent = '👁️';
                btn.classList.remove('hidden');
            } else {
                btn.textContent = '👁️‍🗨️';
                btn.classList.add('hidden');
            }
        });
    }
}

// Undo function
function undo() {
    if (undoStack.length === 0) {
        console.log('❌ Nothing to undo');
        return;
    }
    
    // Save current state to redo stack
    const currentState = {
        action: 'undo',
        timestamp: Date.now(),
        ground: ground ? {
            position: ground.position.clone(),
            rotation: ground.rotation.clone(),
            scale: ground.scale.clone(),
            visible: ground.visible,
            userData: { ...ground.userData }
        } : null,
        buildings: buildings.map(building => ({
            position: building.position.clone(),
            rotation: building.rotation.clone(),
            scale: building.scale.clone(),
            visible: building.visible,
            geometry: {
                width: building.geometry.parameters.width,
                height: building.geometry.parameters.height,
                depth: building.geometry.parameters.depth
            },
            userData: { ...building.userData }
        })),
        trees: trees.map(tree => ({
            position: tree.position.clone(),
            rotation: tree.rotation.clone(),
            scale: tree.scale.clone(),
            visible: tree.visible,
            userData: { ...tree.userData }
        })),
        currentDrawing: currentDrawing ? {
            position: currentDrawing.position.clone(),
            rotation: currentDrawing.rotation.clone(),
            scale: currentDrawing.scale.clone(),
            visible: currentDrawing.visible,
            children: currentDrawing.children.map(child => ({
                position: child.position.clone(),
                rotation: child.rotation.clone(),
                scale: child.scale.clone(),
                visible: child.visible,
                geometry: child.geometry.parameters,
                material: { color: child.material.color.getHexString() }
            }))
        } : null,
        colliderMeshes: colliderMeshes.map(mesh => ({
            position: mesh.position.clone(),
            rotation: mesh.rotation.clone(),
            scale: mesh.scale.clone(),
            visible: mesh.visible,
            userData: { ...mesh.userData }
        }))
    };
    
    redoStack.push(currentState);
    
    // Restore previous state
    const previousState = undoStack.pop();
    restoreSceneState(previousState);
    
    console.log('↩️ Undo completed. Undo stack:', undoStack.length, 'Redo stack:', redoStack.length);
}

// Redo function
function redo() {
    if (redoStack.length === 0) {
        console.log('❌ Nothing to redo');
        return;
    }
    
    // Save current state to undo stack
    const currentState = {
        action: 'redo',
        timestamp: Date.now(),
        ground: ground ? {
            position: ground.position.clone(),
            rotation: ground.rotation.clone(),
            scale: ground.scale.clone(),
            visible: ground.visible,
            userData: { ...ground.userData }
        } : null,
        buildings: buildings.map(building => ({
            position: building.position.clone(),
            rotation: building.rotation.clone(),
            scale: building.scale.clone(),
            visible: building.visible,
            geometry: {
                width: building.geometry.parameters.width,
                height: building.geometry.parameters.height,
                depth: building.geometry.parameters.depth
            },
            userData: { ...building.userData }
        })),
        trees: trees.map(tree => ({
            position: tree.position.clone(),
            rotation: tree.rotation.clone(),
            scale: tree.scale.clone(),
            visible: tree.visible,
            userData: { ...tree.userData }
        })),
        currentDrawing: currentDrawing ? {
            position: currentDrawing.position.clone(),
            rotation: currentDrawing.rotation.clone(),
            scale: currentDrawing.scale.clone(),
            visible: currentDrawing.visible,
            children: currentDrawing.children.map(child => ({
                position: child.position.clone(),
                rotation: child.rotation.clone(),
                scale: child.scale.clone(),
                visible: child.visible,
                geometry: child.geometry.parameters,
                material: { color: child.material.color.getHexString() }
            }))
        } : null,
        colliderMeshes: colliderMeshes.map(mesh => ({
            position: mesh.position.clone(),
            rotation: mesh.rotation.clone(),
            scale: mesh.scale.clone(),
            visible: mesh.visible,
            userData: { ...mesh.userData }
        }))
    };
    
    undoStack.push(currentState);
    
    // Restore next state
    const nextState = redoStack.pop();
    restoreSceneState(nextState);
    
    console.log('↪️ Redo completed. Undo stack:', undoStack.length, 'Redo stack:', redoStack.length);
}

// Import STL file functionality
function importSTLFile() {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.stl';
    fileInput.multiple = false;
    
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            console.log('📁 STL file selected:', file.name);
            
            // Show import parameters dialog
            showSTLImportDialog(file);
        }
    });
    
    // Trigger file selection
    fileInput.click();
}

// Show STL import parameters dialog
function showSTLImportDialog(file) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'stl-import-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    
    // Create import dialog
    const importDialog = document.createElement('div');
    importDialog.style.cssText = `
        background: #2a2a2a;
        border: 1px solid #404040;
        border-radius: 8px;
        padding: 20px;
        min-width: 400px;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;
    
    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 1px solid #404040;
    `;
    
    const title = document.createElement('h2');
    title.textContent = 'STL Import Parameters';
    title.style.cssText = `
        margin: 0;
        color: #e0e0e0;
        font-size: 18px;
        font-weight: 500;
    `;
    
    const fileName = document.createElement('div');
    fileName.textContent = `File: ${file.name}`;
    fileName.style.cssText = `
        color: #c0c0c0;
        font-size: 12px;
        margin-top: 5px;
    `;
    
    header.appendChild(title);
    header.appendChild(fileName);
    
    // Create parameters content
    const content = document.createElement('div');
    content.innerHTML = `
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: #e0e0e0; font-size: 14px;">
                Up Axis:
                <select id="stl-up-axis" style="
                    margin-left: 10px;
                    background: #404040;
                    color: #e0e0e0;
                    border: 1px solid #606060;
                    padding: 4px 8px;
                    border-radius: 4px;
                ">
                    <option value="Y">Y (Default)</option>
                    <option value="Z">Z</option>
                    <option value="X">X</option>
                </select>
            </label>
        </div>
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: #e0e0e0; font-size: 14px;">
                Scale Factor:
                <input type="number" id="stl-scale-factor" value="1.0" min="0.1" max="100" step="0.1" style="
                    margin-left: 10px;
                    background: #404040;
                    color: #e0e0e0;
                    border: 1px solid #606060;
                    padding: 4px 8px;
                    border-radius: 4px;
                    width: 80px;
                ">
            </label>
        </div>
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: #e0e0e0; font-size: 14px;">
                Max Dimension:
                <input type="number" id="stl-max-dimension" value="1" min="1" max="1000" step="1" style="
                    margin-left: 10px;
                    background: #404040;
                    color: #e0e0e0;
                    border: 1px solid #606060;
                    padding: 4px 8px;
                    border-radius: 4px;
                    width: 80px;
                ">
                <span style="color: #c0c0c0; font-size: 12px; margin-left: 5px;">units</span>
            </label>
        </div>
        <div style="margin-bottom: 20px;">
            <label style="display: flex; align-items: center; margin-bottom: 10px; color: #e0e0e0; font-size: 14px;">
                <input type="checkbox" id="stl-center-object" checked style="margin-right: 8px;">
                Center object at scene origin
            </label>
        </div>
        <div style="margin-bottom: 20px;">
            <label style="display: flex; align-items: center; margin-bottom: 10px; color: #e0e0e0; font-size: 14px;">
                <input type="checkbox" id="stl-auto-scale" checked style="margin-right: 8px;">
                Auto-scale to fit scene
            </label>
        </div>
        <div style="text-align: right;">
            <button id="stl-import-cancel" style="
                background: #404040;
                color: #e0e0e0;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                margin-right: 8px;
            ">Cancel</button>
            <button id="stl-import-ok" style="
                background: #0078d4;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            ">Import</button>
        </div>
    `;
    
    importDialog.appendChild(header);
    importDialog.appendChild(content);
    modal.appendChild(importDialog);
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('stl-import-ok').onclick = () => {
        const upAxis = document.getElementById('stl-up-axis').value;
        const scaleFactor = parseFloat(document.getElementById('stl-scale-factor').value);
        const maxDimension = parseFloat(document.getElementById('stl-max-dimension').value);
        const centerObject = document.getElementById('stl-center-object').checked;
        const autoScale = document.getElementById('stl-auto-scale').checked;
        
        document.body.removeChild(modal);
        importSTLFileWithParams(file, { upAxis, scaleFactor, maxDimension, centerObject, autoScale });
    };
    
    document.getElementById('stl-import-cancel').onclick = () => {
        document.body.removeChild(modal);
    };
    
    // Close on escape key
    modal.onkeydown = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
        }
    };
    
    // Close on background click
    modal.onclick = (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
    
    console.log('📋 STL import dialog opened for file:', file.name);
}

// Import STL file with custom parameters
function importSTLFileWithParams(file, params) {
    console.log('📁 Importing STL file with parameters:', params);
    
    // Show loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = loadingOverlay.querySelector('.loading-text');
    loadingText.textContent = 'Analyzing STL file...';
    loadingOverlay.style.display = 'flex';
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            console.log('📄 File loaded, size:', e.target.result.byteLength, 'bytes');
            
            // Create STL loader
            const loader = new THREE.STLLoader();
            const geometry = loader.parse(e.target.result);
            
            console.log('🔧 Geometry created:', geometry);
            console.log('📊 Geometry attributes:', Object.keys(geometry.attributes));
            
            if (!geometry.attributes.position) {
                throw new Error('No position attributes found in STL geometry');
            }
            
            // Analyze and categorize STL objects
            const categorizedObjects = analyzeSTLGeometry(geometry, file.name, params);
            
            // Create objects based on categories
            createCategorizedObjects(categorizedObjects, params);
            
            // Save state after import
            saveSceneState('Import STL');
            
            // Update hierarchy
            updateHierarchyCounts();
            
            console.log('✅ STL file imported successfully:', file.name);
            
            // Focus camera on the entire imported scene
            focusCameraOnImportedScene(categorizedObjects);
            
        } catch (error) {
            console.error('❌ Error loading STL file:', error);
            alert('Error loading STL file: ' + error.message);
        } finally {
            // Hide loading overlay
            loadingOverlay.style.display = 'none';
        }
    };
    
    reader.onerror = () => {
        console.error('❌ Error reading STL file');
        alert('Error reading STL file.');
        loadingOverlay.style.display = 'none';
    };
    
    reader.readAsArrayBuffer(file);
}

// Analyze STL geometry and categorize objects
function analyzeSTLGeometry(geometry, fileName, params) {
    console.log('🔍 Analyzing STL geometry for categorization...');
    
    try {
        // Compute bounding box for analysis
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox;
        const size = boundingBox.getSize(new THREE.Vector3());
        const center = boundingBox.getCenter(new THREE.Vector3());
        
        console.log('📏 Geometry size:', size);
        console.log('📍 Geometry center:', center);
        
        // Analyze geometry characteristics to determine object types
        const categorizedObjects = {
            buildings: [],
            trees: [],
            roads: [],
            highways: [],
            ground: [],
            greenAreas: [],
            other: []
        };
        
        // Get position attributes for analysis
        const positions = geometry.attributes.position.array;
        const vertexCount = positions.length / 3;
        
        console.log('🔢 Total vertices:', vertexCount);
        
        // Analyze height distribution to categorize objects
        const heights = [];
        for (let i = 1; i < positions.length; i += 3) { // Y coordinates
            heights.push(positions[i]);
        }
        
        const minHeight = Math.min(...heights);
        const maxHeight = Math.max(...heights);
        const heightRange = maxHeight - minHeight;
        const avgHeight = heights.reduce((sum, h) => sum + h, 0) / heights.length;
        
        console.log('📊 Height analysis:', { minHeight, maxHeight, heightRange, avgHeight });
        
        // Create object data
        const objectData = {
            geometry: geometry.clone(),
            position: center.clone(),
            size: size.clone(),
            heightRange: heightRange,
            fileName: fileName,
            importParams: params
        };
        
        // Simple categorization based on height and size
        if (heightRange < 1) {
            // Low height objects
            if (size.x > size.z * 2 || size.z > size.x * 2) {
                // Long and narrow - roads or highways
                if (size.x > 50 || size.z > 50) {
                    categorizedObjects.highways.push(objectData);
                } else {
                    categorizedObjects.roads.push(objectData);
                }
            } else if (avgHeight < 0.5) {
                // Very low - ground
                categorizedObjects.ground.push(objectData);
            } else {
                // Low but not ground - green areas
                categorizedObjects.greenAreas.push(objectData);
            }
        } else if (heightRange > 10) {
            // High objects - buildings
            categorizedObjects.buildings.push(objectData);
        } else if (heightRange > 2 && heightRange < 10) {
            // Medium height
            if (size.x < 5 && size.z < 5) {
                // Small footprint - trees
                categorizedObjects.trees.push(objectData);
            } else {
                // Larger footprint - buildings
                categorizedObjects.buildings.push(objectData);
            }
        } else {
            // Other objects
            categorizedObjects.other.push(objectData);
        }
        
        // Log categorization results
        Object.keys(categorizedObjects).forEach(category => {
            if (categorizedObjects[category].length > 0) {
                console.log(`📦 ${category}: ${categorizedObjects[category].length} objects`);
            }
        });
        
        return categorizedObjects;
    } catch (error) {
        console.error('❌ Error analyzing STL geometry:', error);
        // Return simple categorization as fallback
        return {
            buildings: [],
            trees: [],
            roads: [],
            highways: [],
            ground: [],
            greenAreas: [],
            other: [{
                geometry: geometry,
                position: new THREE.Vector3(0, 0, 0),
                size: new THREE.Vector3(1, 1, 1),
                heightRange: 1,
                fileName: fileName,
                importParams: params
            }]
        };
    }
}

// Create categorized objects in the scene
function createCategorizedObjects(categorizedObjects, params) {
    console.log('🏗️ Creating categorized objects in scene...');
    
            // Create buildings
        categorizedObjects.buildings.forEach((buildingData, index) => {
            const material = new THREE.MeshStandardMaterial({
                color: 0x808080,
                roughness: 0.7,
                metalness: 0.2,
                flatShading: true,
                //side: THREE.DoubleSide
            });
            
            const building = new THREE.Mesh(buildingData.geometry, material);
            applySTLTransformations(building, buildingData, params);
            
            building.userData = {
                type: 'collider',
                surfaceType: 'building',
                fileName: buildingData.fileName,
                category: 'building',
                index: index
            };
            
            scene.add(building);
            buildings.push(building);
            stlObjects.push(building); // Add to STL objects array
            colliderMeshes.push(building);
            console.log(`🏢 Created building ${index + 1} and added to stlObjects array`);
        });
    
            // Create trees
        categorizedObjects.trees.forEach((treeData, index) => {
            const material = new THREE.MeshStandardMaterial({
                color: 0x228B22,
                roughness: 0.8,
                metalness: 0.1,
                flatShading: true,
                //side: THREE.DoubleSide
            });
            
            const tree = new THREE.Mesh(treeData.geometry, material);
            applySTLTransformations(tree, treeData, params);
            
            tree.userData = {
                type: 'collider',
                surfaceType: 'tree',
                fileName: treeData.fileName,
                category: 'tree',
                index: index
            };
            
            scene.add(tree);
            trees.push(tree);
            stlObjects.push(tree); // Add to STL objects array
            colliderMeshes.push(tree);
            console.log(`🌳 Created tree ${index + 1} and added to stlObjects array`);
        });
    
            // Create roads
        categorizedObjects.roads.forEach((roadData, index) => {
            const material = new THREE.MeshStandardMaterial({
                color: 0x696969,
                roughness: 0.9,
                metalness: 0.1,
                flatShading: true,
                //side: THREE.DoubleSide
            });
            
            const road = new THREE.Mesh(roadData.geometry, material);
            applySTLTransformations(road, roadData, params);
            
            road.userData = {
                type: 'collider',
                surfaceType: 'road',
                fileName: roadData.fileName,
                category: 'road',
                index: index
            };
            
            scene.add(road);
            stlObjects.push(road); // Add to STL objects array
            colliderMeshes.push(road);
            console.log(`🛣️ Created road ${index + 1} and added to stlObjects array`);
        });
    
            // Create highways
        categorizedObjects.highways.forEach((highwayData, index) => {
            const material = new THREE.MeshStandardMaterial({
                color: 0x2F4F4F,
                roughness: 0.9,
                metalness: 0.1,
                flatShading: true,
                //side: THREE.DoubleSide
            });
            
            const highway = new THREE.Mesh(highwayData.geometry, material);
            applySTLTransformations(highway, highwayData, params);
            
            highway.userData = {
                type: 'collider',
                surfaceType: 'highway',
                fileName: highwayData.fileName,
                category: 'highway',
                index: index
            };
            
            scene.add(highway);
            stlObjects.push(highway); // Add to STL objects array
            colliderMeshes.push(highway);
            console.log(`🛤️ Created highway ${index + 1} and added to stlObjects array`);
        });
    
            // Create ground
        categorizedObjects.ground.forEach((groundData, index) => {
            const material = new THREE.MeshStandardMaterial({
                color: 0x8FBC8F,
                roughness: 0.8,
                metalness: 0.2,
                flatShading: true,
                //side: THREE.DoubleSide
            });
            
            const groundObj = new THREE.Mesh(groundData.geometry, material);
            applySTLTransformations(groundObj, groundData, params);
            
            groundObj.userData = {
                type: 'collider',
                surfaceType: 'ground',
                fileName: groundData.fileName,
                category: 'ground',
                index: index
            };
            
            scene.add(groundObj);
            stlObjects.push(groundObj); // Add to STL objects array
            colliderMeshes.push(groundObj);
            console.log(`🌍 Created ground ${index + 1} and added to stlObjects array`);
        });
    
            // Create green areas
        categorizedObjects.greenAreas.forEach((greenData, index) => {
            const material = new THREE.MeshStandardMaterial({
                color: 0x90EE90,
                roughness: 0.8,
                metalness: 0.1,
                flatShading: true,
                //side: THREE.DoubleSide
            });
            
            const greenArea = new THREE.Mesh(greenData.geometry, material);
            applySTLTransformations(greenArea, greenData, params);
            
            greenArea.userData = {
                type: 'collider',
                surfaceType: 'greenArea',
                category: 'greenArea',
                fileName: greenData.fileName,
                index: index
            };
            
            scene.add(greenArea);
            stlObjects.push(greenArea); // Add to STL objects array
            colliderMeshes.push(greenArea);
            console.log(`🌿 Created green area ${index + 1} and added to stlObjects array`);
        });
    
            // Create other objects
        categorizedObjects.other.forEach((otherData, index) => {
            const material = new THREE.MeshStandardMaterial({
                color: 0xC0C0C0,
                roughness: 0.7,
                metalness: 0.2,
                flatShading: true,
                //side: THREE.DoubleSide
            });
            
            const otherObj = new THREE.Mesh(otherData.geometry, material);
            applySTLTransformations(otherObj, otherData, params);
            
            otherObj.userData = {
                type: 'collider',
                surfaceType: 'other',
                fileName: otherData.fileName,
                category: 'other',
                index: index
            };
            
            scene.add(otherObj);
            stlObjects.push(otherObj); // Add to STL objects array
            colliderMeshes.push(otherObj);
                        console.log(`📦 Created other object ${index + 1} and added to stlObjects array`);
        });
        
        // Log final summary
        console.log('📊 Final STL objects summary:');
        console.log(`  Total STL objects created: ${stlObjects.length}`);
        console.log(`  Buildings: ${categorizedObjects.buildings.length}`);
        console.log(`  Trees: ${categorizedObjects.trees.length}`);
        console.log(`  Roads: ${categorizedObjects.roads.length}`);
        console.log(`  Highways: ${categorizedObjects.highways.length}`);
        console.log(`  Ground: ${categorizedObjects.ground.length}`);
        console.log(`  Green Areas: ${categorizedObjects.greenAreas.length}`);
        console.log(`  Other: ${categorizedObjects.other.length}`);
    }

// Apply STL transformations to objects
function applySTLTransformations(mesh, objectData, params) {
    // Apply scale factor
    if (params.scaleFactor !== 1.0) {
        mesh.scale.setScalar(params.scaleFactor);
    }
    
    // Auto-scale if enabled
    if (params.autoScale) {
        const maxDimension = Math.max(objectData.size.x, objectData.size.y, objectData.size.z);
        const scale = maxDimension > 0 ? params.maxDimension / maxDimension : 1;
        mesh.scale.multiplyScalar(scale);
    }
    
    // Center object if enabled
    if (params.centerObject) {
        mesh.position.copy(objectData.position);
    }
    
    // Apply default rotation (-90, 0, 0)
    mesh.rotation.x = -Math.PI / 2; // -90 degrees on X-axis
    
    // Handle additional up axis conversion if needed
    if (params.upAxis !== 'Y') {
        if (params.upAxis === 'Z') {
            mesh.rotation.x = -Math.PI / 2; // Already applied above
        } else if (params.upAxis === 'X') {
            mesh.rotation.z = Math.PI / 2;
        }
    }
    
    // Add shadows
    mesh.castShadow = true;
    mesh.receiveShadow = true;
}

// Get category icon for hierarchy display
function getCategoryIcon(category) {
    const icons = {
        buildings: '🏢',
        trees: '🌳',
        roads: '🛣️',
        highways: '🛤️',
        ground: '🌍',
        greenAreas: '🌿',
        other: '📦'
    };
    return icons[category] || icons.other;
}

// Get category name for hierarchy display
function getCategoryName(category) {
    const names = {
        buildings: 'Building',
        trees: 'Tree',
        roads: 'Road',
        highways: 'Highway',
        ground: 'Ground',
        greenAreas: 'Green Area',
        other: 'Object'
    };
    return names[category] || names.other;
}

// Focus camera on imported scene
function focusCameraOnImportedScene(categorizedObjects) {
    try {
        // Calculate bounding box of all imported objects
        const boundingBox = new THREE.Box3();
        
        Object.values(categorizedObjects).flat().forEach(objData => {
            if (objData.geometry) {
                const tempGeometry = objData.geometry.clone();
                tempGeometry.computeBoundingBox();
                const tempMesh = new THREE.Mesh(tempGeometry);
                boundingBox.expandByObject(tempMesh);
            }
        });
        
        if (boundingBox.isEmpty()) {
            console.log('📷 No valid objects found for camera focus');
            return;
        }
        
        const objectCenter = boundingBox.getCenter(new THREE.Vector3());
        const objectSize = boundingBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(objectSize.x, objectSize.y, objectSize.z);
        const distance = Math.max(maxDim * 3, 10); // Minimum distance of 10 units
        
        camera.position.set(
            objectCenter.x + distance,
            objectCenter.y + distance,
            objectCenter.z + distance
        );
        camera.lookAt(objectCenter);
        controls.target.copy(objectCenter);
        controls.update();
        
        console.log('📷 Camera focused on imported scene at:', objectCenter);
    } catch (error) {
        console.error('❌ Error focusing camera on imported scene:', error);
        // Fallback to default camera position
        camera.position.set(0, 80, -140);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
    }
}

// Update all toggle button states based on current object visibility
function updateToggleButtonStates() {
    // Update category toggle buttons
    const categoryItems = document.querySelectorAll('.hierarchy-item');
    categoryItems.forEach(item => {
        const categoryType = item.getAttribute('data-type');
        const toggleBtn = item.querySelector('.hierarchy-toggle');
        
        if (toggleBtn) {
            let isVisible = true;
            
            switch (categoryType) {
                case 'ground':
                    isVisible = ground ? ground.visible : true;
                    break;
                case 'buildings':
                    isVisible = buildings.length > 0 ? buildings[0].visible : true;
                    break;
                case 'trees':
                    isVisible = trees.length > 0 ? trees[0].visible : true;
                    break;
                case 'drawings':
                    isVisible = currentDrawing ? currentDrawing.visible : true;
                    break;
                case 'stl-objects':
                    isVisible = stlObjects.length > 0 ? stlObjects[0].visible : true;
                    break;
            }
            
            if (isVisible) {
                toggleBtn.textContent = '👁️';
                toggleBtn.classList.remove('hidden');
            } else {
                toggleBtn.textContent = '👁️‍🗨️';
                toggleBtn.classList.add('hidden');
            }
        }
    });
    
    // Update individual object toggle buttons
    const allHierarchyChildren = document.querySelectorAll('.hierarchy-child');
    allHierarchyChildren.forEach(child => {
        const toggleBtn = child.querySelector('.hierarchy-toggle');
        const nameElement = child.querySelector('.hierarchy-name');
        
        if (toggleBtn && nameElement) {
            const objectName = nameElement.textContent;
            let obj = null;
            
            // Find the corresponding object
            if (objectName === 'Ground Plane') {
                obj = ground;
            } else if (objectName.startsWith('Building ')) {
                const index = parseInt(objectName.split(' ')[1]) - 1;
                obj = buildings[index];
            } else if (objectName.startsWith('Tree ')) {
                const index = parseInt(objectName.split(' ')[1]) - 1;
                obj = trees[index];
            } else if (objectName === 'Drawing 1') {
                obj = currentDrawing;
            }
            
            if (obj) {
                if (obj.visible) {
                    toggleBtn.textContent = '👁️';
                    toggleBtn.classList.remove('hidden');
                } else {
                    toggleBtn.textContent = '👁️‍🗨️';
                    toggleBtn.classList.add('hidden');
                }
            }
        }
    });
}

 