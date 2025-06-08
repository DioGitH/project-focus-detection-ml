"use client";
import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@/context/quizContext";
import QuestionCard from "@/components/question-card";
import { questions } from "@/data/questions";
import VideoQuiz, { VideoQuizHandle } from "@/components/videoQuiz";
import ResultPage from "@/components/resultPage";
import { useRouter } from "next/navigation";

export default function QuizPage(){
    const { userData } = useUser();
    const { username, name, email } = userData;

    const videoRef = useRef<VideoQuizHandle>(null);
    const [current, setCurrent] = useState(0);
    const [score, setScore] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [summary, setSummary] = useState<any>(null);
    const router = useRouter();


    useEffect(() => {
        videoRef.current?.regist_user();
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
            videoRef.current?.stopCamera();
            setIsFinished(true);
        }
    };

    const handleBack = () => {
        router.push('/example-quiz');
    };

    return (
        <div className="w-screen flex justify-center">
            <div className="w-[80vw]">
                <div className="grid grid-cols-5 gap-4 mt-4">
                        <div className="w-full">
                        <VideoQuiz username={username} ref={videoRef} onSummaryReceived={(data: any) => { setSummary(data) }} />
                        </div>
                        <div className="w-full col-span-4">
                            {isFinished ? (
                                <ResultPage score={score} total={questions.length} summary={summary} name={name} onClickButton={handleBack}/>
                            ) : (
                                <div className="">
                                    <h1 className="text-2xl font-bold text-center">Quiz</h1>
                                    <h2>Soal {current + 1} dari {questions.length}</h2>
                                    <QuestionCard
                                        question={questions[current]}
                                        onAnswer={handleAnswer}
                                    />
                                </div>
                            )}
                        </div>
                </div>
            </div>
        </div>
    );
}