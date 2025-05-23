//------------------------------------------------------------------------------
// Utility Functions
//------------------------------------------------------------------------------

/**
 * Debug logging function that only outputs when debug mode is enabled
 * @param {...any} args - Arguments to log to console
 */
function debugLog(...args) {
    browser.storage.sync.get({ debugMode: false }).then((settings) => {
        if (settings.debugMode) {
            console.log(...args);
        }
    });
}

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------

const SPECIFICITY_SCORES = {
    HOST: 1,        // Base score for host match
    PATH: 10,       // Score for path match
    QUERY: 100,     // Score for query parameters match
    FRAGMENT: 1000  // Score for fragment match
};

//------------------------------------------------------------------------------
// Storage Functions
//------------------------------------------------------------------------------

/**
 * Store a zoom setting for the current URL
 * @param {string} url - The URL to store zoom setting for
 * @param {number} zoomLevel - The zoom level to store (decimal, e.g., 1.5 for 150%)
 * @returns {Promise<number|null>} - The ID of the stored record, or null on error
 */
async function storeZoomForURL(url, zoomLevel) {
    try {
        // Parse the URL into components
        const urlData = await urlUtils.createURLData(url);
        if (!urlData) {
            console.error("Failed to parse URL for zoom storage:", url);
            return;
        }
        
        debugLog("Storing zoom setting for:", url);
        debugLog("  Zoom level:", zoomLevel);
        debugLog("  User standardized URL:", urlData.userStandardized);
        
        // Create the database entry
        const zoomEntry = {
            host: urlData.urlParts.host,
            path: urlData.urlParts.path,
            query: urlData.urlParts.query,
            fragment: urlData.urlParts.fragment,
            componentMask: urlData.userBitmask,
            zoomLevel: zoomLevel,
            // timestamp will be added by storeZoomSetting
        };
        
        // Store the zoom setting
        const recordId = await dbUtils.storeZoomSetting(zoomEntry);
        debugLog("  Stored with ID:", recordId);
        
        // Check if we need to purge due to limit
        // Using setTimeout to avoid blocking the storage operation
        setTimeout(() => {
            dbUtils.checkAndEnforceStorageLimit().catch(error => {
                console.error("Error checking storage limit:", error);
            });
        }, 100);
        
        return recordId;
        
    } catch (error) {
        console.error("Error storing zoom setting:", error);
    }
}

// Find the best zoom setting for a URL using progressive specificity matching
async function findZoomForURL(url) {
    try {
        // Parse the URL into components
        const urlData = await urlUtils.createURLData(url);
        if (!urlData) {
            debugLog("Failed to parse URL for zoom lookup:", url);
            return null;
        }
        
        debugLog("Looking up zoom for:", url);
        debugLog("  Host:", urlData.urlParts.host);
        
        // Get all records for this host
        const hostRecords = await dbUtils.findZoomSettingsByHost(urlData.urlParts.host);
        
        debugLog("  Found", hostRecords.length, "records for host");
        
        if (hostRecords.length === 0) {
            debugLog("  No zoom settings found for this host");
            return null;
        }
        
        // Find the best match using progressive specificity
        let bestMatch = null;
        let bestSpecificity = -1;
        
        for (const record of hostRecords) {
            let specificity = calculateSpecificity(record);
            
            if (matchesURL(record, urlData.urlParts) && specificity > bestSpecificity) {
                bestMatch = record;
                bestSpecificity = specificity;
            }
        }
        
        if (bestMatch) {
            debugLog("  Best match found:", bestMatch);
            debugLog("    Zoom level:", bestMatch.zoomLevel);
            debugLog("    Specificity:", bestSpecificity);
            
            // Update timestamp asynchronously (don't wait for it)
            dbUtils.updateTimestamp(bestMatch.id).catch(error => {
                console.error("Error updating timestamp:", error);
            });
            
            return bestMatch.zoomLevel;
        } else {
            debugLog("  No matching zoom setting found");
            return null;
        }
        
    } catch (error) {
        console.error("Error finding zoom for URL:", error);
        return null;
    }
}

/**
 * Calculate specificity score for a record (higher = more specific)
 * Scoring system:
 * - Host: 1 point (base score)
 * - Path: 10 points
 * - Query: 100 points
 * - Fragment: 1000 points
 * @param {Object} record - The zoom setting record to calculate specificity for
 * @returns {number} - The specificity score
 */
