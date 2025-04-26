// section1 map
function style(feature){
    return{
        fillColor: getColor(feature.properties['Life Expectancy']),
        weight:0.5,
        color:'white',
        fillOpacity:0.8,
    }
}
// highlight selected areas
let Neighbors = [];
let targetArea = [];
function highlightFeatureAndNeighbors(clickedFeature, layerGroup){
    const currentGEOID = clickedFeature.properties['GEOID'];
    const neighbors = clickedFeature.properties['neighbor_geoids'].split(',').map(d => d.trim());
    let Neighbors = [];
    let targetArea = [];

    layerGroup.eachLayer(function(layer){
        const layerGEOID = layer.feature.properties['GEOID'];
        // const isNeighbor = layer
        const isTarget = layerGEOID === currentGEOID;
        const isNeighbor =neighbors && neighbors.includes(layerGEOID)
        if(isTarget){
            layer.setStyle({
                fillOpacity: 0.95,
                weight:4.5,
                color:'red'
            });
            layer.bringToFront();
            targetArea.push(layer);
        }else if(isNeighbor){
            layer.setStyle({
                fillOpacity:0.75,
                weight:2.7,
                color:"white",
            });
            Neighbors.push(layer);
        }else{
            layer.setStyle({
                fillOpacity:0.15,
                weight:0.1,
                color:'white'
            });
        }
    })
}
function resetAllOpacity(layerGroup){
    layerGroup.eachLayer(function(layer){
        layer.setStyle({
            fillOpacity: 0.8,
            weight:0.5,
            color:'white'
        });
        layer.bringToFront();
        layer.bringToBack();
    });
}

// add legend for highlighted areas
let highlightLegend = null;
function addHighlightLegend(){
    if(highlightLegend){
        highlightLegend.remove();
        let highlightLegend = null;
    }
    highlightLegend = L.control({position: 'bottomright'});
    highlightLegend.onAdd = function(map){
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = `
    <h4>Highlight Meaning</h4>
    <i style="border: 3.5px solid red; display:inline-block; width:15px; height:15px; margin-right:6px;"></i> Selected Area<br>
    <i style="border: 2px solid #ccc; display:inline-block;box-shadow: 0 0 1px #000; width:17px; height:17px; margin-right:6px;"></i> Neighbors of Selected Area<br>
    <i style="border: 1.5px dashed black; display:inline-block; width:18px; height:18px; margin-right:6px;"></i> Census Tracts<br>
`;
div.style.lineHeight = '1.8';
        return div;
    };
    highlightLegend.addTo(map);
}

// add census tract layer
let ctLineData = null;
    let ctLineLayer = null;
    fetch('data/ct_lines.geojson')
        .then(response => response.json())
        .then(data => {
            ctLineData = data;
    });

function onEachFeature(feature, layer) {
    layer.bindPopup(`<b>Life Expectancy: ${feature.properties['Life Expectancy'].toFixed(1)} years</b><br>
    <span style="font-size: 11px;">Close this callout popup to see<br>all the block groups.</span>`);
    layer.on('click', function() {
        map.fitBounds(layer.getBounds(), {
            padding: [20, 20],
            maxZoom: 16}); 
        updateInfoPanel(feature);
        highlightFeatureAndNeighbors(feature, lifeExpectancyLayer);
        addHighlightLegend();
        const tractce = feature.properties['TRACTCE'];
        const boroname = feature.properties['boroname'];
        const neighborIds = feature.properties['neighbor_geoids'] || [];
        const neighbors_tract = [];

        lifeExpectancyLayer.eachLayer(function (l) {
            const geoID = l.feature.properties['GEOID'];
            if (neighborIds.includes(geoID)) {
                neighbors_tract.push(l.feature.properties['TRACTCE']);
            }
        });
        const allTracts = [tractce, ...neighbors_tract];
        if(ctLineLayer){
            map.removeLayer(ctLineLayer);
        }
        if(ctLineData){
            const filteredCT ={
                type: 'FeatureCollection',
                features: ctLineData.features.filter(f => f.properties['boroname'] === boroname &&
                allTracts.includes(f.properties['TRACTCE']))
            };
            ctLineLayer = L.geoJson(filteredCT, {
                style: {
                    color: 'black',
                    weight: 1,
                    dashArray: '4,4'
                }
            }).addTo(map);
        }
    });
    layer.on('popupclose',function(){
        resetAllOpacity(lifeExpectancyLayer);
        if(highlightLegend){
            highlightLegend.remove();
            highlightLegend = null;
        }
        if(ctLineLayer){
            map.removeLayer(ctLineLayer);
            ctLineLayer = null;
        }
    })
}

