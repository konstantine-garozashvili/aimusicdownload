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