function calculateSpecificity(record) {
    let specificity = 0;
    
    // Host gets base score
    specificity += SPECIFICITY_SCORES.HOST;
    
    // Add score for each component
    if (record.componentMask & urlUtils.COMPONENT_PATH && record.path !== '/') {
        specificity += SPECIFICITY_SCORES.PATH;
    }
    if (record.componentMask & urlUtils.COMPONENT_QUERY && record.query) {
        specificity += SPECIFICITY_SCORES.QUERY;
    }
    if (record.componentMask & urlUtils.COMPONENT_FRAGMENT && record.fragment) {
        specificity += SPECIFICITY_SCORES.FRAGMENT;
    }
    
    return specificity;
}

/**
 * Check if a record matches the current URL components based on component mask
 * @param {Object} record - The zoom setting record to check
 * @param {Object} urlParts - The parsed URL components to match against
 * @returns {boolean} - True if the record matches the URL components
 */
function matchesURL(record, urlParts) {
    // Host must always match (this should already be filtered by the DB query)
    if (record.host !== urlParts.host) {
        return false;
    }
    
    // Check path if it's included in the mask
    if (record.componentMask & urlUtils.COMPONENT_PATH) {
        if (record.path !== urlParts.path) {
            return false;
        }
    }
    
    // Check query if it's included in the mask
    if (record.componentMask & urlUtils.COMPONENT_QUERY) {
        if (record.query !== urlParts.query) {
            return false;
        }
    }
    
    // Check fragment if it's included in the mask
    if (record.componentMask & urlUtils.COMPONENT_FRAGMENT) {
        if (record.fragment !== urlParts.fragment) {
            return false;
        }
    }
    
    return true;
}

/**
 * Apply zoom level to a specific tab
 * @param {number} tabId - The ID of the tab to apply zoom to
 * @param {number} zoomLevel - The zoom level to apply (decimal, e.g., 1.5 for 150%)
 * @param {string} [reason=""] - Optional reason for logging
 * @returns {Promise<boolean>} - True if zoom was applied successfully
 */
async function applyZoomToTab(tabId, zoomLevel, reason = "") {
    try {
        await browser.tabs.setZoom(tabId, zoomLevel);
        debugLog(`Applied zoom ${zoomLevel * 100}% to tab ${tabId} ${reason}`);
        return true;
    } catch (error) {
        console.error("Error applying zoom:", error);
        return false;
    }
}

/**
 * Check for stored zoom setting and apply it to a tab
 * @param {number} tabId - The ID of the tab to apply zoom to
 * @param {string} url - The URL to find zoom setting for
 * @returns {Promise<void>}
 */
async function checkAndApplyZoom(tabId, url) {
    // Look for stored zoom setting
    const storedZoom = await findZoomForURL(url);
    
    if (storedZoom !== null) {
        debugLog("Applying stored zoom:", storedZoom * 100 + "%");
        await applyZoomToTab(tabId, storedZoom, "(from stored setting)");
    } else {
        debugLog("No stored zoom found, keeping current zoom");
    }
}

/**
 * Test and log URL handling with all specificity levels
 * Useful for debugging and understanding URL component matching
 * @param {string} url - The URL to analyze
 * @returns {Promise<void>}
 */
async function testEnhancedURLHandling(url) {
    const urlData = await urlUtils.createURLData(url);
    if (!urlData) return;
    
    debugLog("Enhanced URL Handling for:", url);
    debugLog("  Normalized components:");
    debugLog("    Host:", urlData.urlParts.host);
    debugLog("    Path:", urlData.urlParts.path);
    debugLog("    Query:", urlData.urlParts.query);
    debugLog("    Fragment:", urlData.urlParts.fragment);
    
    debugLog("  User's standardized URL:", urlData.userStandardized);
    debugLog("  User's bitmask:", urlData.userBitmask);
    
    debugLog("  All specificity levels available:");
    urlData.specificityLevels.forEach((level, index) => {
        debugLog(`    ${index + 1}. ${level.description}: ${level.url}`);
    });
    
    debugLog("---");
}

