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
      // Point to the new local backend server
      const backendUrl = `http://localhost:4000/api/download?url=${encodeURIComponent(url)}`;
      const response = await fetch(backendUrl);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Download failed. Server responded with status ${response.status}.`);
      }

      // Extract filename from the 'Content-Disposition' header from the server.
      const disposition = response.headers.get('content-disposition');
      let filename = 'download.mp3'; // A sensible default for audio
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      // Get the data as a Blob, which is a file-like object.
      const blob = await response.blob();
      
      // Create a temporary URL for the blob.
      const downloadUrl = window.URL.createObjectURL(blob);
      
      // Create a hidden anchor tag to trigger the download.
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      
      // Clean up by revoking the object URL and removing the anchor.
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
      
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