// Initialize the map
        var map = L.map('map-container', {
            center: [40.7238, -73.9450], 
            zoom: 12,
            minZoom: 10, 
            maxZoom: 18 
        });

        // Add the black and white tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '©OpenStreetMap, ©CartoDB'
        }).addTo(map);

        function getColor(d){
            return d > 84.5322 ? '#2b83ba' :
                d > 83.0792 ? '#64abb0' :
                d > 81.9826  ? '#9dd3a6' :
                d > 81.0332 ? '#c7e8ad' :
                d > 80.1584 ? '#ecf7b9' :
                d > 79.4123 ? '#ffedaa' :
                d > 78.6148 ? '#fec980' :
                d > 77.5021 ? '#f99d59' :
                d > 75.9455 ? '#e85b3b' : 
                d > 74.0618 ? '#d7191c' : '#d7191c';
        }

// box plot
        fetch('data/bg_with_neighborlife.geojson')
            .then(response => response.json())
            .then(data => {
                let tooltip = d3.select("body").select(".tooltip");
                if (tooltip.empty()) {
                    tooltip = d3.select("body")
                        .append("div")
                        .attr("class", "tooltip")
                        .style("position", "absolute")
                        .style("background", "#222")
                        .style("color", "white")
                        .style("padding", "8px")
                        .style("border-radius", "4px")
                        .style("font-size", "13px")
                        .style("box-shadow", "2px 2px 6px rgba(0,0,0,0.3)")
                        .style("pointer-events", "none")
                        .style("opacity", 0);
                }
                const features = data.features;

                d3.select("#boxplot-chart").selectAll("*").remove();

                const groupedData = d3.group(
                    features.filter(d => d.properties['Life Expectancy'] !== null),
                    d => d.properties.COUNTYFP
                );

                const margin = { top: 20, right: 30, bottom: 40, left: 20 };
                const width = 335;
                const height = 300;

                const svg = d3.select("#boxplot-chart")
                    .append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                    .append("g")
                    .attr("transform", `translate(${margin.left},${margin.top})`);

                const counties = Array.from(groupedData.keys()).sort();

                // fetch all the data
                const allLEs = features.map(f => f.properties['Life Expectancy']);
                const y = d3.scaleLinear()
                    .domain([d3.min(allLEs), d3.max(allLEs)])
                    .range([height, 0])
                    .nice();

                const x = d3.scaleBand()
                    .domain(counties)
                    .range([0, width])
                    .padding(0.3);

                const kde = kernelDensityEstimator(kernelEpanechnikov(1), y.ticks(50));

                counties.forEach(county => {
                    const values = groupedData.get(county).map(d => d.properties['Life Expectancy']);

                    // violet
                    let density = kde(values);
                    const extent = d3.extent(values);
                    density = density.filter(d => d[0] >= extent[0] && d[0] <= extent[1]);


                    const maxDensity = d3.max(density, d => d[1]);

                    const scaleX = d3.scaleLinear()
                        .range([0, x.bandwidth() / 2])
                        .domain([0, maxDensity]);

                    const area = d3.area()
                        .x0(d => -scaleX(d[1]))
                        .x1(d => scaleX(d[1]))
                        .y(d => y(d[0]))
                        .curve(d3.curveCatmullRom.alpha(0.5));

                    svg.append("path")
                        .datum(density)
                        .attr("transform", `translate(${x(county) + x.bandwidth() / 2},0)`)
                        .attr("d", area)
                        .style("fill", "none")
                        .style("stroke", "black")
                        .style("stroke-width",1)
                        .style("opacity", 1);

                    // box plot
                    const sorted = values.sort(d3.ascending);
                    const q1 = d3.quantile(sorted, 0.25);
                    const median = d3.quantile(sorted, 0.5);
                    const q3 = d3.quantile(sorted, 0.75);
                    const interQuantileRange = q3 - q1;
                    const min = d3.max([d3.min(sorted), q1 - 1.5 * interQuantileRange]);
                    const max = d3.min([d3.max(sorted), q3 + 1.5 * interQuantileRange]);

                    const center = x(county) + x.bandwidth() / 2;
                    const boxWidth = x.bandwidth() * 0.3;

                    const stats = {
                        county: county,
                        min: min.toFixed(2),
                        q1: q1.toFixed(2),
                        median: median.toFixed(2),
                        q3: q3.toFixed(2),
                        max: max.toFixed(2)
                    };

                    svg.append("line")
                        .attr("x1", center)
                        .attr("x2", center)
                        .attr("y1", y(min))
                        .attr("y2", y(max))
                        .attr("stroke", "black")
                        .attr("stroke-width",2)

                    svg.append("rect")
                        .attr("x", center - boxWidth / 2)
                        .attr("y", y(q3))
                        .attr("height", y(q1) - y(q3))
                        .attr("width", boxWidth)
                        .attr("rx", 3) 
                        .attr("ry", 3)
                        .attr("stroke", "black")
                        .attr("stroke-width",2)
                        .attr("fill", "#d1d1d1")
                        .on("mouseover", function (event) {
                            d3.select(this)
                                .style("cursor", "pointer");
                            tooltip.transition().duration(200).style("opacity", 1);
                            tooltip.html(
                                `<strong>${countyToBorough[county] || "Borough"}</strong><br>` +
                                `Max: ${stats.max}<br>` +
                                `Q3: ${stats.q3}<br>` +
                                `Median: ${stats.median}<br>` +
                                `Q1: ${stats.q1}<br>` +
                                `Min: ${stats.min}`
                            );
                        })
                        .on("mousemove", function (event) {
                            const tooltipWidth = tooltip.node().offsetWidth;
                            const tooltipHeight = tooltip.node().offsetHeight;
                            const svgWidth = width + margin.left + margin.right;
                            const svgHeight = height + margin.top + margin.bottom;
                            let left = event.pageX + 15;
                            let top = event.pageY - 40;
                            if (left + tooltipWidth > svgWidth) {
                                left = event.pageX - tooltipWidth - 15;
                            }
                            if (top < 0) {
                                top = event.pageY + 15;
                            }
                            tooltip
                                .style("left", `${left}px`)
                                .style("top", `${top}px`);
                        })
                        .on("mouseout", function () {
                            tooltip.transition().duration(300).style("opacity", 0);
                        });

                    svg.append("line")
                        .attr("x1", center - boxWidth / 2)
                        .attr("x2", center + boxWidth / 2)
                        .attr("y1", y(median))
                        .attr("y2", y(median))
                        .attr("stroke-width",2)
                        .attr("stroke", "black");

                    const step = 4;
                    for (let yVal = y(extent[1]); yVal < y(extent[0]); yVal += step) {
                        const yValue = y.invert(yVal);
                        const matched = density.find(d => d[0] >= yValue);
                        if (matched) {
                            const w = scaleX(matched[1]);
                            svg.append("line")
                                .attr("x1", center - w)
                                .attr("x2", center + w)
                                .attr("y1", yVal)
                                .attr("y2", yVal)
                                .attr("stroke", "#555")
                                .attr("stroke-width", 0.8)
                                .attr("opacity", 0.5);
                        }
                    }

                    // abnormal values
                    sorted.forEach(v => {
                        if (v < min || v > max) {
                            svg.append("circle")
                                .attr("cx", center)
                                .attr("cy", y(v))
                                .attr("r", 3)
                                .attr("stroke","black")
                                .style("opacity",0.8)
                                .style("fill", "#333");
                        }
                    });
                });

                const countyToBorough = {
                    "5": "Bronx",
                    "47": "Brooklyn",
                    "61": "Manhattan",
                    "81": "Queens",
                    "85": "Staten Island"
                };

                // Axes
                svg.append("g")
                    .attr("transform", `translate(0,${height})`)
                    .call(d3.axisBottom(x).tickFormat(d => countyToBorough[d]))
                    .call(g => {
                        g.selectAll(".tick line").remove();
                        g.select(".domain").remove();
                    });

                svg.append("g")
                    .call(d3.axisLeft(y));
                });

        // KDE kernel
        function kernelDensityEstimator(kernel, X) {
            return function (V) {
                return X.map(function (x) {
                    return [x, d3.mean(V, function (v) { return kernel(x - v); })];
                });
            };
        }

        function kernelEpanechnikov(k) {
            return function (v) {
                return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
            };
        }



        function updateInfoPanel(feature) {
            document.getElementById('info-block-group').innerText = feature.properties['NAMELSAD'];
            document.getElementById('info-census-tract').innerHTML = "<strong>Census Tract: </strong>" + feature.properties['TRACTCE'];
            document.getElementById('info-ntaname').innerHTML = "<strong>Neighborhood Area: </strong>" + feature.properties['ntaname'];
            document.getElementById('info-cdtaname').innerHTML = "<strong>Community District: </strong>" + feature.properties['cdtaname'];
            document.getElementById('info-county').innerHTML = "<strong>Borough: </strong>" + feature.properties['boroname'];
            document.getElementById('info-life-expectancy').innerText = "Life Expectancy: " + feature.properties['Life Expectancy'].toFixed(1) + " years";
            document.getElementById('info-tree-density').innerText = "Tree Density: " + feature.properties['tree_density'].toFixed(1) + " trees per km²";
            document.getElementById('info-income').innerText = "Per Capita Income: " + feature.properties['per capita income'].toFixed(1) + " dollars per year";
            document.getElementById('info-building-height').innerText = "Average Building Height: " + feature.properties['avr_height'].toFixed(1) + " feet";
            document.getElementById('info-edu').innerText = "Ratio of Less Than High School: " + feature.properties['less than high school'];
            document.getElementById('info-air-quality').innerText = "Concentration of PM2.5: " + feature.properties['pm300'];
            document.getElementById('info-structure-time').innerText = "Ratio of Structure Buit before 1960: " + feature.properties['%early built'];
            document.getElementById('info-rent').innerText = "Rent: " + feature.properties['rent'].toFixed(1) + " dollars per year";

// openai api
            const apiUrl='http://localhost:3000/api/generate';

            fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section:'life',
                    name: feature.properties['NAMELSAD'],
                    county: feature.properties['COUNTYFP'],
                    tract: feature.properties['TRACTCE'],
                    value: feature.properties['Life Expectancy'],
                    geoID: feature.properties['GEOID'],
                    neighbor_geoids: feature.properties['neighbor_geoids'],
                })
            })
            .then(res => res.json())
            .then(data => {
                document.getElementById('info-ai-summary').innerText = data.text;
            })
            .catch(err => {
                document.getElementById('info-ai-summary').innerText = "Sorry, failed to load summary.";
                console.error("AI Summary Error:", err);
            });
// tree density ai
            fetch(apiUrl,{
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section:'tree',
                    name: feature.properties['NAMELSAD'],
                    county: feature.properties['COUNTYFP'],
                    tract: feature.properties['TRACTCE'],
                    geoID: feature.properties['GEOID'],
                    neighbor_geoids: feature.properties['neighbor_geoids'],
                    value:feature.properties['tree_density'], 
                })
            })
            .then(res => res.json())
            .then(data => {
                // console.log("Tree Density AI Summary:", data);
                if (data && data.text) {
                    document.getElementById('info-ai-tree').innerText = data.text;
                } else {
                    document.getElementById('info-ai-tree').innerText = "Sorry, failed to load summary.";
                    console.error("Tree Density Summary Error:",err)
                }
            })
