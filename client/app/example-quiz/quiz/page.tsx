"use client";
import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@/context/quizContext";
import QuestionCard from "@/components/question-card";
import { questions } from "@/data/questions";
import VideoQuiz, { VideoQuizHandle } from "@/components/videoQuiz";

export default function QuizPage(){
    const { userData } = useUser();
    const { username, name, email } = userData;

    const videoRef = useRef<VideoQuizHandle>(null);
    const [current, setCurrent] = useState(0);
    const [score, setScore] = useState(0);

    useEffect(() => {
        videoRef.current?.startCamera();

        return () => {
            // Stop kamera saat komponen di-unmount
            videoRef.current?.stopCamera();
        };
    }, []);

    const handleAnswer = (answer: string) => {
        if (answer === questions[current].answer) {
            setScore(score + 1);
        }

        if (current + 1 < questions.length) {
            setCurrent(current + 1);
        } 
        else {
            alert(`Quiz selesai! Skor Anda: ${score} dari ${questions.length}`);
            // Reset quiz
            videoRef.current?.stopCamera();
            setCurrent(0);
            setScore(0);
        }
    };

    return (
        <div className="w-screen flex justify-center">
            <div className="w-[80vw]">
                <div className="grid grid-cols-5 gap-4 mt-4">
                    <div className="w-full">
                        <VideoQuiz username={username} ref={videoRef} />
                    </div>
                    <div className="w-full col-span-4">
                        <h1 className="text-2xl font-bold text-center">
                            Quiz
                        </h1>
                        <h2>Soal {current + 1} dari {questions.length}</h2>
                        <QuestionCard question={questions[current]} onAnswer={handleAnswer} />
                    </div>
                </div>
            </div>
        </div>
    );
}