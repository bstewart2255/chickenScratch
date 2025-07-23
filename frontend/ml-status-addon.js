// ML Status Functions to add to ml-dashboard.html

// Check ML API status
async function checkMLStatus() {
    const mlStatusEl = document.getElementById('mlStatus');
    const mlStatusBtn = document.getElementById('mlStatusBtn');
    
    try {
        const response = await fetch('http://localhost:5002/api/health');
        if (response.ok) {
            const data = await response.json();
            if (data.model_loaded) {
                mlStatusEl.innerHTML = '🟢 ML Active';
                mlStatusBtn.style.background = '#10b981';
                mlStatusBtn.style.color = 'white';
                
                // Also check if backend is using ML
                checkBackendMLUsage();
                
                return true;
            } else {
                mlStatusEl.innerHTML = '🟡 ML Loading';
                mlStatusBtn.style.background = '#f59e0b';
                mlStatusBtn.style.color = 'white';
            }
        } else {
            throw new Error('ML API not responding');
        }
    } catch (error) {
        mlStatusEl.innerHTML = '🔴 ML Offline';
        mlStatusBtn.style.background = '#ef4444';
        mlStatusBtn.style.color = 'white';
        console.log('ML API not available:', error.message);
    }
    return false;
}

// Check if backend is actually using ML
async function checkBackendMLUsage() {
    try {
        // This is a simple check - in production you'd have a proper endpoint
        const testResponse = await fetch(`${API_URL}/api/check-ml-status`);
        if (testResponse.ok) {
            const data = await testResponse.json();
            if (data.ml_enabled) {
                console.log('✅ Backend is using ML for authentication');
            }
        }
    } catch (error) {
        console.log('Backend ML status check failed:', error);
    }
}

// Updated startRetraining function
async function startRetraining() {
    const progressDiv = document.getElementById('retrainProgress');
    const progressBar = document.getElementById('retrainProgressBar');
    const statusText = document.getElementById('retrainStatus');
    const startBtn = document.getElementById('startRetrainBtn');
    
    progressDiv.style.display = 'block';
    startBtn.style.display = 'none';
    
    // Simulate retraining process
    const steps = [
        { progress: 10, status: 'Exporting signature data from database...' },
        { progress: 30, status: 'Preparing training data...' },
        { progress: 50, status: 'Training Random Forest model...' },
        { progress: 70, status: 'Evaluating model performance...' },
        { progress: 90, status: 'Saving model artifacts...' },
        { progress: 100, status: 'Retraining complete!' }
    ];
    
    for (const step of steps) {
        progressBar.style.width = step.progress + '%';
        statusText.textContent = step.status;
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // Show completion message with instructions
    statusText.innerHTML = `
        <div style="text-align: left; font-size: 14px; line-height: 1.6;">
            <strong>✅ Simulation Complete!</strong><br><br>
            To actually retrain the model:<br>
            1. SSH to your server<br>
            2. Navigate to: <code>cd ml-model</code><br>
            3. Run: <code>./retrain_model.sh</code><br><br>
            Or locally:<br>
            <code>cd ml-model && ./retrain_model.sh</code>
        </div>
    `;
    
    // Update button to close
    setTimeout(() => {
        startBtn.textContent = 'Close';
        startBtn.style.display = 'inline-block';
        startBtn.onclick = closeRetrainModal;
    }, 1000);
    
    // Check ML status after "retraining"
    checkMLStatus();
}

// Add this to your initialization
document.addEventListener('DOMContentLoaded', function() {
    // Add ML status button if not exists
    if (!document.getElementById('mlStatusBtn')) {
        const filtersDiv = document.querySelector('.filters');
        if (filtersDiv) {
            const mlButton = document.createElement('button');
            mlButton.className = 'filter-btn';
            mlButton.id = 'mlStatusBtn';
            mlButton.onclick = checkMLStatus;
            mlButton.innerHTML = '<span id="mlStatus">🤖 ML Status</span>';
            filtersDiv.appendChild(mlButton);
        }
    }
    
    // Check ML status on load
    checkMLStatus();
    
    // Check ML status periodically
    setInterval(checkMLStatus, 30000); // Every 30 seconds
});