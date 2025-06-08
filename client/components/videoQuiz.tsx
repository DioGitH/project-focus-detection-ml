"use client";
import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from "sonner"

export type VideoQuizHandle = {
    startCamera: () => void;
    stopCamera: () => void;
    regist_user: () => void;
};

const VideoQuiz = forwardRef<VideoQuizHandle, { username: string; onSummaryReceived?:(summary:any)=>void }>(({ username, onSummaryReceived }, ref, ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [focus, setFocus] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const FPS = 33;

    useImperativeHandle(ref, () => ({
        startCamera,
        stopCamera,
        regist_user
    }));

    function socketUsersClient() {
        const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
            transports: ['websocket'],
        });

        socket.on('connect', () => {
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('receive_status', (data) => {
            setFocus(data.focused);
        });

        socket.on("not_focused_warning", (data) => {
            toast.warning("", {
                description: data.message,
                duration: Infinity,
            })
        });

        socket.on('session_summary', (data) => {
            onSummaryReceived?.(data);
        });

        socketRef.current = socket;
    }

    useEffect(() => {
        socketUsersClient();
        return () => {
            socketRef.current?.disconnect();
        };
    }, []);

    function capture(videoElement: HTMLVideoElement) {
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoElement, 0, 0, 240, 180);
        }
        return canvas;
    }


    const startCamera = async () => {
        if (!socketRef.current?.connected) {
            socketRef.current?.connect();
        }

        // socketRef.current?.emit('register_username', { username });

        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(mediaStream);

        if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
        }

        const captureFrameWithDelay = () => {
            if (!videoRef.current || !socketRef.current?.connected) return;
            const frame = capture(videoRef.current);
            const frameData = frame.toDataURL('image/jpeg', 0.6);
            socketRef.current?.emit('frame_camera', { frame: frameData });
        };

        const delay = 10000 / FPS;
        if (captureIntervalRef.current) {
            clearInterval(captureIntervalRef.current);
        }
        captureIntervalRef.current = setInterval(captureFrameWithDelay, delay);
    };

    const stopCamera = () => {
        if (captureIntervalRef.current) {
            clearInterval(captureIntervalRef.current);
            captureIntervalRef.current = null;
        }

        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }

            socketRef.current?.emit('stop_camera', {});
        }
    };

    const regist_user = () => {
        socketRef.current?.emit('register_username', { username});
    };

    return (
        <div className="flex flex-col items-center justify-center gap-2 font-sans">
            <div className="text-[8px]">
                Connection Status: {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-52 h-32 rounded-lg shadow-lg border border-gray-300 object-cover"
            />
            <div className="text-[8px]">
                Focus: {focus ? 'Focus' : 'Not Focused'}
            </div>
        </div>
    );
});

export default VideoQuiz;