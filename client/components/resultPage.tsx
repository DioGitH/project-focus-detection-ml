"use client";
import { useRouter } from "next/navigation";

type ResultPageProps = {
    score: number;
    total: number;
    name: string;
    summary: any;
};

export default function ResultPage({ score, total, name, summary }: ResultPageProps) {
    const router = useRouter();
    return (
        <div className="grid justify-center">
            <h1 className="text-2xl font-bold text-center mt-4">
                Hasil Quiz
            </h1>
            <div className="mt-4">
                <p>Nama: {name}</p>
                <p>Hasil: Skor Anda: {score} dari {total}</p>
            </div>

            {summary && (
                <div className="mt-4 text-left">
                    <h2 className="font-semibold">Ringkasan Fokus:</h2>
                    <pre className="text-sm bg-gray-100 dark:bg-gray-800 p-4 rounded">
                        {JSON.stringify(summary, null, 2)}
                    </pre>
                </div>
            )}

            <button
                onClick={() => router.push('/example-quiz')}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
                Kembali ke Halaman Awal
            </button>
        </div>
    )
}