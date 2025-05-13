"use client";
import React from "react";
import { useState, useEffect } from "react";
import { QuizForm } from "@/components/quizForm";
import { useUser } from "@/context/quizContext";
import { useRouter} from "next/navigation";

export default function ExampleQuiz() {
    const [username, setUsername] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const { setUserData } = useUser();

    const router = useRouter();
    
    useEffect(() => {
        if (username && name && email) {
            setUserData({ username, name, email });
            router.push("/example-quiz/quiz");
        }
    }, [username, name, email, setUserData, router]);

    return (
        <div className="w-screen flex justify-center">
            <div className="w-1/2">
                <h1 className="text-2xl font-bold text-center mt-4">
                    Example Quiz    
                </h1>
                <QuizForm setUsername={setUsername} setName={setName} setEmail={setEmail}/>
            </div>
        </div>
    );
}