// air quality ai
            fetch(apiUrl,{
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section:'air',
                    name: feature.properties['NAMELSAD'],
                    county: feature.properties['COUNTYFP'],
                    tract: feature.properties['TRACTCE'],
                    geoID: feature.properties['GEOID'],
                    neighbor_geoids: feature.properties['neighbor_geoids'],
                    value:feature.properties['pm300'], 
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.text) {
                    document.getElementById('info-ai-air').innerText = data.text;
                } else {
                    document.getElementById('info-ai-air').innerText = "Sorry, failed to load summary.";
                    console.error("Air Quality Summary Error:",err)
                }
            })
// building height ai
            fetch(apiUrl,{
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section:'buildingHeight',
                    name: feature.properties['NAMELSAD'],
                    county: feature.properties['COUNTYFP'],
                    tract: feature.properties['TRACTCE'],
                    geoID: feature.properties['GEOID'],
                    neighbor_geoids: feature.properties['neighbor_geoids'],
                    value:feature.properties['avr_height'], 
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.text) {
                    document.getElementById('info-ai-buildingHeight').innerText = data.text;
                } else {
                    document.getElementById('info-ai-buildingHeight').innerText = "Sorry, failed to load summary.";
                    console.error("Building Height Summary Error:",err)
                }
            })
// structure time ai
            fetch(apiUrl,{
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section:'structureTime',
                    name: feature.properties['NAMELSAD'],
                    county: feature.properties['COUNTYFP'],
                    tract: feature.properties['TRACTCE'],
                    geoID: feature.properties['GEOID'],
                    neighbor_geoids: feature.properties['neighbor_geoids'],
                    value:feature.properties['%early built'], 
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.text) {
                    document.getElementById('info-ai-structureTime').innerText = data.text;
                } else {
                    document.getElementById('info-ai-structureTime').innerText = "Sorry, failed to load summary.";
                    console.error("Summary Error:",err)
                }
            })
// income ai
            fetch(apiUrl,{
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section:'income',
                    name: feature.properties['NAMELSAD'],
                    county: feature.properties['COUNTYFP'],
                    tract: feature.properties['TRACTCE'],
                    geoID: feature.properties['GEOID'],
                    neighbor_geoids: feature.properties['neighbor_geoids'],
                    value:feature.properties['per capita income'], 
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.text) {
                    document.getElementById('info-ai-income').innerText = data.text;
                } else {
                    document.getElementById('info-ai-income').innerText = "Sorry, failed to load summary.";
                    console.error("Income Summary Error:",err)
                }
            })
// education ai
            fetch(apiUrl,{
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section:'edu',
                    name: feature.properties['NAMELSAD'],
                    county: feature.properties['COUNTYFP'],
                    tract: feature.properties['TRACTCE'],
                    geoID: feature.properties['GEOID'],
                    neighbor_geoids: feature.properties['neighbor_geoids'],
                    value:feature.properties['less than high school'], 
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.text) {
                    document.getElementById('info-ai-edu').innerText = data.text;
                } else {
                    document.getElementById('info-ai-edu').innerText = "Sorry, failed to load summary.";
                    console.error("Education Summary Error:",err)
                }
            })

// rent ai
            fetch(apiUrl,{
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section:'rent',
                    name: feature.properties['NAMELSAD'],
                    county: feature.properties['COUNTYFP'],
                    tract: feature.properties['TRACTCE'],
                    geoID: feature.properties['GEOID'],
                    neighbor_geoids: feature.properties['neighbor_geoids'],
                    value:feature.properties['rent'], 
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.text) {
                    document.getElementById('info-ai-rent').innerText = data.text;
                } else {
                    document.getElementById('info-ai-rent').innerText = "Sorry, failed to load summary.";
                    console.error("Rent Summary Error:",err)
                }
            })

// mapHeat
        const heatmapWidth = 360;
        const cellSize = 28;
        const cellPadding = 4;

        fetch('data/bg_with_neighborlife.geojson')
            .then(response => response.json())
            .then(data => {
                const allFeatures = data.features;
                const currentID = feature.properties.GEOID;

                let neighborIDs = [];
                if (feature.properties.neighbor_geoids) {
                neighborIDs = feature.properties.neighbor_geoids
                    .split(',')
                    .map(d => d.trim());
                }

                const filtered = allFeatures.filter(d => {
                    const id = d.properties.GEOID;
                    return id === currentID || neighborIDs.includes(id);
                });

                const neighborsOnly = filtered.filter(d => d.properties.GEOID !== currentID);
                const neighborLEs = neighborsOnly.map(d => d.properties['Life Expectancy']).filter(d => !isNaN(d));

                const avgLE = d3.mean(neighborLEs);
                const medianLE = d3.median(neighborLEs);

                const heatmapData = [
                    {
                        label: feature.properties.NAMELSAD,
                        tract: feature.properties['TRACTCE'],
                        value: feature.properties['Life Expectancy'],
                        type: 'current'
                    },
                    ...neighborsOnly.map(d => ({
                        label: d.properties.NAMELSAD,
                        tract: d.properties['TRACTCE'],
                        value: d.properties['Life Expectancy'],
                        type: 'neighbor'
                    })),
                    {
                        label: 'Nearby Avg',
                        tract: 'N/A',
                        value: avgLE,
                        type: 'avg'
                    },
                ];

                d3.select("#heatmap-strip").selectAll("*").remove();

                const columns = 11;
                const rows = Math.ceil(heatmapData.length / columns);
                const heatmapSvg = d3.select("#heatmap-strip")
                    .append("svg")
                    .attr("width", heatmapWidth)
                    .attr("height", rows *(cellSize + cellPadding));

                    const thresholds = [74.0618, 75.9455, 77.5021, 78.6148, 79.4123, 80.1584, 81.0332, 81.9826, 83.0792, 84.5322];
                    const colors = ['#d7191c','#d7191c', '#e85b3b', '#f99d59', '#fec980', '#ffedaa',
                                    '#ecf7b9', '#c7e8ad', '#9dd3a6', '#64abb0', '#2b83ba'];

                    const colorScale = d3.scaleThreshold()
                        .domain(thresholds)
                        .range(colors);

                // const colorScale = d3.scaleSequential(d3.interpolateBlues)
                //     // .domain(d3.extent(heatmapData, d => d.value));
                //     .domain([75.2, 84.4]);

                    let tooltip = d3.select("#info-panel").select(".tooltip");
                    if (tooltip.empty()) {
                        tooltip = d3.select("#info-panel")
                            .append("div")
                            .attr("class", "tooltip")
                            .style("position", "absolute")
                            .style("background", "#222")
                            .style("color", "white")
                            .style("padding", "6px 10px")
                            .style("border", "1px solid #aaa")
                            .style("border-radius", "4px")
                            .style("pointer-events", "none")
                            .style("font-size", "13px")
                            .style("box-shadow", "2px 2px 6px rgba(0,0,0,0.2)")
                            .style("opacity", 0);
                    }

                    heatmapData.sort((a, b) => a.value - b.value);
                    heatmapData.forEach((d, i) => {
                    const col = i% columns;
                    const row = Math.floor(i/columns);
                    heatmapSvg.append("rect")
                        .attr("x", col * (cellSize + cellPadding))
                        .attr("y", row * (cellSize + cellPadding))
                        .attr("width", cellSize)
                        .attr("height", cellSize)
                        .attr("fill", colorScale(d.value))
                        .attr("opacity", 0.8)
                        .attr("stroke", d.type === "current" ? "red" : d.type === "avg" ? "black" : "white")
                        .attr("stroke-width", d.type === "current" ? 2 : 1)
                        .style("cursor", "pointer")
                        .text(`${d.label}: ${d.value.toFixed(1)} years`)
                        .on("mouseover", function(event){
                            tooltip.transition().duration(200).style("opacity", 1);
                            tooltip.html(
                                `<strong>Name:</strong> ${d.label}<br>` +
                                `<strong>Census Tract:</strong> ${d.tract}<br>` +
                                `<strong>Life Expectancy:</strong> ${d.value.toFixed(1)} years`
                            )
                        })
                        .on("mousemove", function (event) {
                            const [x, y] = d3.pointer(event, heatmapSvg.node()); 

                            const tooltipWidth = 150;
                            const tooltipHeight = 50;

                            const svgRect = heatmapSvg.node().getBoundingClientRect();
                            const infoPanel = document.getElementById("info-panel");
                            const scrollTop = infoPanel.scrollTop;

                            let left = x + 10;
                            let top =svgRect.top + y + scrollTop - infoPanel.getBoundingClientRect().top - tooltipHeight - 10;

                            if (left + tooltipWidth > svgRect.width) {
                                left = x - tooltipWidth - 10;
                            }
                            tooltip
                                .style("left", `${left}px`)
                                .style("top", `${top}px`);
                            const tooltipNode = tooltip.node();
                            const tooltipBox = tooltipNode.getBoundingClientRect();
                            const actualLeft = tooltipBox.left + window.scrollX;

                            console.log("Tooltip DOM Position:");
                            console.log("Left (page):", tooltipBox.left + window.scrollX);
                            console.log("Top (page):", tooltipBox.top + window.scrollY);
                            console.log("Width:", tooltipBox.width);
                            console.log("Height:", tooltipBox.height);
                            if (actualLeft < 250) {
                                const currentLeft = parseFloat(tooltip.style("left"));
                                tooltip.style("left", `${currentLeft + 450}px`);
                            }
                        })
                        .on("mouseout", function () {
                            tooltip.transition().duration(300).style("opacity", 0);
                        });
                    });
// graphics
                    d3.select("#life-expectancy-legend").selectAll("*").remove();
                    const legendSvg = d3.select("#life-expectancy-legend")
                        .append("svg")
                        .attr("width", 400)
                        .attr("height", 40);

                    legendSvg.append("rect")
                        .attr("x", 10)
                        .attr("y", 0.5)
                        .attr("width", 27)
                        .attr("height", 27)
                        .style("fill", "none")
                        .style("stroke", "red")
                        .style("stroke-width", 2);

                    legendSvg.append("rect")
                        .attr("x", 184)
                        .attr("y", 0.5)
                        .attr("width", 27)
                        .attr("height", 27)
                        .style("fill", "none")
                        .style("stroke", "black")
                        .style("stroke-width", 1);

                    legendSvg.append("text")
                        .attr("x", 42)
                        .attr("y", 25)
                        .text(": Selected Block Group")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "12px");
                    
                    legendSvg.append("text")
                        .attr("x", 216)
                        .attr("y", 25)
                        .text(": Average Life Expectancy")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "12px");
                });
