import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';

const app = express();
const PORT = 4000;

// Use CORS to allow requests from the frontend, which runs on a different port.
// Logging middleware
app.use((req, res, next) => {
  console.log(`Request Method: ${req.method}, Request URL: ${req.originalUrl}`);
  next();
});

// Explicit CORS configuration
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
});

app.get('/api/download', async (req, res) => {
  console.log('Download endpoint hit with URL:', req.query.url);
  
  // Set CORS headers IMMEDIATELY before any processing
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  
  console.log('CORS headers set immediately');
  
  const { url } = req.query;

  if (!url || !ytdl.validateURL(String(url))) {
    console.log('Invalid URL provided:', url);
    return res.status(400).send('Invalid or missing YouTube URL');
  }

  try {
    console.log('Getting video info for:', url);
    // Get video info to set a nice filename for the download.
    const info = await ytdl.getInfo(String(url));
    const title = info.videoDetails.title;
    console.log('Video title:', title);
    
    // Sanitize the title to create a valid filename.
    const sanitizedTitle = title
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Keep letters, numbers, spaces, hyphens, underscores
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 100); // Limit length to 100 characters
    
    console.log('Original title:', title);
    console.log('Sanitized filename:', sanitizedTitle);

    // Set headers to trigger a download in the browser as an MP3 audio file.
    // Use application/octet-stream to prevent IDM interference
    const filename = sanitizedTitle || 'youtube-audio';
    const safeFilename = filename.replace(/["\\]/g, ''); // Remove quotes and backslashes for header safety
    
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.mp3"`);
    res.setHeader('Content-Type', 'audio/mpeg'); // Change back to audio/mpeg for proper filename recognition
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    console.log('Download headers set with filename:', `${safeFilename}.mp3`);
    console.log('Content-Disposition header:', `attachment; filename="${safeFilename}.mp3"`);

    console.log('Starting audio stream...');
    
    // Create a readable stream from ytdl and pipe it to the response.
    const stream = ytdl(String(url), {
      quality: 'highestaudio',
      filter: 'audioonly',
    });
    
    let dataReceived = false;
    
    stream.on('info', (info, format) => {
      console.log('Stream info received:', format.container, format.audioCodec);
    });
    
    stream.on('data', (chunk) => {
      if (!dataReceived) {
        console.log('First data chunk received, size:', chunk.length);
        dataReceived = true;
      }
    });
    
    stream.on('error', (error) => {
      console.error('Stream error:', error.message);
      if (!res.headersSent) {
        res.status(500).send('Stream error occurred: ' + error.message);
      }
    });
    
    stream.on('end', () => {
      console.log('Stream ended successfully');
    });
    
    res.on('close', () => {
      console.log('Response connection closed');
    });
    
    res.on('error', (error) => {
      console.error('Response error:', error.message);
    });
    
    stream.pipe(res);
    console.log('Stream piped to response');

  } catch (error) {
    console.error('Error processing audio download:', error);
    if (!res.headersSent) {
      res.status(500).send('Failed to process audio. It might be private, age-restricted, or an invalid link.');
    }
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend server running at http://localhost:${PORT}`);
});