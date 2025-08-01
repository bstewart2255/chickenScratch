const fs = require('fs').promises;
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'ml-model', 'data');
const FORGERIES_PER_GENUINE = 5;
const RANDOM_SEED = 42; // For reproducible results

// Simple seeded random number generator for consistency
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
    
    range(min, max) {
        return min + this.next() * (max - min);
    }
    
    intRange(min, max) {
        return Math.floor(this.range(min, max + 1));
    }
}

const random = new SeededRandom(RANDOM_SEED);

// Validation functions
function validateFeatures(features, sampleId) {
    const errors = [];
    
    // Check basic stats
    if (features.basic_stats.stroke_count < 1) {
        errors.push(`stroke_count < 1 in ${sampleId}`);
    }
    if (features.basic_stats.total_points <= 0) {
        errors.push(`total_points <= 0 in ${sampleId}`);
    }
    if (features.basic_stats.total_duration_ms <= 0) {
        errors.push(`total_duration_ms <= 0 in ${sampleId}`);
    }
    
    // Check velocities
    if (features.velocity_features.average_velocity <= 0) {
        errors.push(`average_velocity <= 0 in ${sampleId}`);
    }
    if (features.velocity_features.min_velocity < 0) {
        errors.push(`min_velocity < 0 in ${sampleId}`);
    }
    
    // Check dimensions
    if (features.shape_features.width <= 0) {
        errors.push(`width <= 0 in ${sampleId}`);
    }
    if (features.shape_features.height <= 0) {
        errors.push(`height <= 0 in ${sampleId}`);
    }
    
    return errors;
}

// Forgery generation functions
function generateRushedForgery(genuine, forgeryIndex) {
    const features = JSON.parse(JSON.stringify(genuine.features)); // Deep copy
    
    // Rushed signatures are faster with more velocity variation
    features.velocity_features.average_velocity *= random.range(1.3, 1.8);
    features.velocity_features.max_velocity *= random.range(1.4, 2.0);
    features.velocity_features.velocity_std *= random.range(1.2, 1.6);
    features.velocity_features.min_velocity *= random.range(0.8, 1.2);
    
    // Shorter duration
    const durationMultiplier = random.range(0.6, 0.8);
    features.basic_stats.total_duration_ms *= durationMultiplier;
    features.stroke_features.average_stroke_duration *= durationMultiplier;
    
    // Area varies due to rushed execution
    const areaMultiplier = random.range(0.8, 1.2);
    features.shape_features.area *= areaMultiplier;
    
    // Update average points per stroke
    features.basic_stats.average_points_per_stroke = 
        features.basic_stats.total_points / features.basic_stats.stroke_count;
    
    return {
        user_id: `forger_${forgeryIndex}_copying_${genuine.user_id}`,
        timestamp: Date.now() + forgeryIndex,
        type: "forgery",
        features: features,
        metadata: {
            ...genuine.metadata,
            forgery_type: "rushed",
            based_on_genuine: genuine.user_id,
            auth_success: false,
            confidence: random.range(10, 30)
        }
    };
}

function generateSlowCarefulForgery(genuine, forgeryIndex) {
    const features = JSON.parse(JSON.stringify(genuine.features));
    
    // Slow, careful forgeries have lower velocity
    features.velocity_features.average_velocity *= random.range(0.5, 0.7);
    features.velocity_features.max_velocity *= random.range(0.6, 0.8);
    features.velocity_features.min_velocity *= random.range(0.3, 0.6);
    features.velocity_features.velocity_std *= random.range(0.7, 0.9);
    
    // Longer duration
    const durationMultiplier = random.range(1.5, 2.2);
    features.basic_stats.total_duration_ms *= durationMultiplier;
    features.stroke_features.average_stroke_duration *= durationMultiplier;
    features.stroke_features.duration_variation *= random.range(0.8, 1.2);
    
    return {
        user_id: `forger_${forgeryIndex}_copying_${genuine.user_id}`,
        timestamp: Date.now() + forgeryIndex,
        type: "forgery",
        features: features,
        metadata: {
            ...genuine.metadata,
            forgery_type: "slow_careful",
            based_on_genuine: genuine.user_id,
            auth_success: false,
            confidence: random.range(10, 30)
        }
    };
}

