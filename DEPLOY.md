# Deploying to Render

This guide will help you deploy the ISIN Extractor app to Render.

## Prerequisites

- A GitHub account
- A Render account (sign up at https://render.com)
- Your code pushed to a GitHub repository

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Create a new Blueprint on Render**
   - Go to https://dashboard.render.com
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml` and create both services

3. **Set Environment Variables**
   
   After both services are created, you need to set environment variables:
   
   **For the Backend Service (isin-extractor-api):**
   - Go to the backend service settings
   - Add environment variable:
     - `FRONTEND_URL`: Your frontend URL (e.g., `https://isin-extractor-frontend.onrender.com`)
   
   **For the Frontend Service (isin-extractor-frontend):**
   - Go to the frontend service settings
   - Add environment variable:
     - `VITE_API_URL`: Your backend base URL (e.g., `https://isin-extractor-api.onrender.com`)
     - **Note**: Just the base URL, the `/extract-isin` endpoint will be added automatically

4. **Redeploy**
   - After setting environment variables, trigger a manual redeploy for both services

### Option 2: Manual Setup (Step by Step)

#### Deploy Backend

1. **Create a new Web Service**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure Backend Service:**
   - **Name**: `isin-extractor-api`
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Plan**: Free (or choose a paid plan)

3. **Add Environment Variables:**
   - `NODE_ENV`: `production`
   - `FRONTEND_URL`: (Leave empty for now, set after frontend is deployed)

4. **Deploy** - Render will automatically deploy your backend

#### Deploy Frontend

1. **Create a new Static Site**
   - Go to https://dashboard.render.com
   - Click "New +" → "Static Site"
   - Connect your GitHub repository

2. **Configure Frontend Service:**
   - **Name**: `isin-extractor-frontend`
   - **Build Command**: `cd client && npm install && npm run build`
   - **Publish Directory**: `client/dist`

3. **Add Environment Variable:**
   - `VITE_API_URL`: Your backend URL (e.g., `https://isin-extractor-api.onrender.com`)

4. **Deploy** - Render will build and deploy your frontend

5. **Update Backend CORS:**
   - Go back to your backend service
   - Update `FRONTEND_URL` environment variable to your frontend URL
   - Redeploy the backend

## Important Notes

- **Free Tier Limitations**: 
  - Services on the free tier spin down after 15 minutes of inactivity
  - First request after spin-down may take 30-60 seconds
  - Consider upgrading to a paid plan for production use

- **CORS**: Make sure `FRONTEND_URL` in the backend matches your frontend URL exactly (including `https://`)

- **Environment Variables**: 
  - Backend uses `FRONTEND_URL` to configure CORS
  - Frontend uses `VITE_API_URL` to connect to the backend API
  - These must be set correctly for the app to work

## Testing Your Deployment

1. Visit your frontend URL
2. Try the `/health` endpoint: `https://your-backend-url.onrender.com/health`
3. Test extracting ISINs from a PDF URL

## Troubleshooting

### "Failed to fetch" Error

If you see "Failed to fetch" when trying to extract ISINs:

1. **Check Environment Variables:**
   - Backend: Ensure `FRONTEND_URL` is set to your frontend URL (e.g., `https://isin-extractor-frontend.onrender.com`)
   - Frontend: Ensure `VITE_API_URL` is set to your backend base URL (e.g., `https://isin-extractor-api.onrender.com`)

2. **Verify Backend is Running:**
   - Go to your backend service on Render
   - Check the "Logs" tab to see if it's running
   - Test the health endpoint: `https://your-backend-url.onrender.com/health`
   - Should return `{"status":"ok"}`

3. **Rebuild Frontend:**
   - After setting `VITE_API_URL`, you MUST rebuild the frontend
   - Go to frontend service → Manual Deploy → Clear build cache & deploy
   - Vite environment variables are baked into the build at build time

4. **Check CORS:**
   - Backend `FRONTEND_URL` must exactly match your frontend URL (including `https://`)
   - No trailing slashes

5. **Check Network Tab:**
   - Open browser DevTools → Network tab
   - Try extracting ISINs
   - Look for the failed request and check the error message

### Other Common Issues

- **CORS Errors**: Check that `FRONTEND_URL` in backend matches your frontend domain exactly
- **API Not Found**: Verify `VITE_API_URL` in frontend points to your backend URL (base URL only)
- **Build Failures**: Check the build logs in Render dashboard for specific errors
- **Services Spinning Down**: Free tier services spin down after 15 min inactivity - first request may be slow