//------------------------------------------------------------------------------
// Event Listeners
//------------------------------------------------------------------------------

/**
 * Handle navigation events to detect URL changes
 * Applies stored zoom settings when a page loads
 */
browser.webNavigation.onCommitted.addListener((details) => {
    // We only care about top-level frame navigations (not iframes)
    if (details.frameId === 0) {
        debugLog("Navigation committed to:", details.url);
        
        // Get tab information
        browser.tabs.get(details.tabId).then(async (tab) => {
            // Ignore URLs like about:blank, about:newtab, etc.
            if (tab.url.startsWith("http")) {
                debugLog("Processing navigation for tab:", tab.id, tab.url);
                
                // Test enhanced URL parsing and normalization
                testEnhancedURLHandling(tab.url);
                
                // Check and apply stored zoom setting
                await checkAndApplyZoom(details.tabId, tab.url);
                
                // Get the current zoom level for this tab (after our changes)
                browser.tabs.getZoom(details.tabId).then((zoomFactor) => {
                    debugLog("Final zoom factor:", zoomFactor, "(" + (zoomFactor * 100) + "%)");
                }).catch((error) => {
                    console.error("Error getting zoom factor:", error);
                });
            }
        }).catch((error) => {
            console.error("Error getting tab information:", error);
        });
    }
});

// Additional listener for SPA URL changes
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only react if the URL changed and it's not a full navigation
    if (changeInfo.url && tab.url.startsWith("http")) {
        debugLog("SPA URL change detected:", changeInfo.url);
        debugLog("Processing SPA navigation for tab:", tabId, tab.url);
        
        // Test enhanced URL parsing and normalization
        testEnhancedURLHandling(tab.url);
        
        // Check and apply stored zoom setting
        await checkAndApplyZoom(tabId, tab.url);
        
        // Get the current zoom level for this tab (after our changes)
        browser.tabs.getZoom(tabId).then((zoomFactor) => {
            debugLog("Final zoom factor for SPA:", zoomFactor, "(" + (zoomFactor * 100) + "%)");
        }).catch((error) => {
            console.error("Error getting zoom factor for SPA:", error);
        });
    }
});

// Listen for zoom change events and store or remove them
browser.tabs.onZoomChange.addListener((zoomChangeInfo) => {
    const { tabId, oldZoomFactor, newZoomFactor } = zoomChangeInfo;
    
    // Get tab information to log the URL with the zoom change
    browser.tabs.get(tabId).then(async (tab) => {
        // Only process http(s) URLs
        if (tab.url.startsWith("http")) {
            debugLog("Zoom changed for tab:", tabId);
            debugLog("URL:", tab.url);
            debugLog(`Zoom changed from ${oldZoomFactor * 100}% to ${newZoomFactor * 100}%`);
            
            // Test enhanced URL parsing when zoom changes
            testEnhancedURLHandling(tab.url);
            
            // Check if this is a user-initiated zoom change
            // For now, we'll assume all zoom changes are user-initiated
            const isUserInitiated = true;
            
            if (isUserInitiated) {
                // Get the default zoom level from settings
                const settings = await browser.storage.sync.get({ defaultZoom: 100 });
                const defaultZoomFactor = settings.defaultZoom / 100;
                debugLog("Default zoom factor:", defaultZoomFactor, `(${settings.defaultZoom}%)`);
                
                // Check if the new zoom is the default
                const isDefaultZoom = Math.abs(newZoomFactor - defaultZoomFactor) < 0.01; // Allow small rounding differences
                
                if (isDefaultZoom) {
                    debugLog("Zoom changed to default value - removing any stored settings");
                    
                    // Look for any existing zoom setting to remove
                    const existingZoom = await findZoomForURL(tab.url);
                    if (existingZoom !== null) {
                        // There's an existing setting - we need to remove it
                        // First, parse the URL into components
                        const urlData = await urlUtils.createURLData(tab.url);
                        if (!urlData) {
                            console.error("Failed to parse URL for zoom removal:", tab.url);
                            return;
                        }
                        
                        // Get all records for this host
                        const hostRecords = await dbUtils.findZoomSettingsByHost(urlData.urlParts.host);
                        
                        // Find the best match (which we'll remove)
                        let bestMatch = null;
                        let bestSpecificity = -1;
                        
                        for (const record of hostRecords) {
                            let specificity = calculateSpecificity(record);
                            
                            if (matchesURL(record, urlData.urlParts) && specificity > bestSpecificity) {
                                bestMatch = record;
                                bestSpecificity = specificity;
                            }
                        }
                        
                        if (bestMatch) {
                            debugLog("  Found existing zoom setting to remove:", bestMatch);
                            await dbUtils.removeZoomSetting(bestMatch.id);
                            debugLog("  Zoom setting removed successfully");
                        }
                    } else {
                        debugLog("  No existing zoom setting found to remove");
                    }
                } else {
                    debugLog("User manually changed zoom level to non-default - storing preference");
                    await storeZoomForURL(tab.url, newZoomFactor);
                    debugLog("Zoom preference stored successfully");
                }
            }
        }
    }).catch((error) => {
        console.error("Error getting tab information for zoom change:", error);
    });
});

