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
    
    // Existing button handlers
    document.getElementById('clearAll').addEventListener('click', function() {
        alert('Clear all URLs - Not implemented yet');
    });
    
    document.getElementById('export').addEventListener('click', function() {
        alert('Export list - Not implemented yet');
    });
    
    document.getElementById('import').addEventListener('click', function() {
        alert('Import list - Not implemented yet');
    });
    
    // Refresh stats when options page is opened
    updateStorageStats();
    
    console.log('Options page loaded');
});