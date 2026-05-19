import React, { useEffect, useRef } from 'react';

interface PreviewProps {
  code: string;
  isRunning: boolean;
  params?: Record<string, any>;
  isRecording: boolean;
}

export const Preview: React.FC<PreviewProps> = ({ code, isRunning, params = {}, isRecording }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Initial code load
  useEffect(() => {
    if (!isRunning) {
      if (iframeRef.current) {
        iframeRef.current.srcdoc = '';
      }
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
          <style>
            body { margin: 0; padding: 0; overflow: hidden; display: flex; justify-content: center; align-items: center; background: #000; height: 100vh; }
            canvas { display: block !important; max-width: 100%; max-height: 100%; object-fit: contain; }
          </style>
        </head>
        <body>
          <script>
            window.config = ${JSON.stringify(params)};
            let recorder;
            let chunks = [];
            
            // Listen for parameter updates and recording controls
            window.addEventListener('message', async (event) => {
              if (event.data.type === 'UPDATE_PARAMS') {
                Object.assign(window.config, event.data.params);
              }
              
              if (event.data.type === 'START_RECORDING') {
                startRecording();
              }
              
              if (event.data.type === 'STOP_RECORDING') {
                stopRecording();
              }
            });

            function startRecording() {
              const canvas = document.querySelector('canvas');
              if (!canvas) {
                console.warn('Canvas not found, trying to re-find in 100ms...');
                setTimeout(startRecording, 100);
                return;
              }
              
              chunks = [];
              const mimeTypes = [
                'video/mp4;codecs=h264',
                'video/webm;codecs=h264',
                'video/webm;codecs=vp9',
                'video/webm'
              ];
              const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
              
              const stream = canvas.captureStream(60); // 60 FPS
              const options = {
                mimeType: mimeType,
                videoBitsPerSecond: 8000000 // 8Mbps high quality
              };
              
              try {
                recorder = new MediaRecorder(stream, options);
              } catch (e) {
                console.error('MediaRecorder initialization failed:', e);
                recorder = new MediaRecorder(stream);
              }

              recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
              };
              
              recorder.onstop = () => {
                console.log('Finalizing recording, chunks:', chunks.length);
                if (chunks.length === 0) {
                  console.error('No data recorded');
                  return;
                }
                const blob = new Blob(chunks, { type: recorder.mimeType });
                const isMp4 = recorder.mimeType.includes('mp4');
                const extension = isMp4 ? 'mp4' : 'webm';
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = "creative-coding-" + Date.now() + "." + extension;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              };
              
              recorder.start(100); // Collecting data every 100ms for safety
              console.log('Recording started with:', recorder.mimeType);
            }

            function stopRecording() {
              if (recorder && recorder.state !== 'inactive') {
                recorder.stop();
                console.log('Recording stopped');
              }
            }

            try {
              // Inject code but replace explicit config declaration to use window.config
              ${code.replace(/const\s+config\s*=\s*{[\s\S]*?};/, 'const config = window.config;')}
            } catch (err) {
              console.error(err);
              document.body.innerHTML = '<div style="color: white; padding: 20px; font-family: monospace;">Error: ' + err.message + '</div>';
            }

            window.onerror = function(msg, url, lineNo, columnNo, error) {
              document.body.innerHTML = '<div style="color: #ff5555; padding: 20px; font-family: monospace;">' + msg + '</div>';
              return false;
            };
          </script>
        </body>
      </html>
    `;

    if (iframeRef.current) {
      iframeRef.current.srcdoc = html;
    }
  }, [code, isRunning]);

  // Handle Recording Toggle
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ 
        type: isRecording ? 'START_RECORDING' : 'STOP_RECORDING' 
      }, '*');
    }
  }, [isRecording]);

  // Real-time parameter sync
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ 
        type: 'UPDATE_PARAMS', 
        params 
      }, '*');
    }
  }, [params]);

  return (
    <div className="w-full h-full bg-neutral-900/50 flex items-center justify-center p-4 overflow-hidden relative">
      <div className="relative h-full max-h-full aspect-[3/4] bg-white shadow-2xl rounded-sm overflow-hidden border border-neutral-800">
        <iframe
          ref={iframeRef}
          title="p5-preview"
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-downloads"
        />
      </div>
    </div>
  );
};