// Treemap-treeDensity
                d3.select("#tree-map").selectAll("*").remove();
                const width = 360;
                const height = 390;
                const margin = { top: 30, right: 30, bottom: 30, left: 30 };

                fetch('data/bg_with_neighborlife.geojson')
                    .then(response => response.json())
                    .then(data => {
                        const allFeatures = data.features;

                        const currentID = feature.properties.GEOID;

                        let neighborIDs = [];
                        if (feature.properties.neighbor_geoids) {
                            neighborIDs = feature.properties.neighbor_geoids
                                .split(',')
                                .map(d => d.trim());
                        }

                        const filtered = allFeatures.filter(d => {
                            const id = d.properties.GEOID;
                            return id === currentID || neighborIDs.includes(id);
                        });

                        const tractMap = d3.group(filtered, d => d.properties.TRACTCE);

                        const treemapData = {
                            name: "root",
                            children: Array.from(tractMap, ([tract, blockGroups]) => ({
                                name: tract,
                                children: blockGroups.map(d => ({
                                    id: d.properties.BLKGRPCE,
                                    tract: d.properties.TRACTCE,
                                    name: d.properties.NAMELSAD,
                                    value: d.properties.tree_density || 2,
                                    life: d.properties['Life Expectancy'],
                                    tree_density: d.properties.tree_density,
                                    geoID: d.properties.GEOID
                                }))
                            }))
                        };

                        const root = d3.hierarchy(treemapData)
                            .sum(d => d.value) 
                            .sort((a, b) => b.value - a.value);

                        d3.treemap()
                            .size([width, height - margin.top-30]) 
                            .paddingInner(0)
                            .paddingOuter(1.5)
                            .paddingTop(1.5)(root); 
                        // color
                        const lifeExtent = d3.extent(filtered, d => d.properties['Life Expectancy']);
                        const thresholds = [75.9455, 77.5021, 78.6148, 79.4123, 80.1584, 81.0332, 81.9826, 83.0792, 84.5322];
                        const colors = ['#d7191c', '#e85b3b', '#f99d59', '#fec980', '#ffedaa',
                                    '#ecf7b9', '#c7e8ad', '#9dd3a6', '#64abb0', '#2b83ba'];
                        const color = d3.scaleThreshold()
                            .domain(thresholds)
                            .range(colors);

                    const colorScale = d3.scaleThreshold()
                        .domain(thresholds)
                        .range(colors);

                        // SVG
                        const svg = d3.select("#tree-map")
                            .append("svg")
                            .attr("width", width)
                            .attr("height", height);

                        const chartGroup = svg.append("g")
                            .attr("transform", `translate(0, ${margin.top})`);
                        
                        // legend
                        const defs = svg.append("defs");

                        const linearGradient = defs.append("linearGradient")
                            .attr("id", "legend-gradient")
                            .attr("x1", "0%")
                            .attr("x2", "100%")
                            .attr("y1", "0%")
                            .attr("y2", "0%");

                        const totalSteps = colors.length;
                        for (let i = 0; i < totalSteps; i++) {
                            const offset = (i / (totalSteps - 1)) * 100;
                            linearGradient.append("stop")
                                .attr("offset", `${offset}%`)
                                .attr("stop-color", colors[i]);
                        }

                        const legendWidth = 350;
                        const legendHeight = 15;
                        const legendX = 5;
                        const legendY = height-35; 

                        svg.append("rect")
                            .attr("x", legendX)
                            .attr("y", legendY)
                            .attr("width", legendWidth)
                            .attr("height", legendHeight)
                            .style("fill", "url(#legend-gradient)")
                            .style("stroke", "#aaa")
                            .style("opacity",0.8)
                            .attr("ry", 3)
                            .attr("rx", 3)
                            .style("filter", "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))")
                            .style("stroke-width", 0.5);

                        svg.append("text")
                            .attr("x", legendX)
                            .attr("y", legendY+legendHeight+12)
                            .attr("text-anchor", "start")
                            .text("Low Life Expectancy")
                            .attr("font-size", "11px")
                            .attr("fill", "#333")
                            .style("font-family", "Orbitron, sans-serif");

                        svg.append("text")
                            .attr("x", legendX + legendWidth)
                            .attr("y", legendY+legendHeight+12)
                            .attr("text-anchor", "end")
                            .text("High Life Expectancy")
                            .attr("font-size", "11px")
                            .attr("fill", "#333")
                            .style("font-family", "Orbitron, sans-serif");

                        // Tooltip
                        let tooltip = d3.select("#tree-map").select(".tooltip");
                        if (tooltip.empty()) {
                            tooltip = d3.select("#tree-map")
                                .append("div")
                                .attr("class", "tooltip")
                                .style("position", "absolute")
                                .style("background", "#222")
                                .style("color", "white")
                                .style("padding", "6px 10px")
                                .style("border", "1px solid #aaa")
                                .style("border-radius", "4px")
                                .style("pointer-events", "none")
                                .style("font-size", "13px")
                                .style("box-shadow", "2px 2px 6px rgba(0,0,0,0.2)")
                                .style("opacity", 0);
                        }

                        // rect
                        chartGroup.selectAll("rect")
                            .data(root.leaves())
                            .enter()
                            .append("rect")
                            .attr("x", d => d.x0)
                            .attr("y", d => d.y0-25)
                            .attr("width", d => d.x1 - d.x0)
                            .attr("height", d => d.y1 - d.y0)
                            .attr("fill", d => color(d.data.life))
                            .style("stroke", d => d.data.geoID === currentID ? "red" : "#173964")
                            .style("stroke-width", d => d.data.geoID === currentID ? 2 : 1)
                            .style("opacity",0.7)
                            .style("cursor", "pointer")
                            .on("mouseover", function(event,d){
                                tooltip.transition().duration(200).style("opacity", 1);
                                tooltip.html(
                                    `<strong>Life Expectancy:</strong> ${d.data.life.toFixed(1)} years<br>` +
                                    `<strong>Tree Density:</strong> ${d.data.tree_density.toFixed(1)} trees/acre<br>` +
                                    `<strong>Name:</strong> ${d.data.name}<br>`+
                                    `<strong>Census Tract:</strong> ${d.data.tract}`
                                )
                            })
                        .on("mousemove", function (event) {
                            const [x, y] = d3.pointer(event, d3.select("#tree-map").node()); 

                            const tooltipWidth = 150;
                            const tooltipHeight = 50;

                            const svgRect = d3.select("#tree-map").node().getBoundingClientRect();

                            let left = x + 10;
                            let top = y - tooltipHeight + 670;

                            if (left + tooltipWidth > svgRect.width) {
                                left = x - tooltipWidth - 10;
                            }
                            if (left < 0) left = 0;
                            tooltip
                                .style("left", `${left}px`)
                                .style("top", `${top}px`);
                            })
                            .on("mouseout", function () {
                                tooltip.transition().duration(300).style("opacity", 0);
                            });

                        // label
                        chartGroup.selectAll("text.label")
                            .data(root.leaves())
                            .enter()
                            .append("text")
                            .attr("class", "label")
                            .attr("x", d => d.x0 + 2)
                            .attr("y", d => d.y0 - 13)
                            .each(function(d) {
                                const id = d.data.id;
                                const tract = d.data.tract;
                                if (id && tract && d.x1 - d.x0 > 30 && d.y1 - d.y0 > 20) { 
                                    d3.select(this)
                                        .append("tspan")
                                        .attr("x", d.x0 + 4)
                                        .attr("dy", 0)
                                        .text(d => `BG${d.data.id}`);

                                    d3.select(this)
                                        .append("tspan")
                                        .attr("x", d.x0 + 4)
                                        .attr("dy", 8) 
                                        .text(tract);
                                }
                            }) 
                            .attr("font-size", "8.5px")
                            .attr("fill", "black")
                            .style("pointer-events", "none")
                            .style("font-family", "Orbitron, sans-serif");
                    });

// graphics
                    d3.select("#tree-legend").selectAll("*").remove();
                    const legendSvg = d3.select("#tree-legend")
                        .append("svg")
                        .attr("width", 500)
                        .attr("height", 80);

                    legendSvg.append("rect")
                        .attr("x", 0.5)
                        .attr("y", 13)
                        .attr("width", 60)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "#173964")
                        .style("stroke-width", 1);

                    legendSvg.append("rect")
                        .attr("x", 146)
                        .attr("y", 13)
                        .attr("width", 90)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "#173964")
                        .style("stroke-width", 1);

                    legendSvg.append("rect")
                        .attr("x", 302)
                        .attr("y", 13)
                        .attr("width", 50)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "red")
                        .style("stroke-width", 2);

                    legendSvg.append("line")
                        .attr("x1", 75)
                        .attr("y1", 38)
                        .attr("x2", 132)
                        .attr("y2", 38)
                        .attr("stroke", "black")
                        .attr("stroke-width", 1.5)
                        .attr("marker-end", "url(#arrow)");

                    legendSvg.append("defs").append("marker")
                        .attr("id", "arrow")
                        .attr("viewBox", "0 0 10 10")
                        .attr("refX", 5)
                        .attr("refY", 5)
                        .attr("markerWidth", 6)
                        .attr("markerHeight", 6)
                        .attr("orient", "auto-start-reverse")
                        .append("path")
                        .attr("d", "M 0 0 L 10 5 L 0 10 z")
                        .attr("fill", "black");

                    legendSvg.append("text")
                        .attr("x", 0.5)
                        .attr("y", 8)
                        .text("Tree Density:")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    legendSvg.append("text")
                        .attr("x", 0.5)
                        .attr("y", 76)
                        .text("Low")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    legendSvg.append("text")
                        .attr("x", 215)
                        .attr("y", 76)
                        .text("High")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    legendSvg.append("text")
                        .attr("x", 290)
                        .attr("y", 76)
                        .text("Area Selected")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    legendSvg.append("text")
                        .attr("x", 42)
                        .attr("y", 76)
                        .text("(Larger Size: Higher Tree Density)")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "10px");


