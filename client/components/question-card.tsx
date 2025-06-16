/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';

type QuestionProps = {
    question: {
        question: string;
        options: string[];
        selectedOption?: string;
    };
    onAnswer: (answer: string) => void;
};

export default function QuestionCard({ question, onAnswer}:any) {
    const [selected, setSelected] = useState<string | null>(null);

    const handleOptionClick = (opt: string) => {
        setSelected(opt);
    };

    const handleNext = () => {
        if (selected !== null) {
            onAnswer(selected);
            setSelected(null);
        }
    };

    return (
        <div className=''>
            <div className="rounded overflow-hidden shadow-lg mx-auto dark:bg-gray-800">
                <div className="px-6 py-4">
                    <div className="font-semibold text-xl mb-2 text-center"><h3>{question.question}</h3></div>
                </div>
                
            </div>

            <div className="grid grid-cols-2 gap-4 py-4">
                {question.options.map((opt: any, idx: any) => (
                    <label 
                        key={idx} 
                        className={`p-2 text-center pointer-coarse:p-4 w-full font-semibold py-2 px-4 rounded ${
                            selected === opt ? 'bg-[#FE7743] text-white' : 'bg-neutral-200 text-gray-800 dark:text-gray-200 dark:bg-gray-700'
                        }`}
                        onClick={() => handleOptionClick(opt)}
                    >
                        <input 
                            type="radio" 
                            name="question-option" 
                            value={opt} 
                            className="sr-only" 
                            checked={selected === opt}
                            onChange={() => { }}
                            readOnly
                        />
                        <span>{opt}</span>
                    </label>
                ))}
            </div>

            <div className='w-full flex justify-end'>
                <button
                    onClick={handleNext}
                    disabled={!selected}
                    className={`mt-4 px-4 py-2 rounded font-bold flex
                    ${selected ? 'bg-[#27548A] text-slate-200' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                >
                    Next
                </button>
            </div>
        </div>
    );
}