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

// New endpoint to get video info without downloading
app.get('/api/info', async (req, res) => {
  console.log('Info endpoint hit with URL:', req.query.url);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  
  const { url } = req.query;

  if (!url || !ytdl.validateURL(String(url))) {
    console.log('Invalid URL provided:', url);
    return res.status(400).json({ error: 'Invalid or missing YouTube URL' });
  }

  try {
    console.log('Getting video info for:', url);
    const info = await ytdl.getInfo(String(url));
    const title = info.videoDetails.title;
    console.log('Video title:', title);
    
    // Sanitize the title to create a valid filename
    const sanitizedTitle = title
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Keep letters, numbers, spaces, hyphens, underscores
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 100); // Limit length to 100 characters
    
    const filename = (sanitizedTitle || 'youtube-audio') + '.mp3';
    
    res.json({
      title: title,
      filename: filename,
      duration: info.videoDetails.lengthSeconds
    });
    
  } catch (error) {
    console.error('Error getting video info:', error);
    res.status(500).json({ error: 'Failed to get video information' });
  }
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
    const filename = sanitizedTitle || 'youtube-audio';
    const safeFilename = filename.replace(/["\\]/g, ''); // Remove quotes and backslashes for header safety
    const fullFilename = `${safeFilename}.mp3`;
    
    // Anti-download-manager headers to force browser-native downloads
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    
    // Use RFC 6266 compliant Content-Disposition header with UTF-8 encoding
    const encodedFilename = encodeURIComponent(fullFilename);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.mp3"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Type', 'application/force-download'); // Force download type to bypass IDM
    res.setHeader('Content-Transfer-Encoding', 'binary');
    res.setHeader('X-Suggested-Filename', fullFilename); // Fallback header for browsers
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '-1');
    
    console.log('Download headers set with filename:', fullFilename);
    console.log('Content-Disposition header:', `attachment; filename="${safeFilename}.mp3"; filename*=UTF-8''${encodedFilename}`);
    console.log('X-Suggested-Filename header:', fullFilename);

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