// Treemap-airquality
                d3.select("#tree-map-air").selectAll("*").remove();

                fetch('data/bg_with_neighborlife.geojson')
                    .then(response => response.json())
                    .then(data => {
                        const allFeatures = data.features;

                        const currentID = feature.properties.GEOID;

                        let neighborIDs = [];
                        if (feature.properties.neighbor_geoids) {
                            neighborIDs = feature.properties.neighbor_geoids
                                .split(',')
                                .map(d => d.trim());
                        }

                        const filtered = allFeatures.filter(d => {
                            const id = d.properties.GEOID;
                            return id === currentID || neighborIDs.includes(id);
                        });

                        const tractMap = d3.group(filtered, d => d.properties.TRACTCE);

                        const treemapData = {
                            name: "root",
                            children: Array.from(tractMap, ([tract, blockGroups]) => ({
                                name: tract,
                                children: blockGroups.map(d => ({
                                    id: d.properties.BLKGRPCE,
                                    tract: d.properties.TRACTCE,
                                    name: d.properties.NAMELSAD,
                                    value: d.properties['pm300'],
                                    life: d.properties['Life Expectancy'],
                                    air: d.properties['pm300'],
                                    geoID: d.properties.GEOID
                                }))
                            }))
                        };

                        const root = d3.hierarchy(treemapData)
                            .sum(d => d.value) 
                            .sort((a, b) => b.value - a.value);

                        d3.treemap()
                            .size([width, height - margin.top-30]) 
                            .paddingInner(0)
                            .paddingOuter(1.5)
                            .paddingTop(1.5)(root); 
                        // color
                        const lifeExtent = d3.extent(filtered, d => d.properties['Life Expectancy']);
                        const thresholds = [75.9455, 77.5021, 78.6148, 79.4123, 80.1584, 81.0332, 81.9826, 83.0792, 84.5322];
                        const colors = ['#d7191c', '#e85b3b', '#f99d59', '#fec980', '#ffedaa',
                                    '#ecf7b9', '#c7e8ad', '#9dd3a6', '#64abb0', '#2b83ba'];
                        const color = d3.scaleThreshold()
                            .domain(thresholds)
                            .range(colors);

                        // SVG
                        const svg = d3.select("#tree-map-air")
                            .append("svg")
                            .attr("width", width)
                            .attr("height", height);

                        const chartGroup = svg.append("g")
                            .attr("transform", `translate(0, ${margin.top})`);
                        
                        // legend
                        const defs = svg.append("defs");

                        const linearGradient = defs.append("linearGradient")
                            .attr("id", "legend-gradient-air")
                            .attr("x1", "0%")
                            .attr("x2", "100%")
                            .attr("y1", "0%")
                            .attr("y2", "0%");

                        const totalSteps = colors.length;
                        for (let i = 0; i < totalSteps; i++) {
                            const offset = (i / (totalSteps - 1)) * 100;
                            linearGradient.append("stop")
                                .attr("offset", `${offset}%`)
                                .attr("stop-color", colors[i]);
                        }

                        const legendWidth = 350;
                        const legendHeight = 15;
                        const legendX = 5;
                        const legendY = height-35; 

                        svg.append("rect")
                            .attr("x", legendX)
                            .attr("y", legendY)
                            .attr("width", legendWidth)
                            .attr("height", legendHeight)
                            .style("fill", "url(#legend-gradient-air)")
                            .style("stroke", "#aaa")
                            .style("opacity",0.9)
                            .attr("ry", 3)
                            .attr("rx", 3)
                            .style("filter", "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))")
                            .style("stroke-width", 0.5);

                        svg.append("text")
                            .attr("x", legendX)
                            .attr("y", legendY+legendHeight+12)
                            .attr("text-anchor", "start")
                            .text("Low Life Expectancy")
                            .attr("font-size", "11px")
                            .attr("fill", "#333")
                            .style("font-family", "Orbitron, sans-serif");

                        svg.append("text")
                            .attr("x", legendX + legendWidth)
                            .attr("y", legendY+legendHeight+12)
                            .attr("text-anchor", "end")
                            .text("High Life Expectancy")
                            .attr("font-size", "11px")
                            .attr("fill", "#333")
                            .style("font-family", "Orbitron, sans-serif");

                        // Tooltip
                        let tooltip = d3.select("#tree-map-air").select(".tooltip");
                        if (tooltip.empty()) {
                            tooltip = d3.select("#tree-map-air")
                                .append("div")
                                .attr("class", "tooltip")
                                .style("position", "absolute")
                                .style("background", "#222")
                                .style("color", "white")
                                .style("padding", "6px 10px")
                                .style("border", "1px solid #aaa")
                                .style("border-radius", "4px")
                                .style("pointer-events", "none")
                                .style("font-size", "13px")
                                .style("box-shadow", "2px 2px 6px rgba(0,0,0,0.2)")
                                .style("opacity", 0);
                        }

                        // rect
                        chartGroup.selectAll("rect")
                            .data(root.leaves())
                            .enter()
                            .append("rect")
                            .attr("x", d => d.x0)
                            .attr("y", d => d.y0-25)
                            .attr("width", d => d.x1 - d.x0)
                            .attr("height", d => d.y1 - d.y0)
                            .attr("fill", d => color(d.data.life))
                            .style("stroke", d => d.data.geoID === currentID ? "red" : "#173964")
                            .style("stroke-width", d => d.data.geoID === currentID ? 2 : 1)
                            .style("opacity",0.7)
                            .style("cursor", "pointer")
                            .on("mouseover", function(event,d){
                                tooltip.transition().duration(200).style("opacity", 1);
                                tooltip.html(
                                    `<strong>Life Expectancy:</strong> ${d.data.life.toFixed(1)} years<br>` +
                                    `<strong>Concentration of PM2.5:</strong> ${d.data.air}<br>` +
                                    `<strong>Name:</strong> ${d.data.name}<br>`+
                                    `<strong>Census Tract:</strong> ${d.data.tract}`
                                )
                            })
                            .on("mousemove", function (event) {
                                const [x, y] = d3.pointer(event, d3.select("#tree-map").node()); 

                                const tooltipWidth = 150;
                                const tooltipHeight = 50;

                                const svgRect = d3.select("#tree-map").node().getBoundingClientRect();

                                let left = x + 10;
                                let top = y - tooltipHeight + 665;

                                if (left + tooltipWidth > svgRect.width) {
                                    left = x - tooltipWidth - 10;
                                }
                                if (left < 0) left = 0;
                                tooltip
                                    .style("left", `${left}px`)
                                    .style("top", `${top}px`);
                                })
                            .on("mouseout", function () {
                                    tooltip.transition().duration(300).style("opacity", 0);
                            });

                        // label
                        chartGroup.selectAll("text.label")
                            .data(root.leaves())
                            .enter()
                            .append("text")
                            .attr("class", "label")
                            .attr("x", d => d.x0 + 2)
                            .attr("y", d => d.y0 - 13)
                            .each(function(d) {
                                const id = d.data.id;
                                const tract = d.data.tract;
                                if (id && tract && d.x1 - d.x0 > 30 && d.y1 - d.y0 > 20) { 
                                    d3.select(this)
                                        .append("tspan")
                                        .attr("x", d.x0 + 4)
                                        .attr("dy", 0)
                                        .text(d => `BG${d.data.id}`);

                                    d3.select(this)
                                        .append("tspan")
                                        .attr("x", d.x0 + 4)
                                        .attr("dy", 8) 
                                        .text(tract);
                                }
                            }) 
                            .attr("font-size", "8.5px")
                            .attr("fill", "black")
                            .style("pointer-events", "none")
                            .style("font-family", "Orbitron, sans-serif");
                    });

// graphics
                    d3.select("#air-legend").selectAll("*").remove();
                    const airlegendSvg = d3.select("#air-legend")
                        .append("svg")
                        .attr("width", 500)
                        .attr("height", 80);

                    airlegendSvg.append("rect")
                        .attr("x", 0.5)
                        .attr("y", 13)
                        .attr("width", 60)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "#173964")
                        .style("stroke-width", 1);

                    airlegendSvg.append("rect")
                        .attr("x", 146)
                        .attr("y", 13)
                        .attr("width", 90)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "#173964")
                        .style("stroke-width", 1);

                    airlegendSvg.append("rect")
                        .attr("x", 302)
                        .attr("y", 13)
                        .attr("width", 50)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "red")
                        .style("stroke-width", 2);

                    airlegendSvg.append("line")
                        .attr("x1", 75)
                        .attr("y1", 38)
                        .attr("x2", 132)
                        .attr("y2", 38)
                        .attr("stroke", "black")
                        .attr("stroke-width", 1.5)
                        .attr("marker-end", "url(#arrow)");

                    airlegendSvg.append("defs").append("marker")
                        .attr("id", "arrow")
                        .attr("viewBox", "0 0 10 10")
                        .attr("refX", 5)
                        .attr("refY", 5)
                        .attr("markerWidth", 6)
                        .attr("markerHeight", 6)
                        .attr("orient", "auto-start-reverse")
                        .append("path")
                        .attr("d", "M 0 0 L 10 5 L 0 10 z")
                        .attr("fill", "black");

                    airlegendSvg.append("text")
                        .attr("x", 0.5)
                        .attr("y", 8)
                        .text("Pollutant Concentration:")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    airlegendSvg.append("text")
                        .attr("x", 0.5)
                        .attr("y", 76)
                        .text("Low")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    airlegendSvg.append("text")
                        .attr("x", 215)
                        .attr("y", 76)
                        .text("High")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    airlegendSvg.append("text")
                        .attr("x", 290)
                        .attr("y", 76)
                        .text("Area Selected")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    airlegendSvg.append("text")
                        .attr("x", 42)
                        .attr("y", 76)
                        .text("(Larger Size: Higher Concentration)")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "10px");

// Treemap-buildingheight
                d3.select("#tree-map-buildingHeight").selectAll("*").remove();

                fetch('data/bg_with_neighborlife.geojson')
                    .then(response => response.json())
                    .then(data => {
                        const allFeatures = data.features;

                        const currentID = feature.properties.GEOID;

                        let neighborIDs = [];
                        if (feature.properties.neighbor_geoids) {
                            neighborIDs = feature.properties.neighbor_geoids
                                .split(',')
                                .map(d => d.trim());
                        }

                        const filtered = allFeatures.filter(d => {
                            const id = d.properties.GEOID;
                            return id === currentID || neighborIDs.includes(id);
                        });

                        const tractMap = d3.group(filtered, d => d.properties.TRACTCE);

                        const treemapData = {
                            name: "root",
                            children: Array.from(tractMap, ([tract, blockGroups]) => ({
                                name: tract,
                                children: blockGroups.map(d => ({
                                    id: d.properties.BLKGRPCE,
                                    tract: d.properties.TRACTCE,
                                    name: d.properties.NAMELSAD,
                                    value: d.properties['avr_height'],
                                    life: d.properties['Life Expectancy'],
                                    avr_height: d.properties['avr_height'],
                                    geoID: d.properties.GEOID
                                }))
                            }))
                        };

                        const root = d3.hierarchy(treemapData)
                            .sum(d => d.value) 
                            .sort((a, b) => b.value - a.value);

                        d3.treemap()
                            .size([width, height - margin.top-30]) 
                            .paddingInner(0)
                            .paddingOuter(1.5)
                            .paddingTop(1.5)(root); 
                        // color
                        const lifeExtent = d3.extent(filtered, d => d.properties['Life Expectancy']);
                        const thresholds = [75.9455, 77.5021, 78.6148, 79.4123, 80.1584, 81.0332, 81.9826, 83.0792, 84.5322];
                        const colors = ['#d7191c', '#e85b3b', '#f99d59', '#fec980', '#ffedaa',
                                    '#ecf7b9', '#c7e8ad', '#9dd3a6', '#64abb0', '#2b83ba'];
                        const color = d3.scaleThreshold()
                            .domain(thresholds)
                            .range(colors);

                        // SVG
                        const svg = d3.select("#tree-map-buildingHeight") 
                            .append("svg")
                            .attr("width", width)
                            .attr("height", height);

                        const chartGroup = svg.append("g")
                            .attr("transform", `translate(0, ${margin.top})`);
                        
                        // legend
                        const defs = svg.append("defs");

                        const linearGradient = defs.append("linearGradient")
                            .attr("id", "legend-gradient-buildingHeight")
                            .attr("x1", "0%")
                            .attr("x2", "100%")
                            .attr("y1", "0%")
                            .attr("y2", "0%");

                        const totalSteps = colors.length;
                        for (let i = 0; i < totalSteps; i++) {
                            const offset = (i / (totalSteps - 1)) * 100;
                            linearGradient.append("stop")
                                .attr("offset", `${offset}%`)
                                .attr("stop-color", colors[i]);
                        }

                        const legendWidth = 350;
                        const legendHeight = 15;
                        const legendX = 5;
                        const legendY = height-35; 

                        svg.append("rect")
                            .attr("x", legendX)
                            .attr("y", legendY)
                            .attr("width", legendWidth)
                            .attr("height", legendHeight)
                            .style("fill", "url(#legend-gradient-buildingHeight)")
                            .style("stroke", "#aaa")
                            .style("opacity",0.9)
                            .attr("ry", 3)
                            .attr("rx", 3)
                            .style("filter", "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))")
                            .style("stroke-width", 0.5);

                        svg.append("text")
                            .attr("x", legendX)
                            .attr("y", legendY+legendHeight+12)
                            .attr("text-anchor", "start")
                            .text("Low Life Expectancy")
                            .attr("font-size", "11px")
                            .attr("fill", "#333")
                            .style("font-family", "Orbitron, sans-serif");

                        svg.append("text")
                            .attr("x", legendX + legendWidth)
                            .attr("y", legendY+legendHeight+12)
                            .attr("text-anchor", "end")
                            .text("High Life Expectancy")
                            .attr("font-size", "11px")
                            .attr("fill", "#333")
                            .style("font-family", "Orbitron, sans-serif");

                        // Tooltip
                        let tooltip = d3.select("#tree-map-buildingHeight").select(".tooltip");
                        if (tooltip.empty()) {
                            tooltip = d3.select("#tree-map-buildingHeight")
                                .append("div")
                                .attr("class", "tooltip")
                                .style("position", "absolute")
                                .style("background", "#222")
                                .style("color", "white")
                                .style("padding", "6px 10px")
                                .style("border", "1px solid #aaa")
                                .style("border-radius", "4px")
                                .style("pointer-events", "none")
                                .style("font-size", "13px")
                                .style("box-shadow", "2px 2px 6px rgba(0,0,0,0.2)")
                                .style("opacity", 0);
                        }

                        // rect
                        chartGroup.selectAll("rect")
                            .data(root.leaves())
                            .enter()
                            .append("rect")
                            .attr("x", d => d.x0)
                            .attr("y", d => d.y0-25)
                            .attr("width", d => d.x1 - d.x0)
                            .attr("height", d => d.y1 - d.y0)
                            .attr("fill", d => color(d.data.life))
                            .style("stroke", d => d.data.geoID === currentID ? "red" : "#173964")
                            .style("stroke-width", d => d.data.geoID === currentID ? 2 : 1)
                            .style("opacity",0.7)
                            .style("cursor", "pointer")
                            .on("mouseover", function(event,d){
                                tooltip.transition().duration(200).style("opacity", 1);
                                tooltip.html(
                                    `<strong>Life Expectancy:</strong> ${d.data.life.toFixed(1)} years<br>` +
                                    `<strong>Average Building Height:</strong> ${d.data.avr_height.toFixed(1)} feet<br>` +
                                    `<strong>Name:</strong> ${d.data.name}<br>`+
                                    `<strong>Census Tract:</strong> ${d.data.tract}`)
                            })
                            .on("mousemove", function (event) {
                                const [x, y] = d3.pointer(event, d3.select("#tree-map").node()); 

                                const tooltipWidth = 150;
                                const tooltipHeight = 50;

                                const svgRect = d3.select("#tree-map").node().getBoundingClientRect();

                                let left = x + 10;
                                let top = y - tooltipHeight + 660;

                                if (left + tooltipWidth > svgRect.width) {
                                    left = x - tooltipWidth - 10;
                                }
                                if (left < 0) left = 0;
                                tooltip
                                    .style("left", `${left}px`)
                                    .style("top", `${top}px`);
                                })
                            .on("mouseout", function () {
                                tooltip.transition().duration(300).style("opacity", 0);
                            });

                        // label
                        chartGroup.selectAll("text.label")
                            .data(root.leaves())
                            .enter()
                            .append("text")
                            .attr("class", "label")
                            .attr("x", d => d.x0 + 2)
                            .attr("y", d => d.y0 - 13)
                            .each(function(d) {
                                const id = d.data.id;
                                const tract = d.data.tract;
                                if (id && tract && d.x1 - d.x0 > 30 && d.y1 - d.y0 > 20) { 
                                    d3.select(this)
                                        .append("tspan")
                                        .attr("x", d.x0 + 4)
                                        .attr("dy", 0)
                                        .text(d => `BG${d.data.id}`);

                                    d3.select(this)
                                        .append("tspan")
                                        .attr("x", d.x0 + 4)
                                        .attr("dy", 8) 
                                        .text(tract);
                                }
                            }) 
                            .attr("font-size", "8.5px")
                            .attr("fill", "black")
                            .style("pointer-events", "none")
                            .style("font-family", "Orbitron, sans-serif");
                    });

