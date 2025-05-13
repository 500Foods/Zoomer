// Placeholder functionality for options page
document.addEventListener('DOMContentLoaded', function() {
    // Update zoom value display
    const zoomSlider = document.getElementById('defaultZoom');
    const zoomValue = document.getElementById('zoomValue');
    
    zoomSlider.addEventListener('input', function() {
        zoomValue.textContent = this.value + '%';
    });
    
    // Placeholder button handlers
    document.getElementById('clearAll').addEventListener('click', function() {
        alert('Clear all URLs - Not implemented yet');
    });
    
    document.getElementById('export').addEventListener('click', function() {
        alert('Export list - Not implemented yet');
    });
    
    document.getElementById('import').addEventListener('click', function() {
        alert('Import list - Not implemented yet');
    });
    
    console.log('Options page loaded');
});
