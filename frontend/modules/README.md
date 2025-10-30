# Frontend Modules Documentation

This directory contains the modularized frontend components of the EcoTwinAI application. Each module is responsible for a specific functionality and can be edited independently without affecting other modules.

## Module Structure

### 1. `utils.js` - Utilities Module
**Purpose**: Contains helper functions and common utilities used across different modules.

**Key Functions**:
- `getHeightProperty()` - Find height property with different spellings
- `calculateEnergyStats()` - Calculate energy statistics from features
- `throttle()` - Throttle function to limit function calls
- `validateDate()` - Validate date values for sun calculation
- `generateId()` - Generate unique ID
- `deepClone()` - Deep clone an object
- `isValidNumber()` - Check if a value is a valid number
- `feetToMeters()` / `metersToFeet()` - Unit conversion functions

### 2. `core.js` - Core Module
**Purpose**: Handles Mapbox configuration, map setup, and core application initialization.

**Key Functions**:
- `loadMapboxConfig()` - Load Mapbox configuration from backend
- `showErrorMessage()` - Show error message when map fails to load
- `initialize()` - Initialize the core application
- `getMap()` - Get the map instance
- `isReady()` - Check if core module is initialized

### 3. `data.js` - Data Module
**Purpose**: Manages GeoJSON data, building data, and tree data.

**Key Functions**:
- `addGeoJsonToMap()` - Add GeoJSON data to the map
- `updateBuildingColors()` - Update building colors based on energy statistics
- `placeTree()` - Place a tree at the specified location
- `deleteTreesAtPoint()` - Delete trees at the specified point
- `reset()` - Reset all data
- `saveData()` - Save current data as GeoJSON
- `updateBuildingFeature()` - Update a building feature

### 4. `tree.js` - Tree Module
**Purpose**: Handles tree simulation, creation, deletion, and interaction.

**Key Functions**:
- `setTreeMode()` - Set tree mode (multi, erase, or null)
- `updateTreeButtons()` - Update tree button states
- `setupEventListeners()` - Setup event listeners for tree functionality
- `setupMapLayers()` - Setup map layers for trees
- `getCurrentTreeMode()` - Get current tree mode
- `resetTreeMode()` - Reset tree mode

### 5. `sun.js` - Sun Module
**Purpose**: Manages sun simulation and lighting effects.

**Key Functions**:
- `setupEventListeners()` - Setup event listeners for sun simulation controls
- `syncInputs()` - Sync slider and input controls
- `updateSunPosition()` - Update sun position and lighting
- `getCurrentValues()` - Get current sun simulation values
- `setValues()` - Set sun simulation values
- `resetToCurrentTime()` - Reset sun simulation to current time

### 6. `ui.js` - UI Module
**Purpose**: Handles user interface, building property editing, and file operations.

**Key Functions**:
- `setupEventListeners()` - Setup event listeners for UI functionality
- `setupMapLayers()` - Setup map layers for buildings
- `showBuildingProperties()` - Show building properties popup
- `setupPropertyEditor()` - Setup property editor functionality
- `showNotification()` - Show notification message

## Module Dependencies

```
utils.js (no dependencies)
    ↑
core.js (depends on utils.js)
    ↑
data.js (depends on core.js, utils.js)
    ↑
tree.js (depends on core.js, data.js)
    ↑
sun.js (depends on core.js, utils.js)
    ↑
ui.js (depends on core.js, data.js, tree.js)
    ↑
script.js (main application coordinator)
```

## Usage

Each module is loaded in the correct order in `index.html`:

```html
<script src="modules/utils.js"></script>
<script src="modules/core.js"></script>
<script src="modules/data.js"></script>
<script src="modules/tree.js"></script>
<script src="modules/sun.js"></script>
<script src="modules/ui.js"></script>
<script src="script.js"></script>
```

## Benefits of Modular Structure

1. **Separation of Concerns**: Each module has a single responsibility
2. **Independent Editing**: Modules can be edited without affecting others
3. **Easy Maintenance**: Clear structure makes debugging and updates easier
4. **Reusability**: Modules can be reused in other projects
5. **Testing**: Each module can be tested independently
6. **Scalability**: New features can be added as new modules

## Adding New Modules

To add a new module:

1. Create a new JavaScript file in the `modules/` directory
2. Follow the class-based structure used by other modules
3. Add the script tag to `index.html` in the correct dependency order
4. Initialize the module in `script.js`
5. Update this README with module documentation

## Module Communication

Modules communicate through:
- Constructor injection (passing dependencies)
- Public methods (calling methods on other modules)
- Event system (for loose coupling when needed)

## Error Handling

Each module should handle its own errors and provide meaningful error messages. The core module provides a centralized error display mechanism that other modules can use.

## Performance Considerations

- Modules are loaded in order, so dependencies must be loaded first
- Each module should only initialize what it needs
- Event listeners should be properly cleaned up when modules are destroyed
- Heavy operations should be throttled or debounced as needed