// graphics
                    d3.select("#buildingHeight-legend").selectAll("*").remove();
                    const buildingHeightlegendSvg = d3.select("#buildingHeight-legend")
                        .append("svg")
                        .attr("width", 500)
                        .attr("height", 80);

                    buildingHeightlegendSvg.append("rect")
                        .attr("x", 0.5)
                        .attr("y", 13)
                        .attr("width", 60)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "#173964")
                        .style("stroke-width", 1);

                    buildingHeightlegendSvg.append("rect")
                        .attr("x", 146)
                        .attr("y", 13)
                        .attr("width", 90)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "#173964")
                        .style("stroke-width", 1);

                    buildingHeightlegendSvg.append("rect")
                        .attr("x", 302)
                        .attr("y", 13)
                        .attr("width", 50)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "red")
                        .style("stroke-width", 2);

                    buildingHeightlegendSvg.append("line")
                        .attr("x1", 75)
                        .attr("y1", 38)
                        .attr("x2", 132)
                        .attr("y2", 38)
                        .attr("stroke", "black")
                        .attr("stroke-width", 1.5)
                        .attr("marker-end", "url(#arrow)");

                    buildingHeightlegendSvg.append("defs").append("marker")
                        .attr("id", "arrow")
                        .attr("viewBox", "0 0 10 10")
                        .attr("refX", 5)
                        .attr("refY", 5)
                        .attr("markerWidth", 6)
                        .attr("markerHeight", 6)
                        .attr("orient", "auto-start-reverse")
                        .append("path")
                        .attr("d", "M 0 0 L 10 5 L 0 10 z")
                        .attr("fill", "black");

                    buildingHeightlegendSvg.append("text")
                        .attr("x", 0.5)
                        .attr("y", 8)
                        .text("Average Building Height:")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    buildingHeightlegendSvg.append("text")
                        .attr("x", 0.5)
                        .attr("y", 76)
                        .text("Low")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    buildingHeightlegendSvg.append("text")
                        .attr("x", 215)
                        .attr("y", 76)
                        .text("High")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    buildingHeightlegendSvg.append("text")
                        .attr("x", 290)
                        .attr("y", 76)
                        .text("Area Selected")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    buildingHeightlegendSvg.append("text")
                        .attr("x", 54)
                        .attr("y", 76)
                        .text("(Larger Size: Taller Building)")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "10px");

// Treemap-structureTime
                    d3.select("#tree-map-structureTime").selectAll("*").remove();

                    fetch('data/bg_with_neighborlife.geojson')
                        .then(response => response.json())
                        .then(data => {
                            const allFeatures = data.features;

                            const currentID = feature.properties.GEOID;

                            let neighborIDs = [];
                            if (feature.properties.neighbor_geoids) {
                                neighborIDs = feature.properties.neighbor_geoids
                                    .split(',')
                                    .map(d => d.trim());
                            }

                            const filtered = allFeatures.filter(d => {
                                const id = d.properties.GEOID;
                                return id === currentID || neighborIDs.includes(id);
                            });

                            const tractMap = d3.group(filtered, d => d.properties.TRACTCE);

                            const treemapData = {
                                name: "root",
                                children: Array.from(tractMap, ([tract, blockGroups]) => ({
                                    name: tract,
                                    children: blockGroups.map(d => ({
                                        id: d.properties.BLKGRPCE,
                                        tract: d.properties.TRACTCE,
                                        name: d.properties.NAMELSAD,
                                        value: d.properties['%early built'],
                                        life: d.properties['Life Expectancy'],
                                        early_built: d.properties['%early built'],
                                        geoID: d.properties.GEOID
                                    }))
                                }))
                            };

                            const root = d3.hierarchy(treemapData)
                                .sum(d => d.value) 
                                .sort((a, b) => b.value - a.value);

                            d3.treemap()
                                .size([width, height - margin.top-30]) 
                                .paddingInner(0)
                                .paddingOuter(1.5)
                                .paddingTop(1.5)(root); 
                            // color
                            const lifeExtent = d3.extent(filtered, d => d.properties['Life Expectancy']);
                            const thresholds = [75.9455, 77.5021, 78.6148, 79.4123, 80.1584, 81.0332, 81.9826, 83.0792, 84.5322];
                            const colors = ['#d7191c', '#e85b3b', '#f99d59', '#fec980', '#ffedaa',
                                        '#ecf7b9', '#c7e8ad', '#9dd3a6', '#64abb0', '#2b83ba'];
                            const color = d3.scaleThreshold()
                                .domain(thresholds)
                                .range(colors);

                            // SVG
                            const svg = d3.select("#tree-map-structureTime") 
                                .append("svg")
                                .attr("width", width)
                                .attr("height", height);

                            const chartGroup = svg.append("g")
                                .attr("transform", `translate(0, ${margin.top})`);
                            
                            // legend
                            const defs = svg.append("defs");

                            const linearGradient = defs.append("linearGradient")
                                .attr("id", "legend-gradient-structureTime")
                                .attr("x1", "0%")
                                .attr("x2", "100%")
                                .attr("y1", "0%")
                                .attr("y2", "0%");

                            const totalSteps = colors.length;
                            for (let i = 0; i < totalSteps; i++) {
                                const offset = (i / (totalSteps - 1)) * 100;
                                linearGradient.append("stop")
                                    .attr("offset", `${offset}%`)
                                    .attr("stop-color", colors[i]);
                            }

                            const legendWidth = 350;
                            const legendHeight = 15;
                            const legendX = 5;
                            const legendY = height-35; 

                            svg.append("rect")
                                .attr("x", legendX)
                                .attr("y", legendY)
                                .attr("width", legendWidth)
                                .attr("height", legendHeight)
                                .style("fill", "url(#legend-gradient-structureTime)")
                                .style("stroke", "#aaa")
                                .style("opacity",0.9)
                                .attr("ry", 3)
                                .attr("rx", 3)
                                .style("filter", "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))")
                                .style("stroke-width", 0.5);

                            svg.append("text")
                                .attr("x", legendX)
                                .attr("y", legendY+legendHeight+12)
                                .attr("text-anchor", "start")
                                .text("Low Life Expectancy")
                                .attr("font-size", "11px")
                                .attr("fill", "#333")
                                .style("font-family", "Orbitron, sans-serif");

                            svg.append("text")
                                .attr("x", legendX + legendWidth)
                                .attr("y", legendY+legendHeight+12)
                                .attr("text-anchor", "end")
                                .text("High Life Expectancy")
                                .attr("font-size", "11px")
                                .attr("fill", "#333")
                                .style("font-family", "Orbitron, sans-serif");

                            // Tooltip
                            let tooltip = d3.select("#tree-map-structureTime").select(".tooltip");
                            if (tooltip.empty()) {
                                tooltip = d3.select("#tree-map-structureTime")
                                    .append("div")
                                    .attr("class", "tooltip")
                                    .style("position", "absolute")
                                    .style("background", "#222")
                                    .style("color", "white")
                                    .style("padding", "6px 10px")
                                    .style("border", "1px solid #aaa")
                                    .style("border-radius", "4px")
                                    .style("pointer-events", "none")
                                    .style("font-size", "13px")
                                    .style("box-shadow", "2px 2px 6px rgba(0,0,0,0.2)")
                                    .style("opacity", 0);
                            }

                            // rect
                            chartGroup.selectAll("rect")
                                .data(root.leaves())
                                .enter()
                                .append("rect")
                                .attr("x", d => d.x0)
                                .attr("y", d => d.y0-25)
                                .attr("width", d => d.x1 - d.x0)
                                .attr("height", d => d.y1 - d.y0)
                                .attr("fill", d => color(d.data.life))
                                .style("stroke", d => d.data.geoID === currentID ? "red" : "#173964")
                                .style("stroke-width", d => d.data.geoID === currentID ? 2 : 1)
                                .style("opacity",0.7)
                                .style("cursor", "pointer")
                                .on("mouseover", function(event,d){
                                    tooltip.transition().duration(200).style("opacity", 1);
                                    tooltip.html(
                                        `<strong>Life Expectancy:</strong> ${d.data.life.toFixed(1)} years<br>` +
                                        `<strong>%Structure Built in Earlier Years:</strong> ${d.data.early_built}<br>` +
                                        `<strong>Name:</strong> ${d.data.name}<br>`+
                                        `<strong>Census Tract:</strong> ${d.data.tract}`)
                                })
                                .on("mousemove", function (event) {
                                    const [x, y] = d3.pointer(event, d3.select("#tree-map").node()); 

                                    const tooltipWidth = 150;
                                    const tooltipHeight = 50;

                                    const svgRect = d3.select("#tree-map").node().getBoundingClientRect();

                                    let left = x + 10;
                                    let top = y - tooltipHeight + 645;

                                    if (left + tooltipWidth > svgRect.width) {
                                        left = x - tooltipWidth - 10;
                                    }
                                    if (left < 0) left = 0;
                                    tooltip
                                        .style("left", `${left}px`)
                                        .style("top", `${top}px`);
                                    })
                                .on("mouseout", function () {
                                    tooltip.transition().duration(300).style("opacity", 0);
                                });

                            // label
                            chartGroup.selectAll("text.label")
                            .data(root.leaves())
                            .enter()
                            .append("text")
                            .attr("class", "label")
                            .attr("x", d => d.x0 + 2)
                            .attr("y", d => d.y0 - 13)
                            .each(function(d) {
                                const id = d.data.id;
                                const tract = d.data.tract;
                                if (id && tract && d.x1 - d.x0 > 30 && d.y1 - d.y0 > 20) { 
                                    d3.select(this)
                                        .append("tspan")
                                        .attr("x", d.x0 + 4)
                                        .attr("dy", 0)
                                        .text(d => `BG${d.data.id}`);

                                    d3.select(this)
                                        .append("tspan")
                                        .attr("x", d.x0 + 4)
                                        .attr("dy", 8) 
                                        .text(tract);
                                }
                            }) 
                            .attr("font-size", "8.5px")
                            .attr("fill", "black")
                            .style("pointer-events", "none")
                            .style("font-family", "Orbitron, sans-serif");
                    });

                    // graphics
                        d3.select("#structureTime-legend").selectAll("*").remove();
                        const structureTimelegendSvg = d3.select("#structureTime-legend")
                            .append("svg")
                            .attr("width", 500)
                            .attr("height", 80);

                        structureTimelegendSvg.append("rect")
                            .attr("x", 0.5)
                            .attr("y", 13)
                            .attr("width", 60)
                            .attr("height", 50)
                            .style("fill", "none")
                            .style("stroke", "#173964")
                            .style("stroke-width", 1);

                        structureTimelegendSvg.append("rect")
                            .attr("x", 146)
                            .attr("y", 13)
                            .attr("width", 90)
                            .attr("height", 50)
                            .style("fill", "none")
                            .style("stroke", "#173964")
                            .style("stroke-width", 1);

                        structureTimelegendSvg.append("rect")
                            .attr("x", 302)
                            .attr("y", 13)
                            .attr("width", 50)
                            .attr("height", 50)
                            .style("fill", "none")
                            .style("stroke", "red")
                            .style("stroke-width", 2);

                        structureTimelegendSvg.append("line")
                            .attr("x1", 75)
                            .attr("y1", 38)
                            .attr("x2", 132)
                            .attr("y2", 38)
                            .attr("stroke", "black")
                            .attr("stroke-width", 1.5)
                            .attr("marker-end", "url(#arrow)");

                        structureTimelegendSvg.append("defs").append("marker")
                            .attr("id", "arrow")
                            .attr("viewBox", "0 0 10 10")
                            .attr("refX", 5)
                            .attr("refY", 5)
                            .attr("markerWidth", 6)
                            .attr("markerHeight", 6)
                            .attr("orient", "auto-start-reverse")
                            .append("path")
                            .attr("d", "M 0 0 L 10 5 L 0 10 z")
                            .attr("fill", "black");

                        structureTimelegendSvg.append("text")
                            .attr("x", 0.5)
                            .attr("y", 8)
                            .text("%Structure Built in Earlier Years:")
                            .style("font-family", "Orbitron, sans-serif")
                            .style("font-size", "11px");

                        structureTimelegendSvg.append("text")
                            .attr("x", 0.5)
                            .attr("y", 76)
                            .text("Low")
                            .style("font-family", "Orbitron, sans-serif")
                            .style("font-size", "11px");

                        structureTimelegendSvg.append("text")
                            .attr("x", 215)
                            .attr("y", 76)
                            .text("High")
                            .style("font-family", "Orbitron, sans-serif")
                            .style("font-size", "11px");

                        structureTimelegendSvg.append("text")
                            .attr("x", 290)
                            .attr("y", 76)
                            .text("Area Selected")
                            .style("font-family", "Orbitron, sans-serif")
                            .style("font-size", "11px");

                        structureTimelegendSvg.append("text")
                            .attr("x", 54)
                            .attr("y", 76)
                            .text("(Larger Size: Higher Ratio)")
                            .style("font-family", "Orbitron, sans-serif")
                            .style("font-size", "10px");

