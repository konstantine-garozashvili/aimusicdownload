import React, { useState } from 'react';
import { VideoResult, VideoInfo, DownloadOptions, AvailableFormat } from '../types';

const YoutubeDownloader: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [result, setResult] = useState<VideoResult | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'mp3' | 'mp4'>('mp3');
  const [selectedQuality, setSelectedQuality] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState<{
    percentage: number;
    stage: string;
    status: string;
    downloadId?: string;
  } | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionComplete, setConversionComplete] = useState(false);
  const [convertedDownloadId, setConvertedDownloadId] = useState<string | null>(null);

  // Progress polling function
  const pollProgress = async (downloadId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:4000/api/progress/${downloadId}`);
        if (response.ok) {
          const progressData = await response.json();
          setDownloadProgress(progressData);
          
          console.log(`Progress: ${progressData.percentage}% - ${progressData.stage}`);
          
          // Stop polling when download is complete or failed
          if (progressData.status === 'completed' || progressData.status === 'error') {
            clearInterval(pollInterval);
            if (progressData.status === 'completed') {
               setTimeout(() => {
                 setDownloadProgress(null);
                 setIsDownloading(false);
               }, 2000);
             } else {
               setIsDownloading(false);
               setError('Download failed: ' + progressData.stage);
             }
          }
        } else if (response.status === 404) {
          // Progress not found, stop polling
          clearInterval(pollInterval);
          setDownloadProgress(null);
        }
      } catch (error) {
        console.error('Error polling progress:', error);
      }
    }, 500); // Poll every 500ms
    
    // Cleanup after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 300000);
  };

  const handleGetInfo = async () => {
    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    setIsLoading(true);
    setError('');
    setVideoInfo(null);
    setResult(null);
    setDownloadProgress(null);
    setIsConverting(false);
    setConversionComplete(false);
    setConvertedDownloadId(null);

    try {
      console.log('Fetching video info for URL:', url);
      
      const infoResponse = await fetch(`http://localhost:4000/api/info?url=${encodeURIComponent(url)}`);
      
      if (!infoResponse.ok) {
        throw new Error(`Failed to get video info: ${infoResponse.status}`);
      }
      
      const info = await infoResponse.json();
      console.log('Video info received:', info);
      console.log('Available formats:', info.availableFormats);
      
      // Log each format for debugging
      if (info.availableFormats && Array.isArray(info.availableFormats)) {
        info.availableFormats.forEach((format, index) => {
          console.log(`Format ${index}:`, {
            itag: format.itag,
            quality: format.quality,
            qualityLabel: format.qualityLabel,
            container: format.container,
            hasVideo: format.hasVideo,
            hasAudio: format.hasAudio
          });
        });
      }
      
      setVideoInfo(info);
      
      // Set default quality based on available formats
      if (info.availableFormats && Array.isArray(info.availableFormats)) {
        const availableFormats = selectedFormat === 'mp3' 
          ? info.availableFormats.filter(f => f.hasAudio && !f.hasVideo)
          : info.availableFormats.filter(f => f.hasVideo && f.hasAudio);
        
        if (availableFormats.length > 0) {
          setSelectedQuality(availableFormats[0].itag.toString());
        }
      }
      
    } catch (err) {
      console.error('Info fetch error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching video info');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!videoInfo || !selectedQuality) {
      setError('Please select a quality option');
      return;
    }

    setIsConverting(true);
    setError('');
    setDownloadProgress(null);
    setConversionComplete(false);
    setConvertedDownloadId(null);

    let downloadId: string | null = null;
    
    try {
      console.log('Starting conversion with format:', selectedFormat, 'quality:', selectedQuality);
      
      // Find the selected format to get quality information
      const selectedFormatInfo = getAvailableQualities().find(f => f.itag.toString() === selectedQuality);
      const qualityLabel = selectedFormatInfo ? (selectedFormatInfo.qualityLabel || selectedFormatInfo.quality || 'unknown') : 'unknown';
      
      // Build download URL with format, quality, and itag parameters
      const downloadUrl = `http://localhost:4000/api/download?url=${encodeURIComponent(url)}&format=${selectedFormat}&quality=${encodeURIComponent(qualityLabel)}&itag=${selectedQuality}`;
      
      console.log('Conversion URL:', downloadUrl);
      console.log('Selected format info:', selectedFormatInfo);
      
      // Check if this is an FFmpeg merge (video-only format)
      const isFFmpegMerge = requiresFFmpeg(selectedFormatInfo);
      
      if (!isFFmpegMerge) {
        setError('Cette qualité ne nécessite pas de conversion FFmpeg. Utilisez le bouton de téléchargement direct.');
        setIsConverting(false);
        return;
      }
      
      console.log('FFmpeg merge required for format:', selectedFormatInfo.itag, selectedFormatInfo.qualityLabel);

      console.log('Starting FFmpeg conversion process...');
      console.log('Download URL for conversion:', downloadUrl);
      
      // First, make a HEAD request to get download ID
      try {
        console.log('Making HEAD request to get download ID...');
        const headResponse = await fetch(downloadUrl, { method: 'HEAD' });
        console.log('HEAD response status:', headResponse.status);
        console.log('HEAD response headers:', Object.fromEntries(headResponse.headers.entries()));
        
        const headDownloadId = headResponse.headers.get('X-Download-ID');
        
        if (headDownloadId) {
          downloadId = headDownloadId;
          console.log('Got download ID for conversion:', downloadId);
          setDownloadProgress({
            percentage: 0,
            stage: 'Initialisation de la conversion...',
            status: 'starting',
            downloadId
          });
        } else {
          console.error('No X-Download-ID header found in HEAD response');
          setError('Aucun ID de téléchargement reçu du serveur');
          setIsConverting(false);
          return;
        }
      } catch (headError) {
        console.error('HEAD request failed:', headError);
        console.error('HEAD error details:', headError);
        setError('Impossible d\'obtenir l\'ID de téléchargement: ' + (headError instanceof Error ? headError.message : 'Erreur inconnue'));
        setIsConverting(false);
        return;
      }
      
      console.log('=== HEAD REQUEST SUCCESSFUL, PROCEEDING TO GET REQUEST ===');
      
      // Start the actual conversion with the downloadId header
      if (downloadId) {
        try {
          console.log('=== STARTING GET REQUEST FOR CONVERSION ===');
          console.log('Making GET request with X-Download-ID header:', downloadId);
          console.log('GET request URL:', downloadUrl);
          console.log('Request headers will include X-Download-ID:', downloadId);
          
          const conversionResponse = await fetch(downloadUrl, {
            method: 'GET',
            headers: {
              'X-Download-ID': downloadId
            }
          });
          
          console.log('=== GET REQUEST COMPLETED ===');
          
          console.log('GET response status:', conversionResponse.status);
          console.log('GET response headers:', Object.fromEntries(conversionResponse.headers.entries()));
          
          if (conversionResponse.ok) {
            const conversionResult = await conversionResponse.json();
            console.log('FFmpeg conversion request sent successfully:', conversionResult);
            
            // Verify the downloadId matches
            if (conversionResult.downloadId && conversionResult.downloadId === downloadId) {
              console.log('Conversion started with download ID:', downloadId);
            } else {
              console.warn('Download ID mismatch in conversion response');
              console.warn('Expected:', downloadId, 'Received:', conversionResult.downloadId);
            }
          } else {
            const errorText = await conversionResponse.text();
            console.error('Conversion response error:', errorText);
            throw new Error(`Conversion request failed: ${conversionResponse.status} - ${errorText}`);
          }
        } catch (error) {
          console.error('=== ERROR IN GET REQUEST ===');
          console.error('Error starting FFmpeg conversion:', error);
          console.error('Error type:', typeof error);
          console.error('Error details:', error);
          setError('Erreur lors du démarrage de la conversion: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
          setIsConverting(false);
          return;
        }
      } else {
        console.error('=== NO DOWNLOAD ID AVAILABLE FOR GET REQUEST ===');
        setError('Aucun ID de téléchargement disponible');
        setIsConverting(false);
        return;
      }
      
      // Set up progress tracking
      if (downloadId) {
        console.log('Starting progress tracking for conversion:', downloadId);
        setDownloadProgress({
          percentage: 0,
          stage: 'Démarrage de la conversion...',
          status: 'starting',
          downloadId
        });
        
        // Poll progress and wait for completion
        const pollInterval = setInterval(async () => {
          try {
            console.log('Polling progress for downloadId:', downloadId);
            const progressResponse = await fetch(`http://localhost:4000/api/progress/${downloadId}`);
            console.log('Progress response status:', progressResponse.status);
            
            if (progressResponse.ok) {
              const progressData = await progressResponse.json();
              console.log('Progress data received:', progressData);
              
              setDownloadProgress({
                percentage: progressData.percentage,
                stage: progressData.stage,
                status: progressData.status,
                downloadId
              });
              
              // When conversion is completed
              if (progressData.status === 'completed' && progressData.percentage === 100) {
                clearInterval(pollInterval);
                console.log('FFmpeg conversion completed!');
                
                setConversionComplete(true);
                setConvertedDownloadId(downloadId);
                setIsConverting(false);
                setDownloadProgress(null);
              }
              
              // Handle errors
              if (progressData.status === 'error') {
                clearInterval(pollInterval);
                console.error('Conversion error from progress:', progressData.error);
                throw new Error('FFmpeg conversion failed');
              }
            } else {
              console.warn('Progress polling failed with status:', progressResponse.status);
              const errorText = await progressResponse.text();
              console.warn('Progress polling error response:', errorText);
              clearInterval(pollInterval);
              throw new Error('Progress tracking failed');
            }
          } catch (error) {
            clearInterval(pollInterval);
            console.error('Progress polling error:', error);
            setError('Erreur lors de la conversion: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
            setIsConverting(false);
            setDownloadProgress(null);
          }
        }, 2000); // Poll every 2 seconds
        
        // Set timeout for the entire process (10 minutes)
        setTimeout(() => {
          clearInterval(pollInterval);
          if (isConverting) {
            console.log('FFmpeg conversion timeout');
            setError('La conversion a pris trop de temps. Veuillez réessayer.');
            setIsConverting(false);
            setDownloadProgress(null);
          }
        }, 600000);
        
      } else {
        setError('Impossible de démarrer la conversion FFmpeg');
        setIsConverting(false);
      }
      
    } catch (err) {
      console.error('Conversion error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la conversion');
      setIsConverting(false);
      setDownloadProgress(null);
    }
  };

  const handleDownload = async () => {
    if (!videoInfo || !selectedQuality) {
      setError('Please select a quality option');
      return;
    }

    setIsDownloading(true);
    setError('');

    let timeoutId: NodeJS.Timeout | undefined;
    let downloadId: string | null = null;
    
    try {
      console.log('Starting download with format:', selectedFormat, 'quality:', selectedQuality);
      
      // Find the selected format to get quality information
      const selectedFormatInfo = getAvailableQualities().find(f => f.itag.toString() === selectedQuality);
      const qualityLabel = selectedFormatInfo ? (selectedFormatInfo.qualityLabel || selectedFormatInfo.quality || 'unknown') : 'unknown';
      
      // Check if this is an FFmpeg merge that needs conversion first
      const isFFmpegMerge = requiresFFmpeg(selectedFormatInfo);
      
      if (isFFmpegMerge) {
        // For FFmpeg merges, use the converted file if available
        if (conversionComplete && convertedDownloadId) {
          console.log('Downloading converted file with ID:', convertedDownloadId);
          const fileDownloadUrl = `http://localhost:4000/api/download-file/${convertedDownloadId}`;
          const link = document.createElement('a');
          link.href = fileDownloadUrl;
          link.download = `${videoInfo.filename}.${selectedFormat}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          console.log('Download completed successfully');
          setResult({
            title: videoInfo.title || 'Unknown Title',
            artist: 'YouTube',
            youtubeUrl: url,
            thumbnailUrl: videoInfo.thumbnail || ''
          });
          return;
        } else {
          setError('Veuillez d\'abord convertir la vidéo avant de télécharger');
          return;
        }
      }
      
      // For non-FFmpeg formats, use regular blob download
      const downloadUrl = `http://localhost:4000/api/download?url=${encodeURIComponent(url)}&format=${selectedFormat}&quality=${encodeURIComponent(qualityLabel)}&itag=${selectedQuality}`;
      
      console.log('Download URL:', downloadUrl);
      console.log('Selected format info:', selectedFormatInfo);
      
      console.log('Using blob download for regular formats...');
      
      // Create manual abort controller for better browser compatibility
      const abortController = new AbortController();
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, 300000); // 5 minutes timeout
      
      const downloadResponse = await fetch(downloadUrl, {
        method: 'GET',
        signal: abortController.signal
      });
      
      // Clear timeout if request completes successfully
      clearTimeout(timeoutId);
      
      if (!downloadResponse.ok) {
        throw new Error(`Download failed: ${downloadResponse.status}`);
      }
      
      // Check for download ID in headers for progress tracking
      downloadId = downloadResponse.headers.get('X-Download-ID');
      if (downloadId) {
        console.log('Starting progress tracking for download ID:', downloadId);
        setDownloadProgress({
          percentage: 0,
          stage: 'Initialisation...',
          status: 'starting',
          downloadId
        });
        pollProgress(downloadId);
      }
      
      // Get the blob
      const blob = await downloadResponse.blob();
      console.log('Blob received, size:', blob.size);
      
      // Create a temporary URL for the blob
      const blobUrl = URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${videoInfo.filename}.${selectedFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      URL.revokeObjectURL(blobUrl);
      
      console.log('Download completed successfully');
      
      setResult({
        title: videoInfo.title || 'Unknown Title',
        artist: 'YouTube',
        youtubeUrl: url,
        thumbnailUrl: videoInfo.thumbnail || ''
      });
        
    } catch (err) {
      console.error('Download error:', err);
      
      // Clear timeout in case of error
      if (typeof timeoutId !== 'undefined') {
        clearTimeout(timeoutId);
      }
      
      let errorMessage = 'An error occurred during download';
      
      if (err instanceof Error) {
        if (err.name === 'AbortError' || err.message.includes('aborted')) {
          errorMessage = 'Le téléchargement a pris trop de temps ou a été interrompu. Veuillez réessayer avec une qualité inférieure.';
        } else if (err.name === 'TimeoutError' || err.message.includes('timeout')) {
          errorMessage = 'Le téléchargement a pris trop de temps. Veuillez réessayer avec une qualité inférieure.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setDownloadProgress(null);
    } finally {
      setIsDownloading(false);
    }
  };

  const getAvailableQualities = (): AvailableFormat[] => {
    if (!videoInfo || !videoInfo.availableFormats || !Array.isArray(videoInfo.availableFormats)) return [];
    
    // Filter formats based on selected format type
    const formats = selectedFormat === 'mp3' 
      ? videoInfo.availableFormats.filter(format => format.hasAudio && !format.hasVideo)
      : videoInfo.availableFormats.filter(format => format.hasVideo); // Include both video+audio and video-only formats
    
    return formats;
  };

  const formatQualityLabel = (format: AvailableFormat): string => {
    if (selectedFormat === 'mp3') {
      // For MP3, show bitrate if available, otherwise show quality
      const bitrate = format.quality.includes('kbps') ? format.quality : `${format.audioBitrate || 'Unknown'} kbps`;
      return bitrate;
    } else {
      const qualityLabel = `${format.qualityLabel || format.quality || 'Unknown'} (${format.container})`;
      // Add note for video-only formats that require FFmpeg
      if (format.hasVideo && !format.hasAudio) {
        return `${qualityLabel} - HD (nécessite FFmpeg)`;
      }
      return qualityLabel;
    }
  };
  
  // Helper function to check if a format requires FFmpeg
  const requiresFFmpeg = (format: AvailableFormat): boolean => {
    return format && format.hasVideo && !format.hasAudio;
  };

  const handleFormatChange = (format: 'mp3' | 'mp4') => {
    setSelectedFormat(format);
    setSelectedQuality('');
    
    // Auto-select first available quality when format changes
    if (videoInfo && videoInfo.availableFormats && Array.isArray(videoInfo.availableFormats)) {
      const availableFormats = format === 'mp3' 
        ? videoInfo.availableFormats.filter(f => f.hasAudio && !f.hasVideo)
        : videoInfo.availableFormats.filter(f => f.hasVideo); // Include both video+audio and video-only formats
      
      if (availableFormats.length > 0) {
        setSelectedQuality(availableFormats[0].itag.toString());
      }
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-700 w-full max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center text-gray-200">
        Téléchargeur YouTube
      </h2>
      
      <div className="space-y-6">
        {/* URL Input */}
        <div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Collez l'URL YouTube ici..."
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition duration-200 disabled:opacity-50"
            disabled={isLoading}
          />
        </div>
        
        {/* Format Selection */}
        <div className="flex gap-6">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              value="mp3"
              checked={selectedFormat === 'mp3'}
              onChange={(e) => handleFormatChange(e.target.value as 'mp3' | 'mp4')}
              className="mr-3 text-cyan-500 focus:ring-cyan-500"
              disabled={isLoading || isDownloading}
            />
            <span className="text-gray-300">MP3 (Audio seulement)</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              value="mp4"
              checked={selectedFormat === 'mp4'}
              onChange={(e) => handleFormatChange(e.target.value as 'mp3' | 'mp4')}
              className="mr-3 text-cyan-500 focus:ring-cyan-500"
              disabled={isLoading || isDownloading}
            />
            <span className="text-gray-300">MP4 (Vidéo)</span>
          </label>
        </div>
        
        {/* Get Info Button */}
        <button
          onClick={handleGetInfo}
          disabled={isLoading || !url.trim()}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            'Obtenir les infos vidéo'
          )}
        </button>
        
        {/* Video Info Display */}
        {videoInfo && (
          <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-4 space-y-4">
            {/* Thumbnail and Title */}
            <div className="flex gap-4">
              {videoInfo.thumbnail && (
                <img
                  src={videoInfo.thumbnail}
                  alt="Miniature vidéo"
                  className="w-32 h-24 object-cover rounded-lg flex-shrink-0 border border-gray-600"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-200 mb-2">{videoInfo.title}</h3>
                <p className="text-sm text-gray-400">Durée: {videoInfo.duration || 'Inconnue'}</p>
              </div>
            </div>
            
            {/* Quality Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Sélectionner la qualité:
              </label>
              <select
                value={selectedQuality}
                onChange={(e) => setSelectedQuality(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                disabled={isDownloading}
              >
                <option value="">Choisir la qualité...</option>
                {getAvailableQualities().map((format) => (
                  <option key={format.itag} value={format.itag}>
                    {formatQualityLabel(format)}
                  </option>
                ))}
              </select>
            </div>
            
            {/* HD Video Processing Notice */}
            {selectedFormat === 'mp4' && selectedQuality && (() => {
              const selectedFormatInfo = getAvailableQualities().find(f => f.itag.toString() === selectedQuality);
              const needsFFmpeg = requiresFFmpeg(selectedFormatInfo);
              
              console.log('Selected format info:', selectedFormatInfo);
              console.log('Needs FFmpeg:', needsFFmpeg);
              
              return needsFFmpeg ? (
                <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3 text-sm text-blue-200">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-xs text-white font-bold">i</div>
                    <span>Cette qualité HD nécessite un traitement FFmpeg (fusion vidéo/audio). Le téléchargement peut prendre 2-5 minutes.</span>
                  </div>
                  <div className="mt-2 text-xs text-blue-300">
                    Format: {selectedFormatInfo?.itag} - {selectedFormatInfo?.qualityLabel} | 
                    Vidéo: {selectedFormatInfo?.hasVideo ? 'Oui' : 'Non'} | 
                    Audio: {selectedFormatInfo?.hasAudio ? 'Oui' : 'Non'}
                  </div>
                </div>
              ) : selectedFormatInfo ? (
                <div className="bg-green-900/30 border border-green-600 rounded-lg p-3 text-sm text-green-200">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-xs text-white font-bold">✓</div>
                    <span>Cette qualité contient déjà l'audio. Téléchargement direct disponible.</span>
                  </div>
                  <div className="mt-2 text-xs text-green-300">
                    Format: {selectedFormatInfo?.itag} - {selectedFormatInfo?.qualityLabel} | 
                    Vidéo: {selectedFormatInfo?.hasVideo ? 'Oui' : 'Non'} | 
                    Audio: {selectedFormatInfo?.hasAudio ? 'Oui' : 'Non'}
                  </div>
                </div>
              ) : null;
            })()}
            
            {/* Convert/Download Buttons */}
            {(() => {
              const selectedFormatInfo = getAvailableQualities().find(f => f.itag.toString() === selectedQuality);
              const isFFmpegMerge = requiresFFmpeg(selectedFormatInfo);
              
              console.log('Button logic - Selected format:', selectedFormatInfo?.itag, selectedFormatInfo?.qualityLabel);
              console.log('Button logic - Requires FFmpeg:', isFFmpegMerge);
              
              if (isFFmpegMerge) {
                // For FFmpeg formats, show Convert button first, then Download button after conversion
                return (
                  <div className="space-y-3">
                    {!conversionComplete ? (
                      <button
                        onClick={handleConvert}
                        disabled={isConverting || !selectedQuality}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-orange-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2"
                      >
                        {isConverting ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          'Convertir en MP4'
                        )}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-green-900/30 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg">
                          <p className="font-semibold">✓ Conversion terminée !</p>
                          <p className="text-sm">La vidéo est prête à être téléchargée en MP4.</p>
                        </div>
                        <button
                          onClick={handleDownload}
                          disabled={isDownloading}
                          className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2"
                        >
                          {isDownloading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          ) : (
                            'Télécharger MP4'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              } else {
                // For regular formats, show direct download button
                return (
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading || !selectedQuality}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2"
                  >
                    {isDownloading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      `Télécharger ${selectedFormat.toUpperCase()}`
                    )}
                  </button>
                );
              }
            })()}
            
            {/* Progress Display */}
            {(isConverting || isDownloading) && (
              <div className="mt-4 p-4 bg-gray-900/50 border border-gray-600 rounded-lg">
                {downloadProgress ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${isConverting ? 'text-orange-400' : 'text-cyan-400'}`}>
                        {downloadProgress.stage}
                      </span>
                      <span className={`font-bold ${isConverting ? 'text-orange-300' : 'text-cyan-300'}`}>
                        {downloadProgress.percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full transition-all duration-300 ease-out ${
                          isConverting 
                            ? 'bg-gradient-to-r from-orange-500 to-red-600' 
                            : 'bg-gradient-to-r from-cyan-500 to-blue-600'
                        }`}
                        style={{ width: `${downloadProgress.percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-sm text-gray-400">
                      Status: {downloadProgress.status} {downloadProgress.downloadId && `(ID: ${downloadProgress.downloadId.slice(-8)})`}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <div className={`animate-spin rounded-full h-4 w-4 border-b-2 mr-2 ${
                      isConverting ? 'border-orange-500' : 'border-cyan-500'
                    }`}></div>
                    <span className={isConverting ? 'text-orange-400' : 'text-cyan-400'}>
                      {isConverting ? 'Initialisation de la conversion...' : 'Initialisation du téléchargement...'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Success Message */}
        {result && (
          <div className="bg-green-900/30 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg">
            <p className="font-semibold">Téléchargement terminé !</p>
            <p className="text-sm">{result.title}</p>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default YoutubeDownloader;