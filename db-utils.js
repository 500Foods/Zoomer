// Database utilities for Zoomer extension

// Constants
const DB_NAME = 'ZoomerDB';
const DB_VERSION = 1;
const STORE_NAME = 'zoomSettings';

// Database connection
let db = null;

/**
 * Initialize the database
 * @returns {Promise} - Resolves when DB is ready
 */
function initDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("Error opening database:", event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            debugLog("Database opened successfully");
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            debugLog("Creating/upgrading database schema");

            // Create object store with auto-incrementing ID
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                
                // Create indexes for efficient lookups
                store.createIndex('host', 'host', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                
                // Compound index for more specific lookups
                store.createIndex('hostPath', ['host', 'path'], { unique: false });
                
                debugLog("Object store and indexes created");
            }
        };
    });
}

/**
 * Debug logging function that checks if debug mode is enabled
 */
function debugLog(...args) {
    if (typeof browser !== 'undefined') {
        browser.storage.local.get({ debugMode: false }).then((settings) => {
            if (settings.debugMode) {
                console.log(...args);
            }
        });
    } else {
        // Fallback for testing outside extension context
        console.log(...args);
    }
}

/**
 * Add or update a zoom setting
 * @param {Object} data - The zoom setting data
 * @returns {Promise} - Resolves with the ID of the stored record
 */