var lifeExpectancyLayer;
fetch('data/bg_with_neighborlife.geojson')
    .then(response => response.json())
    .then(data => {
        lifeExpectancyLayer = L.geoJson(data, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);
    });

var legend = L.control({position: 'bottomleft'});
legend.onAdd = function(map){
    var container = L.DomUtil.create('div', 'info legend');
    var lifeExpectancy = L.DomUtil.create('div', 'lifeExpectancy', container),
        lifeGrades = [74.06, 75.95, 77.50, 78.61, 79.41, 80.16, 81.03, 81.98, 83.08, 84.53];
    lifeExpectancy.innerHTML = '<h4>Life Expectancy</h4>';
    
    for (var i = 0; i < lifeGrades.length; i++){
        lifeExpectancy.innerHTML += 
            '<i style="background:' + getColor(lifeGrades[i] + 1) + '"></i> ' +
            lifeGrades[i] + (lifeGrades[i + 1] ? '&ndash;' + lifeGrades[i + 1] + '<br>' : '+');
    }
    return container;
};
legend.addTo(map);

var legend2 = L.control({ position: 'bottomleft' });
legend2.onAdd = function (map) {
    var container = L.DomUtil.create('div', 'info legend2');
    container.innerHTML = '<div style="font-family: Orbitron, sans-serif; font-size:14.4px; color: #555;">Click on each block group to see the details. It would show life expectancy and related factors for each area, with comparisons to nearby regions. </div>';
    return container;
};
legend2.addTo(map);

// section2 map
var mapLayer;
let allLayers = [];
var isLayerAdded = false;
let legend_index = null;
let currentTargetId = null;
let currentIsExpanded = null;
var factorMapping = {
    'factor1': 'median house value_norm',
    'factor2': 'pm300_norm',
    'factor3': 'avr_height_norm',
    'factor4': 'good_tree_density_norm',
    'factor5': 'poverty_norm',
    'factor6': 'rent_norm',
    'factor7': 'ResFAR_norm',
    'factor8': 'ComFAR_norm',
    'factor9': 'per capita income_norm'
};

function onEachArea(feature, layer) {
    let score = feature.properties && feature.properties.avg ? feature.properties.avg.toFixed(1) : "5.0";
    layer.bindPopup(`<b>Score:</b> ${score}`);
    allLayers.push(layer);
    layer.on('click', function() {
        map.fitBounds(layer.getBounds(), {
            padding: [20, 20],
            maxZoom: 22}); 
    });
}
// Upload the layer
fetch('data/bg_score.geojson')
    .then(response => response.json())
    .then(data => {
        mapLayer = L.geoJson(data, {
            style: function(feature) {
                return {
                    fillColor: '#565656',
                    color:'black',
                    weight: 0.5,
                    fillOpacity: 0.7
                };
            },
            onEachFeature: onEachArea
        });

        assignFactors(data);
    });
// drag clips
function allowDrop(event) {
    event.preventDefault();
}

function drag(event) {
    event.dataTransfer.setData("text", event.target.id);
}

