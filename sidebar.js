// control the display of the legend index
function setLegendVisible(visible) {
    const legendEl = document.getElementById('life-legend');
    if (legendEl) {
        legendEl.style.display = visible ? 'block' : 'none';
    }
}
const observer = new MutationObserver(() => {
    updateGeoJsonColor();
});

const rightContainer = document.getElementById('right-container');
observer.observe(rightContainer, { childList: true, subtree: true });
// icon
document.querySelectorAll('.sub-info-icon').forEach(icon => {
icon.addEventListener('mouseenter', function () {
    const text = this.getAttribute('data-tooltip');
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    tooltip.textContent = text;
    document.body.appendChild(tooltip);

    const rect = this.getBoundingClientRect();
    tooltip.style.left = rect.right + 8 + 'px';
    tooltip.style.top = rect.top + 'px';
});

icon.addEventListener('mouseleave', function () {
    document.querySelectorAll('.custom-tooltip').forEach(el => el.remove());
});
});
// remove the layer and legend
document.querySelectorAll('.section-header').forEach(header => {
header.addEventListener('click', function () {
const targetId = this.dataset.target;
const targetEl = document.getElementById(targetId);
const isExpanded = targetEl.classList.contains('expanded');

document.querySelectorAll('.section-content').forEach(el => el.classList.remove('expanded'));
document.querySelectorAll('.section-header').forEach(el => el.classList.remove('active'));

if (!isExpanded) {
    targetEl.classList.add('expanded');
    this.classList.add('active');
}
currentTargetId = targetId;
currentIsExpanded = !isExpanded;

const rightContainer = document.getElementById('right-container');
const introContainer = document.getElementById('intro-container');
const maxButton = document.getElementById('label-toggle-container');
if (targetId === 'sidebar-lifeindex-content' && !isExpanded) {
    rightContainer.classList.remove('hidden');
    introContainer.classList.remove('hidden');
    maxButton.classList.remove('hidden');
    
    setLegendVisible(true);
} else {
    rightContainer.classList.add('hidden');
    introContainer.classList.add('hidden');
    maxButton.classList.add('hidden');

    setLegendVisible(false);
}
        updateGeoJsonColor();
    });
});

document.getElementById('LifeExpectancy').addEventListener('click', function() {
    if (map.hasLayer(lifeExpectancyLayer)) {
        map.removeLayer(lifeExpectancyLayer);
    }else{
        map.addLayer(lifeExpectancyLayer);
    }
});
document.getElementById('LifeExpectancy').addEventListener('click', function() {
    if (legend._map) {
        legend.remove();
    }else{
        legend.addTo(map);
    }
});
document.getElementById('LifeExpectancy').addEventListener('click', function() {
    if (legend2._map) {
        legend2.remove();
    }else{
        legend2.addTo(map);
    }
});
document.getElementById('LifeExpectancy').addEventListener('click', function() {
    setLegendVisible(false);
});
document.getElementById('LifeExpectancy').addEventListener('click', function() {
    let infoPanel = document.getElementById('info-panel');
    if (infoPanel.style.display === "block") {
        infoPanel.style.display = "none";
    }
});
document.getElementById('LifeExpectancy').addEventListener('click', function() {
    if (mapLayer) {
        mapLayer.remove();
        isLayerAdded = false; 
    }
});
// open index and close the value
document.getElementById('LifeExpectancy').addEventListener('click', function() {
    let index = document.getElementById('Life-Expectancy-Score');
    if (index.classList.contains('expanded')) {
        index.classList.remove('expanded');
    }
});
document.getElementById('Life-Expectancy-Score').addEventListener('click', function() {
    let value = document.getElementById('LifeExpectancy');
    if (value.classList.contains('expanded')) {
        value.classList.remove('expanded');
    }
});
document.getElementById('Life-Expectancy-Score').addEventListener('click', function() {
    if (map.hasLayer(lifeExpectancyLayer)) {
        map.removeLayer(lifeExpectancyLayer);
        isLayerAdded = false;
    }
});
document.getElementById('Life-Expectancy-Score').addEventListener('click', function() {
    if (legend._map) {
        legend.remove();
    }
});
document.getElementById('Life-Expectancy-Score').addEventListener('click', function() {
    if (legend2._map) {
        legend2.remove();
    }
});
document.getElementById('Life-Expectancy-Score').addEventListener('click', function() {
    setLegendVisible(true);
});
document.getElementById('Life-Expectancy-Score').addEventListener('click', function() {
    let infoPanel = document.getElementById('info-panel');
    if (infoPanel.style.display === "block") {
        infoPanel.style.display = "none";
    }
});
// document.getElementById('Life-Expectancy-Score').addEventListener('click', function() {
//     if (mapLayer && !map.hasLayer(mapLayer)) {
// mapLayer.addTo(map);
// }
// });
document.getElementById('Life-Expectancy-Score').addEventListener('click', function() {
if (mapLayer) {
if (!isLayerAdded) {
    mapLayer.addTo(map);
    isLayerAdded = true; 
} else {
    map.removeLayer(mapLayer);
    isLayerAdded = false; 
}
}
});
// open index and close the value

document.getElementById('close-info').addEventListener('click', function () {
    document.getElementById('info-panel').style.display = "none";
});

document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', function () {
        this.classList.toggle('expanded');
    });
});

// info-panel-click
document.querySelectorAll('.info-header').forEach(header => {
header.addEventListener('click', function () {
const targetId = this.dataset.target;

document.querySelectorAll('.info-content').forEach(content => {
    if (content.id === targetId) {
        content.classList.toggle('expanded');
    } else {
        content.classList.remove('expanded');
    }
});

document.querySelectorAll('.info-header').forEach(h => {
    if (h === this) {
        h.classList.toggle('active');
    } else {
        h.classList.remove('active');
    }
});
});
});
document.querySelectorAll('.info-content').forEach(content => {
if (content.classList.contains('expanded')) {
const header = document.querySelector(`.info-header[data-target="${content.id}"]`);
if (header) {
    header.classList.add('active');
}
}
});
document.querySelectorAll('.sub-info-header').forEach(header => {
header.addEventListener('click', function () {
const targetId = this.dataset.target;

document.querySelectorAll('.sub-info-content').forEach(content => {
    if (content.id === targetId) {
        content.classList.toggle('expanded');
    } else {
        content.classList.remove('expanded');
    }
});

document.querySelectorAll('.sub-info-header').forEach(h => {
    if (h === this) {
        h.classList.toggle('active');
    } else {
        h.classList.remove('active');
    }
});
});
});