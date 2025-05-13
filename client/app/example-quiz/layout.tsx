import { UserProvider } from "@/context/quizContext";

export default function QuizLayout({ children }: any) {
    return (
        <UserProvider>
            {children}
        </UserProvider>
    );
}