function drop(event, targetId) {
    event.preventDefault();
    var data = event.dataTransfer.getData("text");
    var draggedElement = document.getElementById(data);
    var targetContainer = document.getElementById(targetId);

    if (!targetContainer.contains(draggedElement)) {
        targetContainer.appendChild(draggedElement);
    }

    updateGeoJsonColor(); //recalculate the color
}
// Assign factors to the geojson data
function assignFactors(geojsonData) {
    geojsonData.features.forEach(feature => {
        for (let factorId in factorMapping) {
            let geojsonProperty = factorMapping[factorId];
            let factorElement = document.getElementById(factorId);
            if (factorElement && feature.properties[geojsonProperty] !== undefined) {
                factorElement.dataset.value = feature.properties[geojsonProperty]; 
            }
        }
    });
}
let maxLayer = [];
let maxMarkers = [];
let labelsShown = false;
// calculate the color of the geojson based on the factors
function updateGeoJsonColor() {
    if (!mapLayer) return;

    let avgValues = [];

    // Step 1:
    mapLayer.eachLayer(layer => {
        let rightContainer = document.getElementById('right-container');
        let factors = rightContainer.getElementsByClassName('factor');

        const weights = {
            'median house value_norm': 0.29,
            'pm300_norm' : -0.22,
            'avr_height_norm' : -0.38,
            'good_tree_density_norm' : 0.08,
            'rent_norm' : 0.85,
            'ResFAR_norm' : 0.24,
            'ComFAR_norm' : -0.25,
            'poverty_norm': -1.15,
            'per capita income_norm' : 0.3
        }

        let weightedTotal = 0;
        let weightSum = 0;

        Array.from(factors).forEach(factor => {
            let factorName = factor.id;
            let propertyName = factorMapping[factorName];

            if (propertyName && layer.feature.properties[propertyName] !== undefined) {
                let value = parseFloat(layer.feature.properties[propertyName]);
                let weight = weights[propertyName] ?? 0;
                if (!isNaN(value) && !isNaN(weight)) {
                    weightedTotal += value * weight;
                    weightSum += Math.abs(weight);
                }
            }
        });
        let score = weightSum  > 0? 5 + 5*weightedTotal/weightSum:0;
        layer.feature.properties.avg = score;

        avgValues.push(score);
    });

    // Step 2:
    let min = Math.min(...avgValues);
    let max = Math.max(...avgValues);
    maxLayer = [];
    maxMarkers.forEach(marker => map.removeLayer(marker));
    maxMarkers = [];

    const legendEl = document.getElementById('life-legend');
    const toggleBtn = document.getElementById('label-toggle-container');
    if (currentTargetId !== 'sidebar-lifeindex-content' || !currentIsExpanded) {
        toggleBtn.style.display = 'none';
        maxMarkers.forEach(marker => map.removeLayer(marker));
        maxMarkers = [];
        labelsShown = false;
        document.getElementById('show-labels-button').classList.remove('active');
        if (legendEl) legendEl.style.display = 'none';
    }
    else if (min === max) {
        toggleBtn.style.display = 'none';
        maxMarkers.forEach(marker => map.removeLayer(marker));
        maxMarkers = [];
        labelsShown = false;
        document.getElementById('show-labels-button').classList.remove('active');
        if (legendEl) legendEl.style.display = 'none';
    }
    else {
        toggleBtn.style.display = 'block';
        if (legendEl) legendEl.style.display = 'block';
    }

    mapLayer.eachLayer(layer => {
        let avg = layer.feature.properties.avg;

        let color = getColor1(avg, min, max);
        layer.setStyle({
            fillColor: color,
            fillOpacity: 0.7,
        });

        let popupContent = `<b>Score:</b> ${avg.toFixed(1)}`;
        layer.bindPopup(popupContent);
        if(avg === max){
            maxLayer.push(layer)
        }
    });
    addLegend(min, max);

    if (labelsShown) {
        maxLayer.forEach(layer => {
            const center = layer.getBounds().getCenter();
            const marker = L.marker([center.lat, center.lng], { icon: greenIcon }).addTo(map);
            maxMarkers.push(marker);
        });
    }
}

function getColor1(avg, min, max) {
    if (min === max) {
        return '#565656';
    }

    let colorScale = d3.scaleSequential(d3.interpolateRdBu)
        .domain([min, max]); 

    return colorScale(avg);
}
// add click function to the button
document.getElementById('show-labels-button').addEventListener('click', () => {
    const button = document.getElementById('show-labels-button');
    const circle = document.getElementById('label-circle');
    labelsShown = !labelsShown;

    if (labelsShown) {
        button.classList.add('active');
    } else {
        button.classList.remove('active');
    }
    updateGeoJsonColor();
});

