const fs = require('fs').promises;
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'ml-model', 'data');

async function prepareFinalTrainingData() {
    console.log('=== Preparing Final Training Data ===');
    
    try {
        // Define file mappings
        const fileMappings = [
            {
                improved: 'genuine_signatures_improved.json',
                final: 'genuine_signatures.json',
                type: 'genuine'
            },
            {
                improved: 'forgery_signatures_improved.json',
                final: 'forgery_signatures.json',
                type: 'forgery'
            }
        ];

        for (const mapping of fileMappings) {
            const improvedPath = path.join(DATA_DIR, mapping.improved);
            const finalPath = path.join(DATA_DIR, mapping.final);
            
            console.log(`\nProcessing ${mapping.type} signatures...`);
            
            try {
                // Check if improved file exists
                await fs.access(improvedPath);
                
                // Read the improved data
                const content = await fs.readFile(improvedPath, 'utf8');
                const data = JSON.parse(content);
                
                console.log(`  Found ${data.length} ${mapping.type} samples in improved file`);
                
                // Backup existing file if it exists
                try {
                    await fs.access(finalPath);
                    const backupPath = finalPath + '.backup_' + new Date().toISOString().split('T')[0];
                    await fs.copyFile(finalPath, backupPath);
                    console.log(`  Backed up existing file to ${path.basename(backupPath)}`);
                } catch {
                    console.log(`  No existing ${mapping.final} to backup`);
                }
                
                // Write to final location
                await fs.writeFile(finalPath, JSON.stringify(data, null, 2));
                console.log(`  ✅ Wrote ${data.length} samples to ${mapping.final}`);
                
            } catch (error) {
                console.log(`  ❌ Error processing ${mapping.improved}: ${error.message}`);
                console.log(`  Skipping ${mapping.type} signatures`);
            }
        }

        // Create combined training file for the model
        console.log('\nCreating combined training file...');
        
        try {
            // Read both files
            const genuineContent = await fs.readFile(path.join(DATA_DIR, 'genuine_signatures.json'), 'utf8');
            const forgeryContent = await fs.readFile(path.join(DATA_DIR, 'forgery_signatures.json'), 'utf8');
            
            const genuineData = JSON.parse(genuineContent);
            const forgeryData = JSON.parse(forgeryContent);
            
            // Combine and shuffle
            const allData = [...genuineData, ...forgeryData];
            
            // Fisher-Yates shuffle
            for (let i = allData.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allData[i], allData[j]] = [allData[j], allData[i]];
            }
            
            // Write combined file
            const combinedPath = path.join(DATA_DIR, 'all_signatures.json');
            await fs.writeFile(combinedPath, JSON.stringify(allData, null, 2));
            
            console.log(`  ✅ Created combined training file with ${allData.length} samples`);
            console.log(`     - ${genuineData.length} genuine (${((genuineData.length / allData.length) * 100).toFixed(1)}%)`);
            console.log(`     - ${forgeryData.length} forgery (${((forgeryData.length / allData.length) * 100).toFixed(1)}%)`);
            
        } catch (error) {
            console.log(`  ❌ Error creating combined file: ${error.message}`);
        }

        console.log('\n✅ Training data preparation complete!');
        console.log('\nYour ml-model/data/ directory should now contain:');
        console.log('  - genuine_signatures.json (cleaned genuine samples)');
        console.log('  - forgery_signatures.json (cleaned forgery samples)');
        console.log('  - all_signatures.json (combined and shuffled)');
        console.log('\nReady to retrain the model!');

    } catch (error) {
        console.error('\n❌ Preparation failed:', error);
    }
}

// Run if called directly
if (require.main === module) {
    prepareFinalTrainingData();
}

module.exports = { prepareFinalTrainingData };