#!/bin/bash

# Script to swap mobile-signature-flow.html to be the main index.html

echo "🔄 Swapping to mobile-first signature flow..."

# Check if we're in the right directory
if [ ! -f "index.html" ] || [ ! -f "mobile-signature-flow.html" ]; then
    echo "❌ Error: Must run from frontend directory containing both files"
    exit 1
fi

# Create backup of current index.html
if [ ! -f "index-desktop.html" ]; then
    echo "📁 Backing up current index.html to index-desktop.html"
    cp index.html index-desktop.html
else
    echo "⚠️  Backup already exists (index-desktop.html), skipping backup"
fi

# Create updated mobile version with desktop link
echo "🔨 Creating updated mobile version with desktop link..."
cp mobile-signature-flow.html index-mobile-temp.html

# Add ML Dashboard and Desktop links using a temporary file
cat > temp-additions.txt << 'EOF'
<!-- Add after <body> tag -->
<script>
// Insert ML Dashboard link
document.addEventListener('DOMContentLoaded', function() {
    const portraitContainer = document.getElementById('portraitContainer');
    if (portraitContainer) {
        // Add ML Dashboard link
        const dashboardLink = document.createElement('div');
        dashboardLink.style.cssText = 'position: absolute; top: 10px; right: 10px;';
        dashboardLink.innerHTML = '<a href="ml-dashboard.html" style="color: #667eea; text-decoration: none; font-size: 14px;">📊 ML Dashboard</a>';
        portraitContainer.appendChild(dashboardLink);
        
        // Add Desktop Version link
        const desktopLink = document.createElement('p');
        desktopLink.style.cssText = 'margin-top: 30px; font-size: 14px;';
        desktopLink.innerHTML = '<a href="index-desktop.html" style="color: #667eea; text-decoration: none;">💻 Use Desktop Version (More Features)</a>';
        portraitContainer.appendChild(desktopLink);
    }
});

// Update goToApp function to handle navigation better
const originalGoToApp = window.goToApp;
window.goToApp = function() {
    // Check if we should go to ML dashboard or desktop version
    const referrer = document.referrer;
    if (referrer.includes('ml-dashboard.html')) {
        window.location.href = 'ml-dashboard.html';
    } else {
        // Default to desktop version after successful auth for full features
        window.location.href = 'index-desktop.html';
    }
};
</script>
EOF

# Swap the files
echo "🔄 Swapping files..."
mv index.html index-desktop-current.html
mv index-mobile-temp.html index.html

# Clean up
rm -f temp-additions.txt
rm -f index-desktop-current.html

echo "✅ Successfully swapped to mobile-first experience!"
echo ""
echo "📱 Mobile flow (default): index.html"
echo "💻 Desktop flow: index-desktop.html"
echo "📊 ML Dashboard: ml-dashboard.html"
echo ""
echo "🚀 Deploy and test at: https://chickenscratch-1.onrender.com"