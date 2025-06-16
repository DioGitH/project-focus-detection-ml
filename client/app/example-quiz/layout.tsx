/* eslint-disable @typescript-eslint/no-explicit-any */
import { UserProvider } from "@/context/quizContext";

export default function QuizLayout({ children }: any) {
    return (
        <UserProvider>
            {children}
        </UserProvider>
    );
}