// add score legend
var greenIcon = L.icon({
            iconUrl: 'label/highscore.png',
            iconSize: [102, 90],
            iconAnchor: [51, 90],
            popupAnchor: [-3, -76]
        });
function addLegend(min, max) {
    if (legend_index) {
        map.removeControl(legend_index);
        legend_index = null;
    }
    if (min === max){
        return;
    };

    legend_index = L.control({ position: 'bottomright' });

    legend_index.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.id = 'life-legend'
        const steps = 6;
        const stepSize = (max - min) / (steps - 1);

        const labels = [];
        labels.push(`<h4 style="margin-bottom: 6px;">Score</h4>`)
        for (let i = 0; i < steps; i++) {
            const value = min + i * stepSize;
            const color = d3.interpolateRdBu((value - min) / (max - min));
            const label = `
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <div style="width: 20px; height: 20px; background:${color}; margin-right: 6px;opacity:0.9;"></div>
                    <span>${value.toFixed(1)}</span>
                </div>
            `;
            labels.push(label);
        }

        div.innerHTML = `<div style="padding:8px;border-radius:4px">${labels.join('')}</div>`;
        return div;
    };
    legend_index.addTo(map);
}
d3.select("#life-index-legend").selectAll("*").remove();
const lifeIndexlegendSvg = d3.select("#life-index-legend")
    .append("svg")
    .attr("width", 350)
    .attr("height", 115);
lifeIndexlegendSvg.append("rect")
    .attr("x",0.5)
    .attr("y",0.5)
    .attr("width",30)
    .attr("height",25)
    .attr("rx",5)
    .attr("ry",5)
    .style("fill","#dceaf4")
    .style("stroke-width", 0);
lifeIndexlegendSvg.append("text")
    .attr("x", 36.5)
    .attr("y", 16.8)
    .style("fill","#2c4050")
    .text("Housing")
    .style("font-weight", "bold")
    .style("font-size", "16px");
lifeIndexlegendSvg.append("rect")
    .attr("x",149)
    .attr("y",0.5)
    .attr("width",30)
    .attr("height",25)
    .attr("rx",5)
    .attr("ry",5)
    .style("fill","#daf1e3")
    .style("stroke-width", 0);
lifeIndexlegendSvg.append("text")
    .attr("x", 186)
    .attr("y", 16.8)
    .style("fill","#1f3a29")
    .text("Environmental Factor")
    .style("font-weight", "bold")
    .style("font-size", "16px");
lifeIndexlegendSvg.append("rect")
    .attr("x",0.5)
    .attr("y",36)
    .attr("width",30)
    .attr("height",25)
    .attr("rx",5)
    .attr("ry",5)
    .style("fill","#fdf8dc")
    .style("stroke-width", 0);
lifeIndexlegendSvg.append("text")
    .attr("x", 36.5)
    .attr("y", 54)
    .style("fill","#3f3a1f")
    .text("Land Use")
    .style("font-weight", "bold")
    .style("font-size", "16px");
lifeIndexlegendSvg.append("rect")
    .attr("x",149)
    .attr("y",36)
    .attr("width",30)
    .attr("height",25)
    .attr("rx",5)
    .attr("ry",5)
    .style("fill","#e0e0e0")
    .style("stroke-width", 0);
lifeIndexlegendSvg.append("text")
    .attr("x", 186)
    .attr("y", 54)
    .style("fill","#333333")
    .text("Built Environment")
    .style("font-weight", "bold")
    .style("font-size", "16px");
lifeIndexlegendSvg.append("rect")
    .attr("x",0.5)
    .attr("y",72)
    .attr("width",30)
    .attr("height",25)
    .attr("rx",5)
    .attr("ry",5)
    .style("fill","#f3e0e0")
    .style("stroke-width", 0);
lifeIndexlegendSvg.append("text")
    .attr("x", 36.5)
    .attr("y", 89)
    .style("fill","#402020")
    .text("Socioeconomic Factor")
    .style("font-weight", "bold")
    .style("font-size", "16px");