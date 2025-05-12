"use client";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function AdminPage() {
    const [streams, setStreams] = useState<{ [key: string]: { frame: string; focused: boolean; username:string } }>({});
    const socketRef = useRef<any>(null);
    const [requestVideo, setRequestVideo] = useState(false);
    const [stopRequest, setStopRequest] = useState(false);
    const [buttonDisabled, setButtonDisabled] = useState(false);

    function socketAdminClient() {
        const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
            transports: ["websocket"],
        });

        socket.on("receive_all_frame", (data: any) => {
            setStreams((prev) => ({
                ...prev,
                [data.client_id]: {
                    frame: data.frame,
                    focused: data.focused,
                    username: data.username,
                },
            }));
        });

        socket.on("user_disconnected", (data: any) => {
            setStreams((prev) => {
                const updated = { ...prev };
                delete updated[data.client_id]; // hapus data user
                return updated;
            });
        });

        socketRef.current = socket;

    }

    useEffect(() => {
        socketAdminClient();
        return () => {
            socketRef?.current?.disconnect();
        }
    }, []);

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        if (requestVideo) {
            socket.emit("request_video_admin");
            setRequestVideo(false);
        }

        if (stopRequest) {
            socket.emit("stop_video_admin");
            setStreams({});
            setRequestVideo(false);
            setStopRequest(false);
            setButtonDisabled(false);
        }
    }, [requestVideo, stopRequest]);

    return (
        <div className="flex justify-center px-6">
            <div className="grid grid-cols-1">
                <div className="flex justify-center items-center flex-col mb-4">
                    <h1 className="text-2xl font-bold mb-4">Admin View – All Users</h1>
                    <div className="flex justify-center items-center gap-4 mb-4">
                        <button
                            className="bg-amber-800 text-white px-4 py-2 rounded hover:bg-amber-700 transition"
                            onClick={() => {
                                setRequestVideo(true);
                                setButtonDisabled(true);
                            }}
                            disabled={buttonDisabled}
                        >
                            Request Video
                        </button>

                        <button
                            className="bg-amber-800 text-white px-4 py-2 rounded hover:bg-amber-700 transition"
                            onClick={() => setStopRequest(true)}
                        >
                            Stop Video
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(streams).map(([clientId, streamData]) => (
                        <div key={clientId} className="border rounded-lg shadow bg-white p-2">
                            <img src={streamData.frame} alt={`User ${clientId}`} className="w-full h-auto rounded" />
                            <p className="text-xs mt-1 text-gray-600">Username: {streamData.username}</p>
                            <p className={`text-xs mt-1 ${streamData.focused ? 'text-green-600' : 'text-red-600'}`}>
                                {streamData.focused ? 'Focused' : 'Not Focused'}
                            </p>
                        </div>
                    ))}

                </div>
            </div>
        </div>
    );
}
