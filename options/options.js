// Standard Firefox zoom levels
const ZOOM_LEVELS = [30, 50, 67, 80, 90, 100, 110, 120, 133, 150, 170, 200, 240, 300, 400, 500];

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Update storage statistics display
function updateStorageStats() {
    const statsElement = document.getElementById('storageStats');
    statsElement.innerHTML = '<p>Loading storage statistics...</p>';
    
    // Directly access dbUtils
    if (window.dbUtils) {
        // We have direct access to dbUtils
        window.dbUtils.getDatabaseMetrics().then((metrics) => {
            statsElement.innerHTML = `
                <p>Currently storing zoom settings for <b>${formatNumber(metrics.totalEntries)}</b> URLs</p>
                <p>Covering <b>${formatNumber(metrics.uniqueHosts)}</b> unique websites</p>
                <p>Used <b>${formatNumber(metrics.recentEntries)}</b> settings in the last 7 days</p>
                <p>Estimated storage used: <b>${metrics.estimatedSize}</b></p>
            `;
        }).catch(error => {
            statsElement.innerHTML = '<p>Error loading statistics. Please try again.</p>';
            console.error("Error getting database metrics:", error);
        });
    } else {
        // Fall back to message passing
        browser.runtime.sendMessage({ action: "getDatabaseMetrics" }).then((metrics) => {
            if (metrics) {
                statsElement.innerHTML = `
                    <p>Currently storing zoom settings for <b>${formatNumber(metrics.totalEntries)}</b> URLs</p>
                    <p>Covering <b>${formatNumber(metrics.uniqueHosts)}</b> unique websites</p>
                    <p>Used <b>${formatNumber(metrics.recentEntries)}</b> settings in the last 7 days</p>
                    <p>Estimated storage used: <b>${metrics.estimatedSize}</b></p>
                `;
            }
        }).catch(error => {
            statsElement.innerHTML = '<p>Error loading statistics. Please try again.</p>';
            console.error("Error getting database metrics:", error);
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Update zoom value display and snap to nearest valid zoom level
    const zoomSlider = document.getElementById('defaultZoom');
    const zoomValue = document.getElementById('zoomValue');
    
    zoomSlider.addEventListener('input', function() {
        // Find the nearest valid zoom level
        const currentValue = parseInt(this.value);
        const nearestZoom = ZOOM_LEVELS.reduce((prev, curr) => 
            Math.abs(curr - currentValue) < Math.abs(prev - currentValue) ? curr : prev
        );
        
        this.value = nearestZoom;
        zoomValue.textContent = nearestZoom + '%';
    });
    
    // Load existing settings
    browser.storage.sync.get({
        debugMode: false,
        defaultZoom: 100,
        includePath: true,
        includeQuery: false,
        includeFragment: false,
        storageLimit: 10000,
        purgePercentage: 10
    }).then((items) => {
        // Debug mode
        document.getElementById('debugMode').checked = items.debugMode;
        
        // Default zoom
        document.getElementById('defaultZoom').value = items.defaultZoom;
        zoomValue.textContent = items.defaultZoom + '%';
        
        // URL component toggles
        document.getElementById('includePath').checked = items.includePath;
        document.getElementById('includeQuery').checked = items.includeQuery;
        document.getElementById('includeFragment').checked = items.includeFragment;
        
        // Storage settings
        if (document.getElementById('storageLimit')) {
            document.getElementById('storageLimit').value = items.storageLimit;
            document.getElementById('storageLimitValue').textContent = formatNumber(items.storageLimit) + ' URLs';
        }
        
        if (document.getElementById('purgePercentage')) {
            document.getElementById('purgePercentage').value = items.purgePercentage;
            document.getElementById('purgePercentageValue').textContent = items.purgePercentage + '%';
        }
        
        // Load and display current storage statistics
        updateStorageStats();
    });
    
    // Save debug mode setting when changed
    document.getElementById('debugMode').addEventListener('change', function() {
        browser.storage.sync.set({
            debugMode: this.checked
        });
    });
    
    // Save default zoom when changed
    document.getElementById('defaultZoom').addEventListener('change', function() {
        browser.storage.sync.set({
            defaultZoom: parseInt(this.value)
        });
    });
    
    // Save URL component settings when changed
    function saveComponentSettings() {
        browser.storage.sync.set({
            includePath: document.getElementById('includePath').checked,
            includeQuery: document.getElementById('includeQuery').checked,
            includeFragment: document.getElementById('includeFragment').checked
        });
    }
    
    document.getElementById('includePath').addEventListener('change', saveComponentSettings);
    document.getElementById('includeQuery').addEventListener('change', saveComponentSettings);
    document.getElementById('includeFragment').addEventListener('change', saveComponentSettings);
    
    // Storage limit settings - check if elements exist before adding listeners
    if (document.getElementById('storageLimit')) {
        // Save storage limit when changed
        document.getElementById('storageLimit').addEventListener('input', function() {
            document.getElementById('storageLimitValue').textContent = formatNumber(this.value) + ' URLs';
        });

        document.getElementById('storageLimit').addEventListener('change', function() {
            browser.storage.sync.set({
                storageLimit: parseInt(this.value)
            }).then(() => {
                // Check if we need to purge after changing the limit
                browser.runtime.sendMessage({ action: "checkStorageLimit" });
            });
        });
    }
    
    if (document.getElementById('purgePercentage')) {
        // Save purge percentage when changed
        document.getElementById('purgePercentage').addEventListener('input', function() {
            document.getElementById('purgePercentageValue').textContent = this.value + '%';
        });

        document.getElementById('purgePercentage').addEventListener('change', function() {
            browser.storage.sync.set({
                purgePercentage: parseInt(this.value)
            });
        });
    }
    
    // Handle refresh stats button if it exists
    if (document.getElementById('refreshStats')) {
        document.getElementById('refreshStats').addEventListener('click', function() {
            this.textContent = 'Refreshing...';
            this.disabled = true;
            
            updateStorageStats();
            
            // Re-enable button after a brief delay
            setTimeout(() => {
                this.textContent = 'Refresh Stats';
                this.disabled = false;
            }, 1500);
        });
    }

    // Handle purge buttons if they exist
    if (document.getElementById('purgeNow')) {
        document.getElementById('purgeNow').addEventListener('click', function() {
            if (confirm('Are you sure you want to purge the oldest zoom settings?')) {
                browser.runtime.sendMessage({ action: "purgeOldEntries" }).then(() => {
                    updateStorageStats();
                });
            }
        });
    }
    
    if (document.getElementById('purgeAll')) {
        document.getElementById('purgeAll').addEventListener('click', function() {
            if (confirm('Are you sure you want to clear ALL zoom settings? This cannot be undone.')) {
                browser.runtime.sendMessage({ action: "clearAllEntries" }).then(() => {
                    updateStorageStats();
                });
            }
        });
    }
    
    // Initialize Tabulator table
    let urlTable = null;
    
    // Format timestamp for display in ISO8601 format
    function formatTimestamp(timestamp) {
        // Use Luxon DateTime for proper formatting
        const dt = luxon.DateTime.fromMillis(timestamp);
        return dt.toFormat('yyyy-MM-dd HH:mm:ss');
    }
    
    // Format URL components based on componentMask
    function formatUrlFromComponents(rowData) {
        let url = rowData.host;
        
        // Check componentMask to determine which parts to include
        // Assuming componentMask follows the pattern from url-utils.js
        if (rowData.componentMask) {
            // Include path if bit is set and path exists
            if ((rowData.componentMask & 1) && rowData.path && rowData.path !== '/') {
                url += rowData.path;
            }
            // Include query if bit is set and query exists
            if ((rowData.componentMask & 2) && rowData.query) {
                url += '?' + rowData.query;
            }
            // Include fragment if bit is set and fragment exists
            if ((rowData.componentMask & 4) && rowData.fragment) {
                url += '#' + rowData.fragment;
            }
        } else {
            // Fallback: include everything that exists
            if (rowData.path && rowData.path !== '/') {
                url += rowData.path;
            }
            if (rowData.query) {
                url += '?' + rowData.query;
            }
            if (rowData.fragment) {
                url += '#' + rowData.fragment;
            }
        }
        
        return url;
    }
    
    // Initialize the URL table
    function initUrlTable() {
        urlTable = new Tabulator("#urlTable", {
            height: "400px",
            layout: "fitColumns",
            placeholder: "No URL settings found",
            columns: [
                {
                    title: "URL", 
                    field: "fullUrl", 
                    sorter: "string",
                    headerFilter: "input",
                    headerFilterPlaceholder: "Filter URLs...",
                    mutator: function(value, data, type, params) {
                        // Use mutator to reconstruct URL based on componentMask
                        return formatUrlFromComponents(data);
                    }
                },
                {
                    title: "Zoom Level", 
                    field: "zoomLevel", 
                    sorter: "number",
                    width: 120,
                    formatter: function(cell, formatterParams) {
                        // Convert decimal zoom (like 1.7) to percentage (170%)
                        const zoom = cell.getValue();
                        const percentage = Math.round(zoom * 100);
                        return percentage + '%';
                    },
                    editor: "input",
                    validator: ["numeric", "min:30", "max:500"],
                    mutator: function(value, data, type, params) {
                        // Ensure we're working with the raw decimal value
                        return data.zoomLevel;
                    }
                },
                {
                    title: "Last Used", 
                    field: "timestamp", 
                    sorter: "number",
                    width: 180,
                    formatter: function(cell, formatterParams) {
                        return formatTimestamp(cell.getValue());
                    }
                },
                {
                    title: "Actions", 
                    field: "actions",
                    width: 100,
                    headerSort: false,
                    formatter: function(cell, formatterParams) {
                        return '<button class="delete-btn">Delete</button>';
                    },
                    cellClick: function(e, cell) {
                        if (e.target.classList.contains('delete-btn')) {
                            const id = cell.getRow().getData().id;
                            deleteUrlSetting(id);
                        }
                    }
                }
            ],
            cellEdited: function(cell) {
                const rowData = cell.getRow().getData();
                if (cell.getField() === "zoomLevel") {
                    // Convert percentage back to decimal for storage
                    const percentageValue = parseInt(cell.getValue());
                    const decimalValue = percentageValue / 100;
                    updateZoomSetting(rowData.id, decimalValue);
                }
            }
        });
        
        loadTableData();
    }
    
    // Load data from IndexedDB into the table
    function loadTableData() {
        if (window.dbUtils) {
            window.dbUtils.getAllZoomSettings().then((settings) => {
                urlTable.setData(settings);
                updateTableInfo(settings.length, settings.length);
            }).catch(error => {
                console.error("Error loading table data:", error);
                urlTable.setData([]);
                updateTableInfo(0, 0);
            });
        } else {
            // Fallback to message passing
            browser.runtime.sendMessage({ action: "getAllZoomSettings" }).then((settings) => {
                if (settings) {
                    urlTable.setData(settings);
                    updateTableInfo(settings.length, settings.length);
                }
            }).catch(error => {
                console.error("Error loading table data:", error);
                urlTable.setData([]);
                updateTableInfo(0, 0);
            });
        }
    }
    
    // Update table info display
    function updateTableInfo(visibleCount, totalCount = null) {
        const infoElement = document.getElementById('tableInfo');
        
        if (totalCount === null) {
            totalCount = urlTable.getDataCount();
        }
        
        if (visibleCount === totalCount) {
            // No filter applied, show simple count
            infoElement.textContent = totalCount + ' entries';
        } else {
            // Filter applied, show filtered vs total
            infoElement.textContent = visibleCount + ' found (' + totalCount + ' total)';
        }
    }
    
    // Delete a URL setting
    window.deleteUrlSetting = function(id) {
        if (confirm('Are you sure you want to delete this URL setting?')) {
            if (window.dbUtils) {
                window.dbUtils.removeZoomSetting(id).then(() => {
                    loadTableData();
                    updateStorageStats();
                }).catch(error => {
                    console.error("Error deleting setting:", error);
                    alert('Error deleting setting');
                });
            } else {
                browser.runtime.sendMessage({ action: "removeZoomSetting", id: id }).then(() => {
                    loadTableData();
                    updateStorageStats();
                }).catch(error => {
                    console.error("Error deleting setting:", error);
                    alert('Error deleting setting');
                });
            }
        }
    };
    
    // Update a zoom setting
    function updateZoomSetting(id, newZoom) {
        // This would require extending the db-utils to support partial updates
        // For now, we'll reload the data to reflect any changes
        loadTableData();
    }
    
    // Initialize the table
    initUrlTable();
    
    // Update table info when filters change
    urlTable.on("dataFiltered", function(filters, rows) {
        const totalCount = urlTable.getDataCount();
        updateTableInfo(rows.length, totalCount);
    });
    
    // Refresh table button
    document.getElementById('refreshTable').addEventListener('click', function() {
        loadTableData();
    });
    
    // Updated button handlers
    document.getElementById('clearAll').addEventListener('click', function() {
        if (confirm('Are you sure you want to clear ALL zoom settings? This cannot be undone.')) {
            if (window.dbUtils) {
                window.dbUtils.clearAllZoomSettings().then(() => {
                    loadTableData();
                    updateStorageStats();
                }).catch(error => {
                    console.error("Error clearing all settings:", error);
                    alert('Error clearing settings');
                });
            } else {
                browser.runtime.sendMessage({ action: "clearAllEntries" }).then(() => {
                    loadTableData();
                    updateStorageStats();
                }).catch(error => {
                    console.error("Error clearing all settings:", error);
                    alert('Error clearing settings');
                });
            }
        }
    });
    
    document.getElementById('export').addEventListener('click', function() {
        if (window.dbUtils) {
            window.dbUtils.getAllZoomSettings().then((settings) => {
                const dataStr = JSON.stringify(settings, null, 2);
                const dataBlob = new Blob([dataStr], {type: 'application/json'});
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'zoomer-settings-' + new Date().toISOString().split('T')[0] + '.json';
                link.click();
                URL.revokeObjectURL(url);
            }).catch(error => {
                console.error("Error exporting settings:", error);
                alert('Error exporting settings');
            });
        } else {
            browser.runtime.sendMessage({ action: "getAllZoomSettings" }).then((settings) => {
                if (settings) {
                    const dataStr = JSON.stringify(settings, null, 2);
                    const dataBlob = new Blob([dataStr], {type: 'application/json'});
                    const url = URL.createObjectURL(dataBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'zoomer-settings-' + new Date().toISOString().split('T')[0] + '.json';
                    link.click();
                    URL.revokeObjectURL(url);
                }
            }).catch(error => {
                console.error("Error exporting settings:", error);
                alert('Error exporting settings');
            });
        }
    });
    
    document.getElementById('import').addEventListener('click', function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const settings = JSON.parse(e.target.result);
                        if (Array.isArray(settings) && confirm('Import ' + settings.length + ' settings? This will not overwrite existing settings.')) {
                            // Import each setting individually
                            let importCount = 0;
                            settings.forEach(setting => {
                                // Remove the ID so it gets a new one
                                delete setting.id;
                                if (window.dbUtils) {
                                    window.dbUtils.storeZoomSetting(setting).then(() => {
                                        importCount++;
                                        if (importCount === settings.length) {
                                            loadTableData();
                                            updateStorageStats();
                                            alert('Successfully imported ' + importCount + ' settings');
                                        }
                                    }).catch(error => {
                                        console.error("Error importing setting:", error);
                                    });
                                }
                            });
                        }
                    } catch (error) {
                        alert('Error parsing JSON file: ' + error.message);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    });
    
    // Refresh stats when options page is opened
    updateStorageStats();
    
    console.log('Options page loaded');
});