//------------------------------------------------------------------------------
// Message Handling
//------------------------------------------------------------------------------

/**
 * Handle messages from other parts of the extension
 * Supported actions:
 * - getCurrentZoom: Get zoom level of active tab
 * - getDatabaseMetrics: Get storage usage statistics
 * - purgeOldEntries: Remove oldest zoom settings
 * - clearAllEntries: Remove all zoom settings
 * - checkStorageLimit: Check and enforce storage limits
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getCurrentZoom") {
        browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
            if (tabs[0]) {
                browser.tabs.getZoom(tabs[0].id).then(zoomFactor => {
                    sendResponse({ zoomFactor: zoomFactor });
                });
            }
        });
        return true; // Required for async sendResponse
    }
    
    else if (message.action === "getDatabaseMetrics") {
        dbUtils.getDatabaseMetrics().then(metrics => {
            sendResponse(metrics);
        }).catch(error => {
            console.error("Error getting database metrics:", error);
            sendResponse(null);
        });
        return true;
    }
    
    else if (message.action === "purgeOldEntries") {
        browser.storage.sync.get({ purgePercentage: 10 }).then(settings => {
            return dbUtils.purgeOldestEntries(settings.purgePercentage);
        }).then(purgedCount => {
            debugLog(`Manually purged ${purgedCount} entries`);
            sendResponse({ success: true, purgedCount });
        }).catch(error => {
            console.error("Error during manual purge:", error);
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }
    
    else if (message.action === "clearAllEntries") {
        dbUtils.clearAllZoomSettings().then(() => {
            debugLog("All zoom settings cleared");
            sendResponse({ success: true });
        }).catch(error => {
            console.error("Error clearing all entries:", error);
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }
    
    else if (message.action === "checkStorageLimit") {
        dbUtils.checkAndEnforceStorageLimit().then(wasPurged => {
            sendResponse({ success: true, purgePerformed: wasPurged });
        }).catch(error => {
            console.error("Error checking storage limit:", error);
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }
});

//------------------------------------------------------------------------------
// Initialization
//------------------------------------------------------------------------------

/**
 * Initialize the extension
 * - Sets up the database
 * - Checks storage limits
 * - Logs initial metrics
 */
dbUtils.initDatabase().then(() => {
    debugLog("Database initialized successfully");
    
    // Log database metrics and check storage limit
    return Promise.all([
        dbUtils.getDatabaseMetrics(),
        dbUtils.checkAndEnforceStorageLimit()
    ]);
}).then(([metrics, wasPurged]) => {
    debugLog("Zoomer Database Metrics:");
    debugLog(`Total zoom entries: ${metrics.totalEntries}`);
    debugLog(`Unique websites: ${metrics.uniqueHosts}`);
    debugLog(`Entries used in last 7 days: ${metrics.recentEntries}`);
    debugLog(`Estimated storage: ${metrics.estimatedSize}`);
    
    if (wasPurged) {
        debugLog("Storage limit was exceeded - purge performed during startup");
    }
    
    console.log("Zoomer extension background script loaded");
}).catch(error => {
    console.error("Database initialization error:", error);
    console.log("Zoomer extension background script loaded (DB ERROR)");
});

// Display version info in console
console.log("Zoomer extension version:", browser.runtime.getManifest().version);
