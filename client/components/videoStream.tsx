"use client";
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function VideoStream() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const processedFrameRef = useRef<HTMLImageElement | null>(null);
    const [angles, setAngles] = useState({ yaw: 0, pitch: 0, roll: 0 });
    const [stream, setStream] = useState<MediaStream | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const FPS = 30;
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Initialize socket connection
        socketRef.current = io('http://192.168.1.25:5000', {
            transports: ['websocket'],
        });

        // Set up socket event handlers
        socketRef.current.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);
        });

        socketRef.current.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        socketRef.current.on('receive_frame', (data) => {
            if (processedFrameRef.current) {
                processedFrameRef.current.src = data.frame;
            }
            setAngles(data.angles);
        });

        socketRef.current.on('error', (error) => {
            console.error('Socket error:', error);
        });

        // Clean up on component unmount
        return () => {
            stopCamera();
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    const capture = (videoElement: HTMLVideoElement, scale: number = 1) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            canvas.width = videoElement.videoWidth * scale;
            canvas.height = videoElement.videoHeight * scale;
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        }
        return canvas;
    };

    const startCamera = async () => {
        try {
            // First make sure we're connected to the socket
            if (!socketRef.current?.connected) {
                socketRef.current?.connect();
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(mediaStream);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }

            // Function to capture and send frames with delay
            const captureFrameWithDelay = () => {
                if (!videoRef.current || !socketRef.current?.connected) return;

                // Capture frame from the video element
                const frame = capture(videoRef.current, 1);
                const frameData = frame.toDataURL('image/jpeg');

                // Send the captured frame to the server
                socketRef.current?.emit('send_frame', { frame: frameData });
            };

            // Set interval for sending frames
            const delay = 10000 / FPS; // Delay in milliseconds
            // Clear any existing interval first
            if (captureIntervalRef.current) {
                clearInterval(captureIntervalRef.current);
            }
            captureIntervalRef.current = setInterval(captureFrameWithDelay, delay);

        } catch (err) {
            console.error('Error accessing the camera: ', err);
            alert('Unable to access the camera. Please check your permissions.');
        }
    };

    const stopCamera = () => {
        // First, clear the frame sending interval
        if (captureIntervalRef.current) {
            clearInterval(captureIntervalRef.current);
            captureIntervalRef.current = null;
        }

        // Then stop media tracks
        if (stream) {
            const tracks = stream.getTracks();
            tracks.forEach((track) => track.stop());
            setStream(null);
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }

            // Send stop event to server before disconnecting
            if (socketRef.current?.connected) {
                socketRef.current.emit('stop_camera', {}, () => {
                    // Optional: Only disconnect if needed
                    // socketRef.current?.disconnect();
                });
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 pb-20 gap-8 sm:p-20 bg-gray-100 font-sans">
            <h1 className="text-3xl font-bold text-gray-800">Video Stream with Axis</h1>
            <div className="flex flex-col items-center gap-4">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full max-w-lg rounded-lg shadow-lg border border-gray-300"
                />
                <img
                    ref={processedFrameRef}
                    className="w-full max-w-lg rounded-lg shadow-lg border border-gray-300"
                    alt="Processed Frame"
                />
            </div>
            <p className="text-lg text-gray-700">
                <span className="font-semibold">Yaw:</span> {angles.yaw.toFixed(2)},{" "}
                <span className="font-semibold">Pitch:</span> {angles.pitch.toFixed(2)},{" "}
                <span className="font-semibold">Roll:</span> {angles.roll.toFixed(2)}
            </p>
            <div className="flex gap-4">
                <button
                    onClick={startCamera}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition"
                    disabled={!isConnected}
                >
                    Start Camera
                </button>
                <button
                    onClick={stopCamera}
                    className="px-6 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition"
                >
                    Stop Camera
                </button>
            </div>
            <div className="text-sm text-gray-500">
                Connection Status: {isConnected ? 'Connected' : 'Disconnected'}
            </div>
        </div>
    );
}