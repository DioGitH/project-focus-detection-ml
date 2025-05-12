"use client";
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { UsernameForm } from './username-form';

export default function VideoStream() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const processedFrameRef = useRef<HTMLImageElement | null>(null);
    const [angles, setAngles] = useState({ yaw: 0, pitch: 0, roll: 0 });
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [focus, setFocus] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const FPS = 50;
    const [isConnected, setIsConnected] = useState(false);
    const [username, setUsername] = useState<string>("");

    function socketUsersClient(){
        const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
            transports: ['websocket'],
        });

        // Set up socket event handlers
        socket.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        socket.on('receive_frame', (data) => {
            if (processedFrameRef.current) {
                processedFrameRef.current.src = data.frame;
            }
            setAngles(data.angles);
            setFocus(data.focused);
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });

        socket.on("not_focused_warning", (data) => {
            alert(data.message);
        });

        socketRef.current = socket;
    };

    useEffect(() => {
        socketUsersClient();
        return () => {
            stopCamera();
            socketRef?.current?.disconnect();
        };
    }, []);

    const capture = (videoElement: HTMLVideoElement) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // const targetSize = 224;
        canvas.width = 240;
        canvas.height = 180;

        if (ctx) {
            ctx.drawImage(videoElement, 0, 0, 240, 180);
        }

        return canvas;
    };


    const startCamera = async () => {
        try {
            // First make sure we're connected to the socket
            if (!socketRef.current?.connected) {
                socketRef.current?.connect();
            }

            socketRef.current?.emit('register_username', { username: username });

            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(mediaStream);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }

            // Function to capture and send frames with delay
            const captureFrameWithDelay = () => {
                if (!videoRef.current || !socketRef.current?.connected) return;

                // Capture frame from the video element
                const frame = capture(videoRef.current);
                const frameData = frame.toDataURL('image/jpeg', 0.6);

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
        <div className="flex flex-col items-center justify-center  min-h-screen gap-5 font-sans">
            <h1 className="text-3xl font-bold">Focus Detection</h1>
            {!username ? (
                <UsernameForm setUsername={setUsername} />
            ) : (
                <>
                    <p className="mt-4">Username: {username}</p>
                    <div className="flex flex-nowrap items-center gap-4">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-52 h-32 rounded-lg shadow-lg border border-gray-300 object-cover"
                        />
                        <img
                            ref={processedFrameRef}
                            src="./profile.jpg"
                            className="w-52 h-32 rounded-lg shadow-lg border border-gray-300 object-cover"
                            alt="Processed Frame"
                        />
                    </div>
                    <p className="text-lg">
                        <span className={`font-semibold ${Math.abs(angles.yaw) > 15 ? 'text-red-500' : ''}`}>
                            Yaw:
                        </span> {angles.yaw.toFixed(2)},{" "}

                        <span className={`font-semibold ${Math.abs(angles.pitch) > 15 ? 'text-red-500' : ''}`}>
                            Pitch:
                        </span> {angles.pitch.toFixed(2)},{" "}

                        <span className={`font-semibold ${Math.abs(angles.roll) > 15 ? 'text-red-500' : ''}`}>
                            Roll:
                        </span> {angles.roll.toFixed(2)}
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={startCamera}
                            className="px-6 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition"
                            disabled={!isConnected}
                        >
                            Start Session
                        </button>
                        <button
                            onClick={stopCamera}
                            className="px-6 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition"
                        >
                            Stop Session
                        </button>
                    </div>
                    <div className="text-sm">
                        Connection Status: {isConnected ? 'Connected' : 'Disconnected'}
                    </div>
                    <div className="text-sm">
                        Focus: {focus ? 'Focus' : 'Indicates Not Focused'}
                    </div>
                </>
            )}
        </div>
    );
}