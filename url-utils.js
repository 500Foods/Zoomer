// URL parsing utilities for Zoomer extension

// URL component bitmasks (same as in options.js)
const COMPONENT_PATH = 1;      // 001 in binary
const COMPONENT_QUERY = 2;     // 010 in binary  
const COMPONENT_FRAGMENT = 4;  // 100 in binary

/**
 * Parse a URL into its components
 * @param {string} url - The URL to parse
 * @returns {Object} - Object containing host, path, query, and fragment
 */
function parseURL(url) {
    try {
        const urlObj = new URL(url);
        
        return {
            host: urlObj.host.toLowerCase(), // Normalize to lowercase
            path: normalizePath(urlObj.pathname),
            query: urlObj.search, // includes the '?'
            fragment: urlObj.hash, // includes the '#'
            fullURL: url
        };
    } catch (error) {
        console.error('Error parsing URL:', url, error);
        return null;
    }
}

/**
 * Normalize a URL path
 * @param {string} path - URL path
 * @returns {string} - Normalized path
 */
function normalizePath(path) {
    // Ensure path starts with /
    if (!path.startsWith('/')) {
        path = '/' + path;
    }
    
    // Handle default path
    if (path === '/') {
        return '/';
    }
    
    // Remove trailing slash for consistency unless it's just the root path
    if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
    }
    
    return path;
}

/**
 * Generate a component bitmask from settings
 * @param {Object} settings - User settings for component inclusion
 * @returns {number} - Bitmask representing which components to include
 */
function generateComponentBitmask(settings) {
    let bitmask = 0;
    
    if (settings.includePath) bitmask |= COMPONENT_PATH;
    if (settings.includeQuery) bitmask |= COMPONENT_QUERY;
    if (settings.includeFragment) bitmask |= COMPONENT_FRAGMENT;
    
    return bitmask;
}

/**
 * Create a standardized URL string based on component inclusion settings
 * @param {Object} urlParts - Result from parseURL()
 * @param {number} componentFlags - Bitmask for which components to include
 * @returns {string} - Standardized URL string
 */
function createStandardizedURL(urlParts, componentFlags) {
    if (!urlParts) return null;
    
    let result = urlParts.host;
    
    // Check if path should be included (bit 0)
    if (componentFlags & COMPONENT_PATH) {
        result += urlParts.path;
    }
    
    // Check if query should be included (bit 1)
    if (componentFlags & COMPONENT_QUERY) {
        result += urlParts.query;
    }
    
    // Check if fragment should be included (bit 2)
    if (componentFlags & COMPONENT_FRAGMENT) {
        result += urlParts.fragment;
    }
    
    return result;
}

/**
 * Generate all possible specificity levels for a URL
 * @param {Object} urlParts - Result from parseURL()
 * @returns {Array} - Array of sorted URL variants from most specific to least specific
 */
function generateSpecificityLevels(urlParts) {
    if (!urlParts) return [];
    
    // Create all possible combinations, sorted by specificity (most to least)
    const levels = [];
    
    // Most specific: all components
    if (urlParts.fragment || urlParts.query) {
        levels.push({
            url: createStandardizedURL(urlParts, COMPONENT_PATH | COMPONENT_QUERY | COMPONENT_FRAGMENT),
            bitmask: COMPONENT_PATH | COMPONENT_QUERY | COMPONENT_FRAGMENT,
            description: 'Host + Path + Query + Fragment'
        });
    }
    
    // Path + Query only
    if (urlParts.query && urlParts.path !== '/') {
        levels.push({
            url: createStandardizedURL(urlParts, COMPONENT_PATH | COMPONENT_QUERY),
            bitmask: COMPONENT_PATH | COMPONENT_QUERY,
            description: 'Host + Path + Query'
        });
    }
    
    // Path + Fragment only
    if (urlParts.fragment && urlParts.path !== '/') {
        levels.push({
            url: createStandardizedURL(urlParts, COMPONENT_PATH | COMPONENT_FRAGMENT),
            bitmask: COMPONENT_PATH | COMPONENT_FRAGMENT,
            description: 'Host + Path + Fragment'
        });
    }
    
    // Path only (most common case)
    if (urlParts.path !== '/') {
        levels.push({
            url: createStandardizedURL(urlParts, COMPONENT_PATH),
            bitmask: COMPONENT_PATH,
            description: 'Host + Path'
        });
    }
    
    // Host only (least specific)
    levels.push({
        url: createStandardizedURL(urlParts, 0),
        bitmask: 0,
        description: 'Host only'
    });
    
    return levels;
}

/**
 * Create URL data with multiple specificity levels for matching
 * @param {string} url - Original URL
 * @returns {Promise<Object>} - URL data with different specificity levels
 */
async function createURLData(url) {
    const urlParts = parseURL(url);
    if (!urlParts) return null;
    
    // Get user settings from storage
    const settings = await browser.storage.local.get({
        includePath: true,
        includeQuery: false,
        includeFragment: false
    });
    
    const userBitmask = generateComponentBitmask(settings);
    
    return {
        original: url,
        urlParts,
        userStandardized: createStandardizedURL(urlParts, userBitmask),
        userBitmask,
        specificityLevels: generateSpecificityLevels(urlParts)
    };
}

/**
 * Get user settings and generate standardized URL
 * @param {string} url - Raw URL 
 * @param {Object} [overrideSettings] - Optional override settings
 * @returns {Promise<string>} - Promise resolving to standardized URL
 */
async function getUserStandardizedURL(url, overrideSettings = null) {
    const urlParts = parseURL(url);
    if (!urlParts) return null;
    
    let settings;
    
    if (overrideSettings) {
        settings = overrideSettings;
    } else {
        // Get user settings from storage
        settings = await browser.storage.local.get({
            includePath: true,
            includeQuery: false,
            includeFragment: false
        });
    }
    
    const bitmask = generateComponentBitmask(settings);
    return createStandardizedURL(urlParts, bitmask);
}

// Export functions for use in other scripts
if (typeof browser !== 'undefined') {
    window.urlUtils = {
        parseURL,
        normalizePath,
        createStandardizedURL,
        generateComponentBitmask,
        getUserStandardizedURL,
        generateSpecificityLevels,
        createURLData,
        // Export constants
        COMPONENT_PATH,
        COMPONENT_QUERY,
        COMPONENT_FRAGMENT
    };
}