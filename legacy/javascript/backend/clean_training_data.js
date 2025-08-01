const fs = require('fs').promises;
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'ml-model', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backup_' + new Date().toISOString().split('T')[0]);
const CORRUPTION_THRESHOLD = 0.7; // 70% of features must be zero/null to be considered corrupted

// Define all expected features
const EXPECTED_FEATURES = [
    'stroke_count', 'total_points', 'total_duration_ms', 'avg_points_per_stroke',
    'avg_velocity', 'max_velocity', 'min_velocity', 'velocity_std',
    'width', 'height', 'area', 'aspect_ratio', 'center_x', 'center_y',
    'avg_stroke_length', 'total_length', 'length_variation', 
    'avg_stroke_duration', 'duration_variation'
];

// Check if a sample is corrupted
function isCorrupted(sample) {
    try {
        // Check if sample has features
        if (!sample.features) {
            console.log('  ❌ Missing features object');
            return true;
        }

        // Flatten nested features for checking
        const flatFeatures = {};
        
        // Handle both flat and nested feature structures
        if (sample.features.basic_stats || sample.features.velocity_features) {
            // Nested structure
            Object.assign(flatFeatures, 
                sample.features.basic_stats || {},
                sample.features.velocity_features || {},
                sample.features.shape_features || {},
                sample.features.stroke_features || {}
            );
        } else {
            // Flat structure
            Object.assign(flatFeatures, sample.features);
        }

        // Count zero/null/undefined features
        let zeroCount = 0;
        let missingCount = 0;
        
        EXPECTED_FEATURES.forEach(feature => {
            const value = flatFeatures[feature];
            if (value === undefined || value === null) {
                missingCount++;
            } else if (value === 0 || value === '0') {
                zeroCount++;
            }
        });

        const totalBadFeatures = zeroCount + missingCount;
        const corruptionRatio = totalBadFeatures / EXPECTED_FEATURES.length;
        
        if (corruptionRatio >= CORRUPTION_THRESHOLD) {
            console.log(`  ❌ Corrupted: ${totalBadFeatures}/${EXPECTED_FEATURES.length} features are zero/null (${(corruptionRatio * 100).toFixed(1)}%)`);
            return true;
        }

        // Additional validation checks
        if (flatFeatures.stroke_count <= 0 || flatFeatures.stroke_count > 50) {
            console.log(`  ❌ Invalid stroke_count: ${flatFeatures.stroke_count}`);
            return true;
        }

        if (flatFeatures.total_points <= 0) {
            console.log(`  ❌ Invalid total_points: ${flatFeatures.total_points}`);
            return true;
        }

        if (flatFeatures.total_duration_ms <= 0 || flatFeatures.total_duration_ms > 60000) {
            console.log(`  ❌ Invalid total_duration_ms: ${flatFeatures.total_duration_ms}`);
            return true;
        }

        if (flatFeatures.avg_velocity < 0 || flatFeatures.avg_velocity > 10) {
            console.log(`  ❌ Invalid avg_velocity: ${flatFeatures.avg_velocity}`);
            return true;
        }

        return false;
    } catch (error) {
        console.log(`  ❌ Error checking corruption: ${error.message}`);
        return true;
    }
}

