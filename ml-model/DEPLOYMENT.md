# Deploying the ML Server

The ML server needs to be deployed separately from your main backend. Here's how to deploy it on Render.

## Option 1: Deploy on Render (Recommended)

1. **Create a new Web Service on Render**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repo

2. **Configure the service:**
   - **Name**: `chickenscratch-ml` (or your preferred name)
   - **Root Directory**: `ml-model`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python ml_api_server.py`

3. **Add Environment Variables:**
   - `ML_PORT`: `10000` (Render uses port 10000 internally)

4. **After deployment, update your code:**
   - In `frontend/ml-dashboard.html`, replace `'https://your-ml-server.onrender.com'` with your actual ML server URL
   - In `backend/mlComparison.js`, replace `'https://your-ml-server.onrender.com'` with your actual ML server URL
   - Or set `ML_API_URL` environment variable in your main backend

## Option 2: Deploy Locally for Development

For development, you can just run the ML server locally:

```bash
cd ml-model
./start_ml_server.sh
```

## Important Notes

- The ML server must be HTTPS in production (Render provides this automatically)
- The trained model files are included in the repo, so they'll be deployed
- To retrain in production, you'll need to SSH into the server or set up a CI/CD pipeline
- Consider setting up a GitHub Action to retrain the model periodically

## Testing the Deployment

Once deployed, test your ML server:

```bash
# Replace with your actual ML server URL
curl https://chickenscratch-ml.onrender.com/api/health
```

You should see:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "feature_count": 19
}
```