function generateSizeDifferentForgery(genuine, forgeryIndex) {
    const features = JSON.parse(JSON.stringify(genuine.features));
    
    // Apply consistent size change
    const sizeMultiplier = random.range(0.7, 1.4);
    features.shape_features.width *= sizeMultiplier;
    features.shape_features.height *= sizeMultiplier;
    features.shape_features.area *= (sizeMultiplier * sizeMultiplier);
    
    // Aspect ratio varies slightly
    features.shape_features.aspect_ratio *= random.range(0.8, 1.3);
    
    // Stroke lengths scale with size
    features.stroke_features.average_stroke_length *= sizeMultiplier;
    features.stroke_features.total_length *= sizeMultiplier;
    
    return {
        user_id: `forger_${forgeryIndex}_copying_${genuine.user_id}`,
        timestamp: Date.now() + forgeryIndex,
        type: "forgery",
        features: features,
        metadata: {
            ...genuine.metadata,
            forgery_type: "size_different",
            based_on_genuine: genuine.user_id,
            auth_success: false,
            confidence: random.range(10, 30)
        }
    };
}

function generatePositionShiftForgery(genuine, forgeryIndex) {
    const features = JSON.parse(JSON.stringify(genuine.features));
    
    // Shift center position
    features.shape_features.center_x += random.intRange(-100, 100);
    features.shape_features.center_y += random.intRange(-50, 50);
    
    // Ensure centers stay positive
    features.shape_features.center_x = Math.max(50, features.shape_features.center_x);
    features.shape_features.center_y = Math.max(50, features.shape_features.center_y);
    
    // Slight variations in other features
    features.velocity_features.average_velocity *= random.range(0.9, 1.1);
    features.basic_stats.total_duration_ms *= random.range(0.9, 1.1);
    
    return {
        user_id: `forger_${forgeryIndex}_copying_${genuine.user_id}`,
        timestamp: Date.now() + forgeryIndex,
        type: "forgery",
        features: features,
        metadata: {
            ...genuine.metadata,
            forgery_type: "position_shift",
            based_on_genuine: genuine.user_id,
            auth_success: false,
            confidence: random.range(10, 30)
        }
    };
}

function generateStrokeVariationForgery(genuine, forgeryIndex) {
    const features = JSON.parse(JSON.stringify(genuine.features));
    
    // Modify stroke count
    const strokeChange = random.intRange(-2, 2);
    features.basic_stats.stroke_count = Math.max(1, features.basic_stats.stroke_count + strokeChange);
    
    // Update points accordingly
    features.basic_stats.average_points_per_stroke = 
        features.basic_stats.total_points / features.basic_stats.stroke_count;
    
    // Vary stroke characteristics
    features.stroke_features.total_length *= random.range(0.8, 1.3);
    features.stroke_features.average_stroke_length = 
        features.stroke_features.total_length / features.basic_stats.stroke_count;
    features.stroke_features.length_variation *= random.range(1.2, 1.8);
    features.stroke_features.duration_variation *= random.range(1.3, 2.0);
    
    // Slight timing variations
    features.basic_stats.total_duration_ms *= random.range(0.85, 1.15);
    features.stroke_features.average_stroke_duration = 
        features.basic_stats.total_duration_ms / features.basic_stats.stroke_count;
    
    return {
        user_id: `forger_${forgeryIndex}_copying_${genuine.user_id}`,
        timestamp: Date.now() + forgeryIndex,
        type: "forgery",
        features: features,
        metadata: {
            ...genuine.metadata,
            forgery_type: "stroke_variation",
            based_on_genuine: genuine.user_id,
            auth_success: false,
            confidence: random.range(10, 30)
        }
    };
}