// treemap-income
                d3.select("#tree-map-income").selectAll("*").remove();

                fetch('data/bg_with_neighborlife.geojson')
                    .then(response => response.json())
                    .then(data => {
                        const allFeatures = data.features;

                        const currentID = feature.properties.GEOID;

                        let neighborIDs = [];
                        if (feature.properties.neighbor_geoids) {
                            neighborIDs = feature.properties.neighbor_geoids
                                .split(',')
                                .map(d => d.trim());
                        }

                        const filtered = allFeatures.filter(d => {
                            const id = d.properties.GEOID;
                            return id === currentID || neighborIDs.includes(id);
                        });

                        const tractMap = d3.group(filtered, d => d.properties.TRACTCE);

                        const treemapData = {
                            name: "root",
                            children: Array.from(tractMap, ([tract, blockGroups]) => ({
                                name: tract,
                                children: blockGroups.map(d => ({
                                    id: d.properties.BLKGRPCE,
                                    tract: d.properties.TRACTCE,
                                    name: d.properties.NAMELSAD,
                                    value: d.properties['per capita income'],
                                    life: d.properties['Life Expectancy'],
                                    income: d.properties['per capita income'],
                                    geoID: d.properties.GEOID
                                }))
                            }))
                        };

                        const root = d3.hierarchy(treemapData)
                            .sum(d => d.value) 
                            .sort((a, b) => b.value - a.value);

                        d3.treemap()
                            .size([width, height - margin.top-30]) 
                            .paddingInner(0)
                            .paddingOuter(1.5)
                            .paddingTop(1.5)(root); 
                        // color
                        const lifeExtent = d3.extent(filtered, d => d.properties['Life Expectancy']);
                        const thresholds = [75.9455, 77.5021, 78.6148, 79.4123, 80.1584, 81.0332, 81.9826, 83.0792, 84.5322];
                        const colors = ['#d7191c', '#e85b3b', '#f99d59', '#fec980', '#ffedaa',
                                    '#ecf7b9', '#c7e8ad', '#9dd3a6', '#64abb0', '#2b83ba'];
                        const color = d3.scaleThreshold()
                            .domain(thresholds)
                            .range(colors);

                        // SVG
                        const svg = d3.select("#tree-map-income")
                            .append("svg")
                            .attr("width", width)
                            .attr("height", height);

                        const chartGroup = svg.append("g")
                            .attr("transform", `translate(0, ${margin.top})`);
                        
                        // legend
                        const defs = svg.append("defs");

                        const linearGradient = defs.append("linearGradient")
                            .attr("id", "legend-gradient-income")
                            .attr("x1", "0%")
                            .attr("x2", "100%")
                            .attr("y1", "0%")
                            .attr("y2", "0%");

                        const totalSteps = colors.length;
                        for (let i = 0; i < totalSteps; i++) {
                            const offset = (i / (totalSteps - 1)) * 100;
                            linearGradient.append("stop")
                                .attr("offset", `${offset}%`)
                                .attr("stop-color", colors[i]);
                        }

                        const legendWidth = 350;
                        const legendHeight = 15;
                        const legendX = 5;
                        const legendY = height-35; 

                        svg.append("rect")
                            .attr("x", legendX)
                            .attr("y", legendY)
                            .attr("width", legendWidth)
                            .attr("height", legendHeight)
                            .style("fill", "url(#legend-gradient-income)")
                            .style("stroke", "#aaa")
                            .style("opacity",0.9)
                            .attr("ry", 3)
                            .attr("rx", 3)
                            .style("filter", "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))")
                            .style("stroke-width", 0.5);

                        svg.append("text")
                            .attr("x", legendX)
                            .attr("y", legendY+legendHeight+12)
                            .attr("text-anchor", "start")
                            .text("Low Life Expectancy")
                            .attr("font-size", "11px")
                            .attr("fill", "#333")
                            .style("font-family", "Orbitron, sans-serif");

                        svg.append("text")
                            .attr("x", legendX + legendWidth)
                            .attr("y", legendY+legendHeight+12)
                            .attr("text-anchor", "end")
                            .text("High Life Expectancy")
                            .attr("font-size", "11px")
                            .attr("fill", "#333")
                            .style("font-family", "Orbitron, sans-serif");

                        // Tooltip
                        let tooltip = d3.select("#tree-map-income").select(".tooltip");
                        if (tooltip.empty()) {
                            tooltip = d3.select("#tree-map-income")
                                .append("div")
                                .attr("class", "tooltip")
                                .style("position", "absolute")
                                .style("background", "#222")
                                .style("color", "white")
                                .style("padding", "6px 10px")
                                .style("border", "1px solid #aaa")
                                .style("border-radius", "4px")
                                .style("pointer-events", "none")
                                .style("font-size", "13px")
                                .style("box-shadow", "2px 2px 6px rgba(0,0,0,0.2)")
                                .style("opacity", 0);
                        }

                        // rect
                        chartGroup.selectAll("rect")
                            .data(root.leaves())
                            .enter()
                            .append("rect")
                            .attr("x", d => d.x0)
                            .attr("y", d => d.y0-25)
                            .attr("width", d => d.x1 - d.x0)
                            .attr("height", d => d.y1 - d.y0)
                            .attr("fill", d => color(d.data.life))
                            .style("stroke", d => d.data.geoID === currentID ? "red" : "#173964")
                            .style("stroke-width", d => d.data.geoID === currentID ? 2 : 1)
                            .style("opacity",0.7)
                            .style("cursor", "pointer")
                            .on("mouseover", function(event,d){
                                tooltip.transition().duration(200).style("opacity", 1);
                                tooltip.html(
                                    `<strong>Life Expectancy:</strong> ${d.data.life.toFixed(1)} years<br>` +
                                    `<strong>Per Capita Income:</strong> ${d.data.income.toFixed(1)} dollars per year<br>` +
                                    `<strong>Name:</strong> ${d.data.name}<br>`+
                                    `<strong>Census Tract:</strong> ${d.data.tract}`
                                )
                            })
                            .on("mousemove", function (event) {
                                const [x, y] = d3.pointer(event, d3.select("#tree-map").node()); 

                                const tooltipWidth = 150;
                                const tooltipHeight = 50;

                                const svgRect = d3.select("#tree-map").node().getBoundingClientRect();

                                let left = x + 10;
                                let top = y - tooltipHeight + 640;

                                if (left + tooltipWidth > svgRect.width) {
                                    left = x - tooltipWidth - 10;
                                }
                                if (left < 0) left = 0;
                                tooltip
                                    .style("left", `${left}px`)
                                    .style("top", `${top}px`);
                            })
                            .on("mouseout", function () {
                                tooltip.transition().duration(300).style("opacity", 0);
                            });

                        // label
                        chartGroup.selectAll("text.label")
                            .data(root.leaves())
                            .enter()
                            .append("text")
                            .attr("class", "label")
                            .attr("x", d => d.x0 + 2)
                            .attr("y", d => d.y0 - 13)
                            .each(function(d) {
                                const id = d.data.id;
                                const tract = d.data.tract;
                                if (id && tract && d.x1 - d.x0 > 30 && d.y1 - d.y0 > 20) { 
                                    d3.select(this)
                                        .append("tspan")
                                        .attr("x", d.x0 + 4)
                                        .attr("dy", 0)
                                        .text(d => `BG${d.data.id}`);

                                    d3.select(this)
                                        .append("tspan")
                                        .attr("x", d.x0 + 4)
                                        .attr("dy", 8) 
                                        .text(tract);
                                }
                            }) 
                            .attr("font-size", "8.5px")
                            .attr("fill", "black")
                            .style("pointer-events", "none")
                            .style("font-family", "Orbitron, sans-serif");
                    });

