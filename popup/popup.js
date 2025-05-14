// Open options page when preferences button is clicked
document.getElementById('openOptions').addEventListener('click', () => {
    browser.runtime.openOptionsPage();
    window.close();
});

// Update current zoom info
document.addEventListener('DOMContentLoaded', () => {
    browser.runtime.sendMessage({ action: "getCurrentZoom" })
        .then(response => {
            if (response && response.zoomFactor) {
                const zoomPercent = Math.round(response.zoomFactor * 100);
                document.getElementById('currentZoom').textContent = `Current Page: ${zoomPercent}%`;
            }
        })
        .catch(error => {
            console.error("Error getting current zoom:", error);
        });
});