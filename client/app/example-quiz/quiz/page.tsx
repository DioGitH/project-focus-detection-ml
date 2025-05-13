"use client";
import React from "react";
import { useUser } from "@/context/quizContext";
import { useEffect } from "react";

export default function QuizPage(){
    const { userData } = useUser();
    const { username, name, email } = userData;

    useEffect(() => {
        console.log("User Info:", userData); // Bisa dipakai untuk logika SocketIO atau lainnya
    }, []);

    return (
        <div className="w-screen flex justify-center">
            <div className="w-1/2">
                <h1 className="text-2xl font-bold text-center mt-4">
                    Quiz
                </h1>
                <p className="text-center mt-4">
                    {`Username: ${username}`}
                    <br />
                    {`name: ${name}`}
                </p>
            </div>
        </div>
    );
}