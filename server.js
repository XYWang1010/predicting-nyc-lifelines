import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://xywang1010.github.io');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
const corsOptions = {
  origin: 'https://xywang1010.github.io',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

function analyzeLifeExpectancy(value, name, tract, geoID, geojson, neighbor_geoids) {
    const lifeExpectancy = value;
    const neighborIDs = neighbor_geoids
        ? neighbor_geoids.split(',').map(id => id.trim())
        : [];

    const neighbors = geojson.features.filter(f =>
        neighborIDs.includes(f.properties.GEOID)
    );

    const neighborLEs = neighbors
        .map(f => f.properties['Life Expectancy'])
        .filter(v => typeof v === 'number');

        function findIQRBounds(values) {
            const sorted = values.slice().sort((a, b) => a - b);
            const q1 = quantile(sorted, 0.25);
            const q3 = quantile(sorted, 0.75);
            const iqr = q3 - q1;
        
            const lowerBound = q1 - 1.5 * iqr;
            const upperBound = q3 + 1.5 * iqr;
        
            return { lowerBound, upperBound, q1, q3 };
        }
        
        function quantile(sortedArr, q) {
            const pos = (sortedArr.length - 1) * q;
            const base = Math.floor(pos);
            const rest = pos - base;
        
            if (sortedArr[base + 1] !== undefined) {
                return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
            } else {
                return sortedArr[base];
            }
        }        

    const total = neighborLEs.length;
    const allLEs = [lifeExpectancy, ...neighborLEs];
    const meanLE = allLEs.reduce((sum, val) => sum + val, 0) / allLEs.length;
    const stdLE = Math.sqrt(allLEs.reduce((sum, val) => sum + Math.pow(val - meanLE, 2), 0) / allLEs.length);
    const { lowerBound, upperBound } = findIQRBounds(allLEs);

    const All = [
        {
            type: 'Feature',
            properties: {
                'Life Expectancy': lifeExpectancy,
                NAMELSAD: name,
                TRACTCE: tract,
                GEOID: geoID
            },
            isCurrent: true
        },
        ...neighbors.map(f => ({ ...f, isCurrent: false }))
    ];

    const abnormalFeatures = All.filter(f => {
        const le = f.properties['Life Expectancy'];
        return typeof le === 'number' && (le < lowerBound || le > upperBound);
    });

    const countHigher = neighborLEs.filter(n => lifeExpectancy > n).length;
    const countLower = neighborLEs.filter(n => lifeExpectancy < n).length;

    return {
        lifeExpectancy,
        neighborLEs,
        neighbors,
        total,
        meanLE,
        stdLE,
        countHigher,
        countLower,
        proportionHigher: ((countHigher / total) * 100).toFixed(0),
        proportionLower: ((countLower / total) * 100).toFixed(0),
        abnormalFeatures
    };
}

app.post('/api/generate', async (req, res) => {
    const {
        section,
        name,
        tract,
        value,
        geoID,
        neighbor_geoids
    } = req.body;

let prompt = '';


try {
    const geojsonPath = path.join(__dirname, 'data', 'bg_with_neighborlife.geojson');
    const rawData = fs.readFileSync(geojsonPath, 'utf8');
    const geojson = JSON.parse(rawData);

    let leAnalysis = null;

    if (section === 'life' || section === 'tree' || section === 'air' || section === 'buildingHeight' || section === 'income' || section === 'edu' || section === 'rent' || section === 'structureTime') {
        const currentFeature = geojson.features.find(f => f.properties.GEOID === geoID);
        const realLE = currentFeature?.properties?.['Life Expectancy'];
        if (typeof realLE === 'number') {
            leAnalysis = analyzeLifeExpectancy(realLE, name, tract, geoID, geojson, neighbor_geoids);
        }
    }

// life expectancy
    if (section === 'life'){
        if (leAnalysis.total > 0) {

        let abnormalNote = '';
        if (leAnalysis.abnormalFeatures.length > 0) {
            const lines = leAnalysis.abnormalFeatures.map(f => {
                const name = f.properties.NAMELSAD;
                const tract = f.properties.TRACTCE;
                const le = f.properties['Life Expectancy'].toFixed(1);
                const note = f.isCurrent
                    ? `This block group (${name}, Tract ${tract}) is an outlier with ${le} years.`
                    : `Neighbor ${name} (Tract ${tract}) is an outlier with ${le} years.`;
                return note;
            });
            abnormalNote = lines.join(' ');
        }else{
            abnormalNote = 'No outlier block groups.';
        }

        prompt = `
    The average life expectancy of New York city is 80.332 years. Compare the average life expectancy of New York city with ${leAnalysis.lifeExpectancy.toFixed(1)} years. 
    Among ${leAnalysis.total} neighbors, ${leAnalysis.countHigher} (${leAnalysis.proportionHigher}%) are lower, and ${leAnalysis.countLower} (${leAnalysis.proportionLower}%) are higher.

    ${abnormalNote}
    Please output two paragraphs:
    1. Write a concise paragraph (1 sentence, no more than 50 words) summarizing the block group's life expectancy.
    2. Be sure to mention any listed outlier block groups with unusually high or low values.
        `.trim();
        } else {
        prompt = `
    This block group is in New York City.
    Its life expectancy is ${leAnalysis.lifeExpectancy.toFixed(1)} years.
    The NYC average is 80.701 years.
    Please generate a short analysis of what this might imply.
    Limit response to 50–100 characters.
        `.trim();
        }
    }
// tree density
    else if(section === 'tree'){
        const treeDensity = value; 
        const treeDensityStr = `${treeDensity} per km²`;
        const le = leAnalysis?.lifeExpectancy?.toFixed(1);
        const avgLE = leAnalysis?.meanLE?.toFixed(1);
        const neighborTDs = leAnalysis.neighbors
            .map(f => f.properties['tree_density'])
            .filter(v => typeof v === 'number');
        const allTDs = [treeDensity, ...neighborTDs];
        const meanTD = allTDs.reduce((sum, val) => sum + val, 0) / allTDs.length;
        const treeDiffRatio = (meanTD - treeDensity) / meanTD;  
        const leDiff = le - avgLE; 

        let anomaly = '';
        if (treeDiffRatio > 0.3 && leDiff > 1.5) {
            anomaly = 'Tree density is significantly lower than the neighborhood average, but life expectancy is unusually high.';
        } else if (treeDensity > meanTD * 1.3 && le < avgLE - 1.5) {
            anomaly = 'Tree density is much higher than the average, but life expectancy is unexpectedly low.';
        }

        prompt = `
This block group has a tree density of ${treeDensityStr}, and its life expectancy is ${le} years.
Write 1 sentence to introduce ${treeDensity} and ${le}.
Compare the ${treeDensity} with ${meanTD}.
Compare ${le} with ${avgLE}.
${anomaly}
            `.trim();
    }
// air quality
    else if(section === 'air'){
        const airQuality = value; 
        const airQualityStr = `${airQuality}`;
        const le = leAnalysis?.lifeExpectancy?.toFixed(1);
        const avgLE = leAnalysis?.meanLE?.toFixed(1);
        const neighborAQs = leAnalysis.neighbors
            .map(f => f.properties['pm300'])
            .filter(v => typeof v === 'number');
        const allAQs = [airQuality, ...neighborAQs];
        const meanAQ = allAQs.reduce((sum, val) => sum + val, 0) / allAQs.length;

        let anomaly = '';
        if (airQuality > meanAQ * 1.3 && le > avgLE + 1.5) {
            anomaly = 'Air pollution is much higher than the average, but life expectancy is unexpectedly high.';
        }

        prompt = `
This block group's PM 2.5 concentration is ${airQualityStr}, and its life expectancy is ${le} years.
Write 1 sentence to introduce ${airQuality} and ${le}.
Compare the ${airQuality} with ${meanAQ}.
Compare ${le} with ${avgLE}.
${anomaly}
            `.trim();
    }
// building height
    else if(section === 'buildingHeight'){
        const buildingHeight = value; 
        const buildingHeightStr = `${buildingHeight} feet`;
        const le = leAnalysis?.lifeExpectancy?.toFixed(1);
        const avgLE = leAnalysis?.meanLE?.toFixed(1);
        const neighborBHs = leAnalysis.neighbors
            .map(f => f.properties['avr_height'])
            .filter(v => typeof v === 'number');
        const allBHs = [buildingHeight, ...neighborBHs];
        const meanBH = allBHs.reduce((sum, val) => sum + val, 0) / allBHs.length;

        let anomaly = '';
        if (buildingHeight > meanBH * 1.3 && le > avgLE + 1.5) {
            anomaly = 'Average building height is much higher than the average, but life expectancy is unexpectedly high.';
        }

        prompt = `
    Building height is negatively correlated with life expectancy.
    This block group's average building height is ${buildingHeightStr} feet, and its life expectancy is ${le} years.
    Write 1 sentence to introduce ${buildingHeight} and ${le}.
    Compare the ${buildingHeight} with ${meanBH}.
    Compare ${le} with ${avgLE}.
    ${anomaly}
            `.trim();
    }

// structure time
    else if(section === 'structureTime'){
        const strtime = value; 
        const strtimeStr = `${strtime} `;
        const le = leAnalysis?.lifeExpectancy?.toFixed(1);
        const avgLE = leAnalysis?.meanLE?.toFixed(1);
        const neighborSTRTs = leAnalysis.neighbors
            .map(f => f.properties['%early built'])
            .filter(v => typeof v === 'number');
        const allSTRTs = [strtime, ...neighborSTRTs];
        const meanSTRT = allSTRTs.reduce((sum, val) => sum + val, 0) / allSTRTs.length;

        prompt = `
    This shows the ratio of structures built ealier than 1960.
    The ratio of early built structures is ${strtimeStr} , and its life expectancy is ${le} years.
    Write 1 sentence to introduce ${strtime} and ${le}.
    Compare the ${strtime} with ${meanSTRT}.
    Compare ${le} with ${avgLE}.
            `.trim();
    }

// income
    else if(section === 'income'){
        const income = value; 
        const incomeStr = `${income} feet`;
        const le = leAnalysis?.lifeExpectancy?.toFixed(1);
        const avgLE = leAnalysis?.meanLE?.toFixed(1);
        const neighborICs = leAnalysis.neighbors
            .map(f => f.properties['per capita income'])
            .filter(v => typeof v === 'number');
        const allICs = [income, ...neighborICs];
        const meanIC = allICs.reduce((sum, val) => sum + val, 0) / allICs.length;
        const incomeDiffRatio = (meanIC - income) / meanIC;  
        const leDiff = le - avgLE;

        let anomaly = '';
        if (incomeDiffRatio > 0.3 && leDiff > 1.5) {
            anomaly = 'The income is significantly lower than the neighborhood average, but life expectancy is unusually high.';
        }
        else if (income > meanIC * 1.3 && le < avgLE - 1.5) {
            anomaly = 'Per capita income is much higher than the average, but life expectancy is unexpectedly low.';
        }

        prompt = `
    Per capita income of this block group is ${incomeStr} dollars, and its life expectancy is ${le} years.
    Write 1 sentence to introduce ${income} and ${le}.
    Compare the ${income} with ${meanIC}.
    Compare ${le} with ${avgLE}.
    ${anomaly}
            `.trim();
    }
// edu
        else if(section === 'edu'){
            const edu = value; 
            const eduStr = `${edu} `;
            const le = leAnalysis?.lifeExpectancy?.toFixed(1);
            const avgLE = leAnalysis?.meanLE?.toFixed(1);
            const neighborEDUs = leAnalysis.neighbors
                .map(f => f.properties['less than high school'])
                .filter(v => typeof v === 'number');
            const allEDUs = [edu, ...neighborEDUs];
            const meanEDU = allEDUs.reduce((sum, val) => sum + val, 0) / allEDUs.length;
    
            prompt = `
        This block group's less than high school education rate is ${eduStr} , and its life expectancy is ${le} years.
        Write 1 sentence to introduce ${edu} and ${le}.
        Compare the ${edu} with ${meanEDU}.
        Compare ${le} with ${avgLE}.
                `.trim();
        }

// rent
    else if(section === 'rent'){
        const rent = value; 
        const rentStr = `${rent} dollars per year`;
        const le = leAnalysis?.lifeExpectancy?.toFixed(1);
        const avgLE = leAnalysis?.meanLE?.toFixed(1);
        const neighborRents = leAnalysis.neighbors
            .map(f => f.properties['rent'])
            .filter(v => typeof v === 'number');
        const allRents = [rent, ...neighborRents];
        const meanRent = allRents.reduce((sum, val) => sum + val, 0) / allRents.length;
        const rentDiffRatio = (meanRent - rent) / meanRent;  
        const leDiff = le - avgLE;

        let anomaly = '';
        if (rentDiffRatio > 0.3 && leDiff > 1.5) {
            anomaly = 'The rent is significantly lower than the neighborhood average, but life expectancy is unusually high.';
        }
        else if (rent > meanRent * 1.3 && le < avgLE - 1.5) {
            anomaly = 'Gross rent is much higher than the average, but life expectancy is unexpectedly low.';
        }

        prompt = `
    Gross rent is positively correlated with life expectancy.
    The gross rent of this block group is ${rentStr} dollars per year, and its life expectancy is ${le} years.
    Write 1 sentence to introduce ${rent} and ${le}.
    Compare the ${rent} with ${meanRent}.
    Compare ${le} with ${avgLE}.
    ${anomaly}
            `.trim();
    }

    console.log('\n🧠 Prompt to OpenAI:\n', prompt);

    const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.7
    });

    const result = completion.choices[0].message.content.trim();
    console.log('✅ AI Response:', result);
    res.json({ text: result });

} catch (error) {
    console.error('🔥 OpenAI or file error:', error);
    res.status(500).json({ error: 'Failed to generate description.' });
}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
