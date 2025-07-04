import React, { useState } from 'react';
import { DownloadIcon } from './icons';
import Loader from './Loader';

// A helper function to extract a YouTube Video ID from various URL formats.
const getYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match && match[1] ? match[1] : null;
};

const YoutubeDownloader: React.FC = () => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    setError(null);
    if (!url.trim()) {
      setError("Please enter a YouTube URL.");
      return;
    }

    if (!getYouTubeVideoId(url)) {
      setError("Invalid YouTube URL. Please check the link and try again.");
      return;
    }

    setIsLoading(true);

    try {
      // First, get video info and filename from backend
      const infoUrl = `http://localhost:4000/api/info?url=${encodeURIComponent(url)}`;
      const infoResponse = await fetch(infoUrl);
      
      if (!infoResponse.ok) {
        const errorText = await infoResponse.text();
        throw new Error(errorText || `Failed to get video info. Server responded with status ${infoResponse.status}.`);
      }
      
      const videoInfo = await infoResponse.json();
      const filename = videoInfo.filename || 'download.mp3';
      
      // Download the file as a blob and trigger download
      const downloadUrl = `http://localhost:4000/api/download?url=${encodeURIComponent(url)}&t=${Date.now()}`;
      
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Accept': 'audio/mpeg, application/octet-stream, */*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      
      // Get the blob data
      const blob = await response.blob();
      
      // Create a temporary URL for the blob
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor tag to trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      
      // Add to DOM, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl);
      
      setUrl(''); // Clear input after successful download
    } catch (err: any) {
      console.error("Download error:", err);
      setError(err.message || "Could not connect to the backend. Is it running?");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-700">
      <h2 className="text-2xl font-semibold mb-4 text-center text-gray-200">YouTube Music Downloader</h2>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleDownload()}
          placeholder="Paste YouTube video URL here..."
          disabled={isLoading}
          aria-invalid={!!error}
          aria-describedby="downloader-error"
          className={`flex-grow bg-gray-900 border ${error ? 'border-red-500' : 'border-gray-600'} rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 ${error ? 'focus:ring-red-500' : 'focus:ring-cyan-500'} focus:outline-none transition duration-200 disabled:opacity-50`}
        />
        <button
          onClick={handleDownload}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
        >
          {isLoading ? <Loader /> : <DownloadIcon className="w-5 h-5" />}
          <span>{isLoading ? 'Downloading...' : 'Download MP3'}</span>
        </button>
      </div>
      {error && (
        <p id="downloader-error" className="text-red-400 text-sm mt-2 text-center sm:text-left">{error}</p>
      )}
       <p className="text-xs text-gray-500 mt-4 text-center">
        Downloads are processed securely by our own server.
      </p>
    </div>
  );
};

export default YoutubeDownloader;