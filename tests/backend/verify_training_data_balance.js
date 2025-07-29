const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'ml-model', 'data');

async function verifyTrainingDataBalance() {
    console.log('🔍 Verifying training data balance...\n');
    
    try {
        // Get all training files
        const files = await fs.readdir(DATA_DIR);
        const trainingFiles = files.filter(f => f.startsWith('signature_data_') && f.endsWith('.json'));
        
        console.log(`Found ${trainingFiles.length} training files`);
        
        // Analyze each file
        let genuineCount = 0;
        let forgeryCount = 0;
        const userStats = {};
        const forgeryTypes = {};
        const featureRanges = {
            avg_velocity: { min: Infinity, max: -Infinity },
            total_duration_ms: { min: Infinity, max: -Infinity },
            stroke_count: { min: Infinity, max: -Infinity },
            area: { min: Infinity, max: -Infinity }
        };
        
        for (const file of trainingFiles) {
            const content = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
            const sample = JSON.parse(content);
            
            // Count by type
            if (sample.type === 'genuine') {
                genuineCount++;
            } else {
                forgeryCount++;
                
                // Track forgery types
                const forgeryType = sample.metadata?.forgery_type || 'unknown';
                forgeryTypes[forgeryType] = (forgeryTypes[forgeryType] || 0) + 1;
            }
            
            // Track users
            const baseUser = sample.metadata?.based_on_genuine || sample.user_id;
            if (!userStats[baseUser]) {
                userStats[baseUser] = { genuine: 0, forgeries: 0 };
            }
            
            if (sample.type === 'genuine') {
                userStats[baseUser].genuine++;
            } else {
                userStats[baseUser].forgeries++;
            }
            
            // Track feature ranges
            if (sample.features) {
                const vel = sample.features.velocity_features?.average_velocity;
                const dur = sample.features.basic_stats?.total_duration_ms;
                const strokes = sample.features.basic_stats?.stroke_count;
                const area = sample.features.shape_features?.area;
                
                if (vel !== undefined) {
                    featureRanges.avg_velocity.min = Math.min(featureRanges.avg_velocity.min, vel);
                    featureRanges.avg_velocity.max = Math.max(featureRanges.avg_velocity.max, vel);
                }
                if (dur !== undefined) {
                    featureRanges.total_duration_ms.min = Math.min(featureRanges.total_duration_ms.min, dur);
                    featureRanges.total_duration_ms.max = Math.max(featureRanges.total_duration_ms.max, dur);
                }
                if (strokes !== undefined) {
                    featureRanges.stroke_count.min = Math.min(featureRanges.stroke_count.min, strokes);
                    featureRanges.stroke_count.max = Math.max(featureRanges.stroke_count.max, strokes);
                }
                if (area !== undefined) {
                    featureRanges.area.min = Math.min(featureRanges.area.min, area);
                    featureRanges.area.max = Math.max(featureRanges.area.max, area);
                }
            }
        }
        
        const total = genuineCount + forgeryCount;
        
        // Display results
        console.log('\n📊 Class Distribution:');
        console.log(`   Genuine: ${genuineCount} (${((genuineCount / total) * 100).toFixed(1)}%)`);
        console.log(`   Forgery: ${forgeryCount} (${((forgeryCount / total) * 100).toFixed(1)}%)`);
        console.log(`   Ratio: 1:${(forgeryCount / genuineCount).toFixed(1)}`);
        
        console.log('\n🎭 Forgery Types:');
        Object.entries(forgeryTypes).forEach(([type, count]) => {
            console.log(`   ${type}: ${count} (${((count / forgeryCount) * 100).toFixed(1)}%)`);
        });
        
        console.log('\n👥 Per-User Statistics:');
        const sortedUsers = Object.keys(userStats).sort();
        for (const user of sortedUsers.slice(0, 10)) { // Show first 10 users
            const stats = userStats[user];
            console.log(`   ${user}: ${stats.genuine} genuine, ${stats.forgeries} forgeries`);
        }
        if (sortedUsers.length > 10) {
            console.log(`   ... and ${sortedUsers.length - 10} more users`);
        }
        
        console.log('\n📏 Feature Ranges:');
        console.log(`   Avg Velocity: ${featureRanges.avg_velocity.min.toFixed(3)} - ${featureRanges.avg_velocity.max.toFixed(3)}`);
        console.log(`   Duration: ${featureRanges.total_duration_ms.min}ms - ${featureRanges.total_duration_ms.max}ms`);
        console.log(`   Stroke Count: ${featureRanges.stroke_count.min} - ${featureRanges.stroke_count.max}`);
        console.log(`   Area: ${featureRanges.area.min} - ${featureRanges.area.max}`);
        
        // Check for issues
        console.log('\n⚠️  Potential Issues:');
        if (genuineCount === 0) {
            console.log('   ❌ No genuine samples found!');
        }
        if (forgeryCount === 0) {
            console.log('   ❌ No forgery samples found!');
        }
        if (forgeryCount / genuineCount < 1) {
            console.log('   ⚠️  More genuine than forgery samples - model may be biased');
        }
        if (featureRanges.avg_velocity.min <= 0) {
            console.log('   ❌ Found non-positive average velocity!');
        }
        if (featureRanges.stroke_count.min < 1) {
            console.log('   ❌ Found invalid stroke count < 1!');
        }
        
        // Success message
        if (forgeryCount > genuineCount * 3) {
            console.log('\n✅ Training data is well-balanced for forgery detection!');
        }
        
    } catch (error) {
        console.error('❌ Error verifying training data:', error);
    }
}

// Run if called directly
if (require.main === module) {
    verifyTrainingDataBalance();
}

module.exports = { verifyTrainingDataBalance };