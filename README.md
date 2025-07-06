# AI Music Finder & YouTube Downloader

This application has two main parts:
1.  **Frontend**: A React application for the user interface.
2.  **Backend**: A Node.js/Express server to handle YouTube video downloads.

## How to Run

You must run both the frontend and the backend servers for the application to work correctly.

### 1. Running the Backend Server

The backend server is responsible for processing YouTube URLs and providing the download stream.

1.  **Navigate to the server directory:**
    ```bash
    cd server
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the server:**
    ```bash
    npm start
    ```

The server will start on `http://localhost:4000`. Keep this terminal window open.

### 2. Running the Frontend Application

The frontend is the website you interact with.

1.  Open a **new terminal window** in the project's root directory.
2.  The frontend development server (which you are likely already running) will connect to the backend.

Now, you can use the YouTube Downloader feature on the website. It will make requests to your local backend server to download videos directly.

## Environment Variables

The frontend uses environment variables to configure the API URL:

- `VITE_API_URL`: The URL of the backend server (default: `http://localhost:4000`)

### Local Development
Create a `.env` file in the root directory:
```
VITE_API_URL=http://localhost:4000
```

### Production Deployment
Create a `.env.production` file in the root directory:
```
VITE_API_URL=https://your-backend-server.onrender.com
```

## Deployment

### Backend Deployment (Render.com)

1. Create a new Web Service on Render.com
2. Connect your GitHub repository
3. Set the following:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `FRONTEND_URL`: Your frontend URL (e.g., `https://your-frontend.onrender.com`)
     - `NODE_ENV`: `production`

### Frontend Deployment (Render.com)

1. Create a new Static Site on Render.com
2. Connect your GitHub repository
3. Set the following:
   - **Root Directory**: Leave empty (root folder)
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
   - **Environment Variables**:
     - `VITE_API_URL`: Your backend URL (e.g., `https://your-backend.onrender.com`)

### Deployment Notes

- The backend must be deployed first to get its URL
- Update the frontend's `VITE_API_URL` environment variable with the backend URL
- Update the backend's `FRONTEND_URL` environment variable with the frontend URL
- Both services will get free `.onrender.com` subdomains