async function storeZoomSetting(data) {
    await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // First check if we already have this exact entry
        const hostIndex = store.index('host');
        const hostRequest = hostIndex.getAll(data.host);
        
        hostRequest.onsuccess = (event) => {
            const matches = event.target.result;
            let existingId = null;
            
            // Look for an exact match (host + components that match our mask)
            for (const record of matches) {
                if (record.componentMask === data.componentMask &&
                    record.path === data.path &&
                    record.query === data.query &&
                    record.fragment === data.fragment) {
                    existingId = record.id;
                    break;
                }
            }
            
            if (existingId) {
                // Update existing record
                data.id = existingId;
                data.timestamp = Date.now(); // Update timestamp
                
                const updateRequest = store.put(data);
                updateRequest.onsuccess = () => resolve(existingId);
                updateRequest.onerror = (e) => reject(e.target.error);
            } else {
                // Add new record
                data.timestamp = Date.now();
                const addRequest = store.add(data);
                addRequest.onsuccess = (event) => resolve(event.target.result);
                addRequest.onerror = (e) => reject(e.target.error);
            }
        };
        
        hostRequest.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

/**
 * Find zoom settings for a host
 * @param {string} host - The host to look for
 * @returns {Promise<Array>} - Resolves with array of matching records
 */
async function findZoomSettingsByHost(host) {
    await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const hostIndex = store.index('host');
        const request = hostIndex.getAll(host);
        
        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

/**
 * Update the timestamp for a record (mark as accessed)
 * @param {number} id - Record ID
 * @returns {Promise} - Resolves when update is complete
 */
async function updateTimestamp(id) {
    await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const getRequest = store.get(id);
        
        getRequest.onsuccess = (event) => {
            const record = event.target.result;
            if (record) {
                record.timestamp = Date.now();
                const updateRequest = store.put(record);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = (e) => reject(e.target.error);
            } else {
                reject(new Error('Record not found'));
            }
        };
        
        getRequest.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

/**
 * Get all zoom settings
 * @returns {Promise<Array>} - Resolves with all records
 */
async function getAllZoomSettings() {
    await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

/**
 * Remove a zoom setting
 * @param {number} id - Record ID
 * @returns {Promise} - Resolves when removal is complete
 */
async function removeZoomSetting(id) {
    await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        
        request.onsuccess = () => {
            resolve();
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

/**
 * Clear all zoom settings
 * @returns {Promise} - Resolves when all records are cleared
 */
async function clearAllZoomSettings() {
    await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        
        request.onsuccess = () => {
            resolve();
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

/**
 * Get the total count of zoom settings
 * @returns {Promise<number>} - Resolves with the count
 */
async function getZoomSettingsCount() {
    await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const countRequest = store.count();
        
        countRequest.onsuccess = (event) => {
            resolve(event.target.result);
        };
        
        countRequest.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

/**
 * Get approximate database size (rough estimate)
 * @returns {Promise<Object>} - Resolves with size info {count, estimatedBytes, readableSize}
 */
async function getZoomSettingsSize() {
    const records = await getAllZoomSettings();
    const count = records.length;
    
    // Estimate size based on serialized data
    let totalSize = 0;
    for (const record of records) {
        // Convert to JSON to estimate storage size
        const serialized = JSON.stringify(record);
        totalSize += serialized.length * 2; // Rough approximation including overhead
    }
    
    // Format human-readable size
    let readableSize;
    if (totalSize < 1024) {
        readableSize = `${totalSize} bytes`;
    } else if (totalSize < 1024 * 1024) {
        readableSize = `${(totalSize / 1024).toFixed(1)} KB`;
    } else {
        readableSize = `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
    }
    
    return {
        count,
        estimatedBytes: totalSize,
        readableSize
    };
}

/**
 * Find the oldest zoom settings (for LRU eviction)
 * @param {number} limit - Maximum number of entries to return
 * @returns {Promise<Array>} - Resolves with array of oldest records
 */
async function findOldestZoomSettings(limit) {
    await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        
        // Use a cursor to iterate through the index in ascending order (oldest first)
        const results = [];
        const request = index.openCursor();
        
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && results.length < limit) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

/**
 * Count zoom settings updated within a specific time period
 * @param {number} days - Number of days to look back
 * @returns {Promise<number>} - Count of recently used settings
 */
async function countRecentlyUsedZoomSettings(days = 7) {
    await initDatabase();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        
        // Calculate the cutoff timestamp (now minus days in milliseconds)
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        // Use a range query to get all entries newer than the cutoff
        const range = IDBKeyRange.lowerBound(cutoffTime);
        const countRequest = index.count(range);
        
        countRequest.onsuccess = (event) => {
            resolve(event.target.result);
        };
        
        countRequest.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

/**
 * Count unique hosts in zoom settings
 * @returns {Promise<number>} - Count of unique hosts
 */
async function countUniqueHosts() {
    const allRecords = await getAllZoomSettings();
    const uniqueHosts = new Set();
    
    for (const record of allRecords) {
        uniqueHosts.add(record.host);
    }
    
    return uniqueHosts.size;
}

/**
 * Get a summary of database metrics
 * @returns {Promise<Object>} - Database metrics
 */
async function getDatabaseMetrics() {
    const totalCount = await getZoomSettingsCount();
    const sizeInfo = await getZoomSettingsSize();
    const recentCount = await countRecentlyUsedZoomSettings(7);
    const uniqueHostsCount = await countUniqueHosts();
    
    return {
        totalEntries: totalCount,
        uniqueHosts: uniqueHostsCount,
        recentEntries: recentCount,
        estimatedSize: sizeInfo.readableSize
    };
}

/**
 * Purge a percentage of oldest entries
 * @param {number} percentage - Percentage to purge (1-100)
 * @returns {Promise<number>} - Number of entries purged
 */
async function purgeOldestEntries(percentage) {
    if (percentage <= 0 || percentage > 100) {
        throw new Error('Percentage must be between 1 and 100');
    }
    
    // Get total count
    const totalCount = await getZoomSettingsCount();
    if (totalCount === 0) return 0;
    
    // Calculate number to purge
    const purgingCount = Math.max(1, Math.floor(totalCount * percentage / 100));
    debugLog(`Purging ${purgingCount} entries (${percentage}% of ${totalCount})`);
    
    // Get oldest entries
    const oldestEntries = await findOldestZoomSettings(purgingCount);
    
    // Delete them
    let deletedCount = 0;
    for (const entry of oldestEntries) {
        await removeZoomSetting(entry.id);
        deletedCount++;
    }
    
    return deletedCount;
}

/**
 * Check if storage limit is exceeded and purge if needed
 * @returns {Promise<boolean>} - True if purge was performed
 */
async function checkAndEnforceStorageLimit() {
    const settings = await browser.storage.local.get({
        storageLimit: 10000,
        purgePercentage: 10
    });
    
    const currentCount = await getZoomSettingsCount();
    
    if (currentCount > settings.storageLimit) {
        debugLog(`Storage limit exceeded: ${currentCount} > ${settings.storageLimit}`);
        const purgedCount = await purgeOldestEntries(settings.purgePercentage);
        debugLog(`Purged ${purgedCount} entries`);
        return true;
    }
    
    return false;
}

// Add to exports
if (typeof browser !== 'undefined') {
    window.dbUtils = {
        initDatabase,
        storeZoomSetting,
        findZoomSettingsByHost,
        updateTimestamp,
        getAllZoomSettings,
        removeZoomSetting,
        clearAllZoomSettings,
        getZoomSettingsCount,
        getZoomSettingsSize,
        findOldestZoomSettings,
        countRecentlyUsedZoomSettings,
        countUniqueHosts,
        getDatabaseMetrics,
        purgeOldestEntries,
        checkAndEnforceStorageLimit
    };
}