// graphics
                    d3.select("#income-legend").selectAll("*").remove();
                    const incomelegendSvg = d3.select("#income-legend")
                        .append("svg")
                        .attr("width", 500)
                        .attr("height", 80);

                    incomelegendSvg.append("rect")
                        .attr("x", 0.5)
                        .attr("y", 13)
                        .attr("width", 60)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "#173964")
                        .style("stroke-width", 1);

                    incomelegendSvg.append("rect")
                        .attr("x", 146)
                        .attr("y", 13)
                        .attr("width", 90)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "#173964")
                        .style("stroke-width", 1);

                    incomelegendSvg.append("rect")
                        .attr("x", 302)
                        .attr("y", 13)
                        .attr("width", 50)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "red")
                        .style("stroke-width", 2);

                    incomelegendSvg.append("line")
                        .attr("x1", 75)
                        .attr("y1", 38)
                        .attr("x2", 132)
                        .attr("y2", 38)
                        .attr("stroke", "black")
                        .attr("stroke-width", 1.5)
                        .attr("marker-end", "url(#arrow)");

                    incomelegendSvg.append("defs").append("marker")
                        .attr("id", "arrow")
                        .attr("viewBox", "0 0 10 10")
                        .attr("refX", 5)
                        .attr("refY", 5)
                        .attr("markerWidth", 6)
                        .attr("markerHeight", 6)
                        .attr("orient", "auto-start-reverse")
                        .append("path")
                        .attr("d", "M 0 0 L 10 5 L 0 10 z")
                        .attr("fill", "black");

                    incomelegendSvg.append("text")
                        .attr("x", 0.5)
                        .attr("y", 8)
                        .text("Per Capita Income:")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    incomelegendSvg.append("text")
                        .attr("x", 0.5)
                        .attr("y", 76)
                        .text("Low")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    incomelegendSvg.append("text")
                        .attr("x", 215)
                        .attr("y", 76)
                        .text("High")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    incomelegendSvg.append("text")
                        .attr("x", 290)
                        .attr("y", 76)
                        .text("Area Selected")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    incomelegendSvg.append("text")
                        .attr("x", 55)
                        .attr("y", 76)
                        .text("(Larger Size: Higher income)")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "10px");

// Treemap-education
                d3.select("#tree-map-edu").selectAll("*").remove();

                fetch('data/bg_with_neighborlife.geojson')
                    .then(response => response.json())
                    .then(data => {
                        const allFeatures = data.features;

                        const currentID = feature.properties.GEOID;

                        let neighborIDs = [];
                        if (feature.properties.neighbor_geoids) {
                            neighborIDs = feature.properties.neighbor_geoids
                                .split(',')
                                .map(d => d.trim());
                        }

                        const filtered = allFeatures.filter(d => {
                            const id = d.properties.GEOID;
                            return id === currentID || neighborIDs.includes(id);
                        });

                        const tractMap = d3.group(filtered, d => d.properties.TRACTCE);

                        const treemapData = {
                            name: "root",
                            children: Array.from(tractMap, ([tract, blockGroups]) => ({
                                name: tract,
                                children: blockGroups.map(d => ({
                                    id: d.properties.BLKGRPCE,
                                    tract: d.properties.TRACTCE,
                                    name: d.properties.NAMELSAD,
                                    value: d.properties['less than high school'] || 0.002 ,
                                    life: d.properties['Life Expectancy'],
                                    edu: d.properties['less than high school'],
                                    geoID: d.properties.GEOID
                                }))
                            }))
                        };

                        const root = d3.hierarchy(treemapData)
                            .sum(d => d.value) 
                            .sort((a, b) => b.value - a.value);

                        d3.treemap()
                            .size([width, height - margin.top-30]) 
                            .paddingInner(0)
                            .paddingOuter(1.5)
                            .paddingTop(1.5)(root); 
                        // color
                        const lifeExtent = d3.extent(filtered, d => d.properties['Life Expectancy']);
                        const thresholds = [75.9455, 77.5021, 78.6148, 79.4123, 80.1584, 81.0332, 81.9826, 83.0792, 84.5322];
                        const colors = ['#d7191c', '#e85b3b', '#f99d59', '#fec980', '#ffedaa',
                                    '#ecf7b9', '#c7e8ad', '#9dd3a6', '#64abb0', '#2b83ba'];
                        const color = d3.scaleThreshold()
                            .domain(thresholds)
                            .range(colors);

                        // SVG
                        const svg = d3.select("#tree-map-edu") 
                            .append("svg")
                            .attr("width", width)
                            .attr("height", height);

                        const chartGroup = svg.append("g")
                            .attr("transform", `translate(0, ${margin.top})`);
                        
                        // legend
                        const defs = svg.append("defs");

                        const linearGradient = defs.append("linearGradient")
                            .attr("id", "legend-gradient-edu")
                            .attr("x1", "0%")
                            .attr("x2", "100%")
                            .attr("y1", "0%")
                            .attr("y2", "0%");

                        const totalSteps = colors.length;
                        for (let i = 0; i < totalSteps; i++) {
                            const offset = (i / (totalSteps - 1)) * 100;
                            linearGradient.append("stop")
                                .attr("offset", `${offset}%`)
                                .attr("stop-color", colors[i]);
                        }

                        const legendWidth = 350;
                        const legendHeight = 15;
                        const legendX = 5;
                        const legendY = height-35; 

                        svg.append("rect")
                            .attr("x", legendX)
                            .attr("y", legendY)
                            .attr("width", legendWidth)
                            .attr("height", legendHeight)
                            .style("fill", "url(#legend-gradient-edu)")
                            .style("stroke", "#aaa")
                            .style("opacity",0.9)
                            .attr("ry", 3)
                            .attr("rx", 3)
                            .style("filter", "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))")
                            .style("stroke-width", 0.5);

                        svg.append("text")
                            .attr("x", legendX)
                            .attr("y", legendY+legendHeight+12)
                            .attr("text-anchor", "start")
                            .text("Low Life Expectancy")
                            .attr("font-size", "11px")
                            .attr("fill", "#333")
                            .style("font-family", "Orbitron, sans-serif");

                        svg.append("text")
                            .attr("x", legendX + legendWidth)
                            .attr("y", legendY+legendHeight+12)
                            .attr("text-anchor", "end")
                            .text("High Life Expectancy")
                            .attr("font-size", "11px")
                            .attr("fill", "#333")
                            .style("font-family", "Orbitron, sans-serif");

                        // Tooltip
                        let tooltip = d3.select("#tree-map-edu").select(".tooltip");
                        if (tooltip.empty()) {
                            tooltip = d3.select("#tree-map-edu")
                                .append("div")
                                .attr("class", "tooltip")
                                .style("position", "absolute")
                                .style("background", "#222")
                                .style("color", "white")
                                .style("padding", "6px 10px")
                                .style("border", "1px solid #aaa")
                                .style("border-radius", "4px")
                                .style("pointer-events", "none")
                                .style("font-size", "13px")
                                .style("box-shadow", "2px 2px 6px rgba(0,0,0,0.2)")
                                .style("opacity", 0);
                        }

                        // rect
                        chartGroup.selectAll("rect")
                            .data(root.leaves())
                            .enter()
                            .append("rect")
                            .attr("x", d => d.x0)
                            .attr("y", d => d.y0-25)
                            .attr("width", d => d.x1 - d.x0)
                            .attr("height", d => d.y1 - d.y0)
                            .attr("fill", d => color(d.data.life))
                            .style("stroke", d => d.data.geoID === currentID ? "red" : "#173964")
                            .style("stroke-width", d => d.data.geoID === currentID ? 2 : 1)
                            .style("opacity",0.7)
                            .style("cursor", "pointer")
                            .on("mouseover", function(event,d){
                                tooltip.transition().duration(200).style("opacity", 1);
                                tooltip.html(
                                    `<strong>Life Expectancy:</strong> ${d.data.life.toFixed(1)} years<br>` +
                                    `<strong>%Less Than High School:</strong> ${d.data.edu}<br>` +
                                    `<strong>Name:</strong> ${d.data.name}<br>`+
                                    `<strong>Census Tract:</strong> ${d.data.tract}`
                                )
                            })
                            .on("mousemove", function (event) {
                                const [x, y] = d3.pointer(event, d3.select("#tree-map").node()); 

                                const tooltipWidth = 150;
                                const tooltipHeight = 50;

                                const svgRect = d3.select("#tree-map").node().getBoundingClientRect();

                                let left = x + 10;
                                let top = y - tooltipHeight + 640;

                                if (left + tooltipWidth > svgRect.width) {
                                    left = x - tooltipWidth - 10;
                                }
                                if (left < 0) left = 0;
                                tooltip
                                    .style("left", `${left}px`)
                                    .style("top", `${top}px`);
                            })
                            .on("mouseout", function () {
                                tooltip.transition().duration(300).style("opacity", 0);
                            });

                        // label
                        chartGroup.selectAll("text.label")
                            .data(root.leaves())
                            .enter()
                            .append("text")
                            .attr("class", "label")
                            .attr("x", d => d.x0 + 2)
                            .attr("y", d => d.y0 - 13)
                            .each(function(d) {
                                const id = d.data.id;
                                const tract = d.data.tract;
                                if (id && tract && d.x1 - d.x0 > 30 && d.y1 - d.y0 > 20) { 
                                    d3.select(this)
                                        .append("tspan")
                                        .attr("x", d.x0 + 4)
                                        .attr("dy", 0)
                                        .text(d => `BG${d.data.id}`);

                                    d3.select(this)
                                        .append("tspan")
                                        .attr("x", d.x0 + 4)
                                        .attr("dy", 8) 
                                        .text(tract);
                                }
                            }) 
                            .attr("font-size", "8.5px")
                            .attr("fill", "black")
                            .style("pointer-events", "none")
                            .style("font-family", "Orbitron, sans-serif");
                    });