// Main generation function
async function generateSyntheticForgeries() {
    console.log('🔬 Generating synthetic forgery training data...');
    
    try {
        // Load genuine signatures
        const genuinePath = path.join(DATA_DIR, 'genuine_signatures_improved.json');
        const genuineContent = await fs.readFile(genuinePath, 'utf8');
        const genuineSignatures = JSON.parse(genuineContent);
        
        console.log(`📖 Loaded ${genuineSignatures.length} genuine signatures`);
        
        // Load existing forgeries (if any)
        let existingForgeries = [];
        try {
            const forgeryPath = path.join(DATA_DIR, 'forgery_signatures_improved.json');
            const forgeryContent = await fs.readFile(forgeryPath, 'utf8');
            existingForgeries = JSON.parse(forgeryContent);
            console.log(`📖 Loaded ${existingForgeries.length} existing forgery samples`);
        } catch (e) {
            console.log('📝 No existing forgery file found, starting fresh');
        }
        
        // Generate synthetic forgeries
        const syntheticForgeries = [];
        const forgeryGenerators = [
            generateRushedForgery,
            generateSlowCarefulForgery,
            generateSizeDifferentForgery,
            generatePositionShiftForgery,
            generateStrokeVariationForgery
        ];
        
        let forgeryIndex = 0;
        for (const genuine of genuineSignatures) {
            for (let i = 0; i < FORGERIES_PER_GENUINE; i++) {
                const generator = forgeryGenerators[i % forgeryGenerators.length];
                const forgery = generator(genuine, forgeryIndex++);
                
                // Validate generated features
                const errors = validateFeatures(forgery.features, forgery.user_id);
                if (errors.length > 0) {
                    console.warn(`⚠️  Validation errors for ${forgery.user_id}:`, errors);
                } else {
                    syntheticForgeries.push(forgery);
                }
                
                if (syntheticForgeries.length % 50 === 0) {
                    console.log(`  Generated ${syntheticForgeries.length} synthetic forgeries...`);
                }
            }
        }
        
        console.log(`✅ Generated ${syntheticForgeries.length} synthetic forgeries`);
        
        // Clear old training files
        const files = await fs.readdir(DATA_DIR);
        const oldTrainingFiles = files.filter(f => f.startsWith('signature_data_') && f.endsWith('.json'));
        
        for (const file of oldTrainingFiles) {
            await fs.unlink(path.join(DATA_DIR, file));
        }
        console.log(`🗑️  Cleared ${oldTrainingFiles.length} old training files`);
        
        // Combine all samples
        const allSamples = [
            ...genuineSignatures,
            ...existingForgeries,
            ...syntheticForgeries
        ];
        
        // Create individual training files
        let fileCount = 0;
        for (let i = 0; i < allSamples.length; i++) {
            const sample = allSamples[i];
            const fileName = `signature_data_${sample.user_id}_${i}.json`;
            const filePath = path.join(DATA_DIR, fileName);
            
            await fs.writeFile(filePath, JSON.stringify(sample, null, 2));
            fileCount++;
        }
        
        console.log(`📁 Created ${fileCount} individual training files`);
        
        // Calculate and display statistics
        const genuineCount = genuineSignatures.length;
        const forgeryCount = existingForgeries.length + syntheticForgeries.length;
        const totalCount = genuineCount + forgeryCount;
        
        console.log('\n📊 Class distribution:');
        console.log(`   Genuine: ${genuineCount} (${((genuineCount / totalCount) * 100).toFixed(1)}%)`);
        console.log(`   Forgery: ${forgeryCount} (${((forgeryCount / totalCount) * 100).toFixed(1)}%)`);
        
        // Save combined files for reference
        const allForgeriesPath = path.join(DATA_DIR, 'all_synthetic_forgeries.json');
        await fs.writeFile(allForgeriesPath, JSON.stringify([...existingForgeries, ...syntheticForgeries], null, 2));
        console.log(`\n💾 Saved all forgeries to: all_synthetic_forgeries.json`);
        
        // Feature statistics
        console.log('\n📈 Feature statistics for synthetic forgeries:');
        const avgVelocities = syntheticForgeries.map(f => f.features.velocity_features.average_velocity);
        const durations = syntheticForgeries.map(f => f.features.basic_stats.total_duration_ms);
        const strokeCounts = syntheticForgeries.map(f => f.features.basic_stats.stroke_count);
        
        console.log(`   Avg velocity range: ${Math.min(...avgVelocities).toFixed(2)} - ${Math.max(...avgVelocities).toFixed(2)}`);
        console.log(`   Duration range: ${Math.min(...durations)}ms - ${Math.max(...durations)}ms`);
        console.log(`   Stroke count range: ${Math.min(...strokeCounts)} - ${Math.max(...strokeCounts)}`);
        
        console.log('\n🎯 Ready to retrain model with balanced data!');
        console.log('\nNext steps:');
        console.log('1. cd ../ml-model');
        console.log('2. python train_model_sklearn.py');
        console.log('3. Test the retrained model with real signatures');
        
    } catch (error) {
        console.error('❌ Error generating synthetic forgeries:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Run if called directly
if (require.main === module) {
    generateSyntheticForgeries();
}

module.exports = { generateSyntheticForgeries };