// Process a single JSON file
async function processFile(filePath) {
    const fileName = path.basename(filePath);
    console.log(`\nProcessing ${fileName}...`);
    
    try {
        // Read the file
        const content = await fs.readFile(filePath, 'utf8');
        let data;
        
        try {
            data = JSON.parse(content);
        } catch (parseError) {
            console.log(`  ❌ Malformed JSON: ${parseError.message}`);
            return { corrupted: 1, cleaned: 0, fileName };
        }

        if (!Array.isArray(data)) {
            console.log(`  ❌ Not an array of samples`);
            return { corrupted: 1, cleaned: 0, fileName };
        }

        // Check each sample
        const cleanSamples = [];
        let corruptedCount = 0;

        data.forEach((sample, index) => {
            console.log(`  Checking sample ${index + 1}/${data.length} (${sample.user_id || 'unknown'}, ${sample.type || 'unknown'})`);
            
            if (isCorrupted(sample)) {
                corruptedCount++;
            } else {
                cleanSamples.push(sample);
                console.log(`  ✅ Valid sample`);
            }
        });

        // Write cleaned data back
        if (cleanSamples.length > 0) {
            await fs.writeFile(filePath, JSON.stringify(cleanSamples, null, 2));
            console.log(`  ✅ Wrote ${cleanSamples.length} clean samples (removed ${corruptedCount} corrupted)`);
        } else {
            console.log(`  ⚠️  No valid samples remaining - file will be empty`);
            await fs.writeFile(filePath, '[]');
        }

        return {
            corrupted: corruptedCount,
            cleaned: cleanSamples.length,
            fileName,
            totalOriginal: data.length
        };

    } catch (error) {
        console.log(`  ❌ Error processing file: ${error.message}`);
        return { corrupted: 0, cleaned: 0, fileName, error: error.message };
    }
}

// Main cleanup function
async function cleanTrainingData() {
    console.log('=== ML Training Data Cleanup ===');
    console.log(`Data directory: ${DATA_DIR}`);
    console.log(`Corruption threshold: ${CORRUPTION_THRESHOLD * 100}% features zero/null`);
    
    try {
        // Check if data directory exists
        try {
            await fs.access(DATA_DIR);
        } catch {
            console.error(`\n❌ Data directory not found: ${DATA_DIR}`);
            console.log('Please ensure ml-model/data/ directory exists');
            return;
        }

        // Create backup directory
        console.log(`\nCreating backup at: ${BACKUP_DIR}`);
        await fs.mkdir(BACKUP_DIR, { recursive: true });

        // Get all JSON files
        const files = await fs.readdir(DATA_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('backup'));

        if (jsonFiles.length === 0) {
            console.log('\n❌ No JSON files found in data directory');
            return;
        }

        console.log(`\nFound ${jsonFiles.length} JSON files to process`);

        // Backup all files first
        console.log('\nBacking up files...');
        for (const file of jsonFiles) {
            const sourcePath = path.join(DATA_DIR, file);
            const backupPath = path.join(BACKUP_DIR, file);
            await fs.copyFile(sourcePath, backupPath);
            console.log(`  ✅ Backed up ${file}`);
        }

        // Process each file
        const results = [];
        let totalCorrupted = 0;
        let totalCleaned = 0;
        let totalOriginal = 0;

        for (const file of jsonFiles) {
            const filePath = path.join(DATA_DIR, file);
            const result = await processFile(filePath);
            results.push(result);
            totalCorrupted += result.corrupted || 0;
            totalCleaned += result.cleaned || 0;
            totalOriginal += result.totalOriginal || 0;
        }

        // Print summary
        console.log('\n=== Cleanup Summary ===');
        console.log(`Total files processed: ${jsonFiles.length}`);
        console.log(`Total original samples: ${totalOriginal}`);
        console.log(`Total corrupted samples removed: ${totalCorrupted}`);
        console.log(`Total clean samples retained: ${totalCleaned}`);
        console.log(`Corruption rate: ${((totalCorrupted / totalOriginal) * 100).toFixed(1)}%`);
        
        console.log('\nPer-file breakdown:');
        results.forEach(result => {
            if (result.error) {
                console.log(`  ${result.fileName}: ERROR - ${result.error}`);
            } else {
                console.log(`  ${result.fileName}: ${result.cleaned} clean, ${result.corrupted} corrupted`);
            }
        });

        console.log(`\n✅ Cleanup complete! Backup saved at: ${BACKUP_DIR}`);
        console.log('\nNext steps:');
        console.log('1. Review the cleaned data files');
        console.log('2. Run improved_exportMLDataForTraining.js to get fresh data');
        console.log('3. Retrain the model with: cd ml-model && ./retrain_model.sh');

    } catch (error) {
        console.error('\n❌ Cleanup failed:', error);
    }
}

// Run if called directly
if (require.main === module) {
    cleanTrainingData();
}

module.exports = { cleanTrainingData, isCorrupted };