// graphics
                    d3.select("#edu-legend").selectAll("*").remove();
                    const edulegendSvg = d3.select("#edu-legend")
                        .append("svg")
                        .attr("width", 500)
                        .attr("height", 80);

                    edulegendSvg.append("rect")
                        .attr("x", 0.5)
                        .attr("y", 13)
                        .attr("width", 60)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "#173964")
                        .style("stroke-width", 1);

                    edulegendSvg.append("rect")
                        .attr("x", 146)
                        .attr("y", 13)
                        .attr("width", 90)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "#173964")
                        .style("stroke-width", 1);

                    edulegendSvg.append("rect")
                        .attr("x", 302)
                        .attr("y", 13)
                        .attr("width", 50)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "red")
                        .style("stroke-width", 2);

                    edulegendSvg.append("line")
                        .attr("x1", 75)
                        .attr("y1", 38)
                        .attr("x2", 132)
                        .attr("y2", 38)
                        .attr("stroke", "black")
                        .attr("stroke-width", 1.5)
                        .attr("marker-end", "url(#arrow)");

                    edulegendSvg.append("defs").append("marker")
                        .attr("id", "arrow")
                        .attr("viewBox", "0 0 10 10")
                        .attr("refX", 5)
                        .attr("refY", 5)
                        .attr("markerWidth", 6)
                        .attr("markerHeight", 6)
                        .attr("orient", "auto-start-reverse")
                        .append("path")
                        .attr("d", "M 0 0 L 10 5 L 0 10 z")
                        .attr("fill", "black");

                    edulegendSvg.append("text")
                        .attr("x", 0.5)
                        .attr("y", 8)
                        .text("% Less Than High School:")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    edulegendSvg.append("text")
                        .attr("x", 0.5)
                        .attr("y", 76)
                        .text("Low")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    edulegendSvg.append("text")
                        .attr("x", 215)
                        .attr("y", 76)
                        .text("High")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    edulegendSvg.append("text")
                        .attr("x", 290)
                        .attr("y", 76)
                        .text("Area Selected")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    edulegendSvg.append("text")
                        .attr("x", 55)
                        .attr("y", 76)
                        .text("(Larger Size: Higher Ratio)")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "10px");

// Treemap-rent
                d3.select("#tree-map-rent").selectAll("*").remove();

                fetch('data/bg_with_neighborlife.geojson')
                    .then(response => response.json())
                    .then(data => {
                        const allFeatures = data.features;

                        const currentID = feature.properties.GEOID;

                        let neighborIDs = [];
                        if (feature.properties.neighbor_geoids) {
                            neighborIDs = feature.properties.neighbor_geoids
                                .split(',')
                                .map(d => d.trim());
                        }

                        const filtered = allFeatures.filter(d => {
                            const id = d.properties.GEOID;
                            return id === currentID || neighborIDs.includes(id);
                        });

                        const tractMap = d3.group(filtered, d => d.properties.TRACTCE);

                        const treemapData = {
                            name: "root",
                            children: Array.from(tractMap, ([tract, blockGroups]) => ({
                                name: tract,
                                children: blockGroups.map(d => ({
                                    id: d.properties.BLKGRPCE,
                                    tract: d.properties.TRACTCE,
                                    name: d.properties.NAMELSAD,
                                    value: d.properties['rent'],
                                    life: d.properties['Life Expectancy'],
                                    rent: d.properties['rent'],
                                    geoID: d.properties.GEOID
                                }))
                            }))
                        };

                        const root = d3.hierarchy(treemapData)
                            .sum(d => d.value) 
                            .sort((a, b) => b.value - a.value);

                        d3.treemap()
                            .size([width, height - margin.top-30]) 
                            .paddingInner(0)
                            .paddingOuter(1.5)
                            .paddingTop(1.5)(root); 
                        // color
                        const lifeExtent = d3.extent(filtered, d => d.properties['Life Expectancy']);
                        const thresholds = [75.9455, 77.5021, 78.6148, 79.4123, 80.1584, 81.0332, 81.9826, 83.0792, 84.5322];
                        const colors = ['#d7191c', '#e85b3b', '#f99d59', '#fec980', '#ffedaa',
                                    '#ecf7b9', '#c7e8ad', '#9dd3a6', '#64abb0', '#2b83ba'];
                        const color = d3.scaleThreshold()
                            .domain(thresholds)
                            .range(colors);

                        // SVG
                        const svg = d3.select("#tree-map-rent") 
                            .append("svg")
                            .attr("width", width)
                            .attr("height", height);

                        const chartGroup = svg.append("g")
                            .attr("transform", `translate(0, ${margin.top})`);
                        
                        // legend
                        const defs = svg.append("defs");

                        const linearGradient = defs.append("linearGradient")
                            .attr("id", "legend-gradient-rent")
                            .attr("x1", "0%")
                            .attr("x2", "100%")
                            .attr("y1", "0%")
                            .attr("y2", "0%");

                        const totalSteps = colors.length;
                        for (let i = 0; i < totalSteps; i++) {
                            const offset = (i / (totalSteps - 1)) * 100;
                            linearGradient.append("stop")
                                .attr("offset", `${offset}%`)
                                .attr("stop-color", colors[i]);
                        }

                        const legendWidth = 350;
                        const legendHeight = 15;
                        const legendX = 5;
                        const legendY = height-35; 

                        svg.append("rect")
                            .attr("x", legendX)
                            .attr("y", legendY)
                            .attr("width", legendWidth)
                            .attr("height", legendHeight)
                            .style("fill", "url(#legend-gradient-rent)")
                            .style("stroke", "#aaa")
                            .style("opacity",0.9)
                            .attr("ry", 3)
                            .attr("rx", 3)
                            .style("filter", "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))")
                            .style("stroke-width", 0.5);

                        svg.append("text")
                            .attr("x", legendX)
                            .attr("y", legendY+legendHeight+12)
                            .attr("text-anchor", "start")
                            .text("Low Life Expectancy")
                            .attr("font-size", "11px")
                            .attr("fill", "#333")
                            .style("font-family", "Orbitron, sans-serif");

                        svg.append("text")
                            .attr("x", legendX + legendWidth)
                            .attr("y", legendY+legendHeight+12)
                            .attr("text-anchor", "end")
                            .text("High Life Expectancy")
                            .attr("font-size", "11px")
                            .attr("fill", "#333")
                            .style("font-family", "Orbitron, sans-serif");

                        // Tooltip
                        let tooltip = d3.select("#tree-map-rent").select(".tooltip");
                        if (tooltip.empty()) {
                            tooltip = d3.select("#tree-map-rent")
                                .append("div")
                                .attr("class", "tooltip")
                                .style("position", "absolute")
                                .style("background", "#222")
                                .style("color", "white")
                                .style("padding", "6px 10px")
                                .style("border", "1px solid #aaa")
                                .style("border-radius", "4px")
                                .style("pointer-events", "none")
                                .style("font-size", "13px")
                                .style("box-shadow", "2px 2px 6px rgba(0,0,0,0.2)")
                                .style("opacity", 0);
                        }

                        // rect
                        chartGroup.selectAll("rect")
                            .data(root.leaves())
                            .enter()
                            .append("rect")
                            .attr("x", d => d.x0)
                            .attr("y", d => d.y0-25)
                            .attr("width", d => d.x1 - d.x0)
                            .attr("height", d => d.y1 - d.y0)
                            .attr("fill", d => color(d.data.life))
                            .style("stroke", d => d.data.geoID === currentID ? "red" : "#173964")
                            .style("stroke-width", d => d.data.geoID === currentID ? 2 : 1)
                            .style("opacity",0.7)
                            .style("cursor", "pointer")
                            .on("mouseover", function(event,d){
                                tooltip.transition().duration(200).style("opacity", 1);
                                tooltip.html(
                                    `<strong>Life Expectancy:</strong> ${d.data.life.toFixed(1)} years<br>` +
                                    `<strong>Rent:</strong> ${d.data.rent} per year<br>` +
                                    `<strong>Name:</strong> ${d.data.name}<br>`+
                                    `<strong>Census Tract:</strong> ${d.data.tract}`
                                )
                            })
                            .on("mousemove", function (event) {
                                const [x, y] = d3.pointer(event, d3.select("#tree-map").node()); 

                                const tooltipWidth = 150;
                                const tooltipHeight = 50;

                                const svgRect = d3.select("#tree-map").node().getBoundingClientRect();

                                let left = x + 10;
                                let top = y - tooltipHeight + 635;

                                if (left + tooltipWidth > svgRect.width) {
                                    left = x - tooltipWidth - 10;
                                }
                                if (left < 0) left = 0;
                                tooltip
                                    .style("left", `${left}px`)
                                    .style("top", `${top}px`);
                            })
                            .on("mouseout", function () {
                                tooltip.transition().duration(300).style("opacity", 0);
                            });

                        // label
                        chartGroup.selectAll("text.label")
                            .data(root.leaves())
                            .enter()
                            .append("text")
                            .attr("class", "label")
                            .attr("x", d => d.x0 + 2)
                            .attr("y", d => d.y0 - 13)
                            .each(function(d) {
                                const id = d.data.id;
                                const tract = d.data.tract;
                                if (id && tract && d.x1 - d.x0 > 30 && d.y1 - d.y0 > 20) { 
                                    d3.select(this)
                                        .append("tspan")
                                        .attr("x", d.x0 + 4)
                                        .attr("dy", 0)
                                        .text(d => `BG${d.data.id}`);

                                    d3.select(this)
                                        .append("tspan")
                                        .attr("x", d.x0 + 4)
                                        .attr("dy", 8) 
                                        .text(tract);
                                }
                            }) 
                            .attr("font-size", "8.5px")
                            .attr("fill", "black")
                            .style("pointer-events", "none")
                            .style("font-family", "Orbitron, sans-serif");
                    });

                // graphics
                    d3.select("#rent-legend").selectAll("*").remove();
                    const rentlegendSvg = d3.select("#rent-legend")
                        .append("svg")
                        .attr("width", 500)
                        .attr("height", 80);

                    rentlegendSvg.append("rect")
                        .attr("x", 0.5)
                        .attr("y", 13)
                        .attr("width", 60)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "#173964")
                        .style("stroke-width", 1);

                    rentlegendSvg.append("rect")
                        .attr("x", 146)
                        .attr("y", 13)
                        .attr("width", 90)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "#173964")
                        .style("stroke-width", 1);

                    rentlegendSvg.append("rect")
                        .attr("x", 302)
                        .attr("y", 13)
                        .attr("width", 50)
                        .attr("height", 50)
                        .style("fill", "none")
                        .style("stroke", "red")
                        .style("stroke-width", 2);

                    rentlegendSvg.append("line")
                        .attr("x1", 75)
                        .attr("y1", 38)
                        .attr("x2", 132)
                        .attr("y2", 38)
                        .attr("stroke", "black")
                        .attr("stroke-width", 1.5)
                        .attr("marker-end", "url(#arrow)");

                    rentlegendSvg.append("defs").append("marker")
                        .attr("id", "arrow")
                        .attr("viewBox", "0 0 10 10")
                        .attr("refX", 5)
                        .attr("refY", 5)
                        .attr("markerWidth", 6)
                        .attr("markerHeight", 6)
                        .attr("orient", "auto-start-reverse")
                        .append("path")
                        .attr("d", "M 0 0 L 10 5 L 0 10 z")
                        .attr("fill", "black");

                    rentlegendSvg.append("text")
                        .attr("x", 0.5)
                        .attr("y", 8)
                        .text("Rent:")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    rentlegendSvg.append("text")
                        .attr("x", 0.5)
                        .attr("y", 76)
                        .text("Low")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    rentlegendSvg.append("text")
                        .attr("x", 215)
                        .attr("y", 76)
                        .text("High")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    rentlegendSvg.append("text")
                        .attr("x", 290)
                        .attr("y", 76)
                        .text("Area Selected")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "11px");

                    rentlegendSvg.append("text")
                        .attr("x", 55)
                        .attr("y", 76)
                        .text("(Larger Size: Higher Rent)")
                        .style("font-family", "Orbitron, sans-serif")
                        .style("font-size", "10px");

                    document.getElementById('info-panel').style.display = "block";
                }

