/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { zodResolver } from "@hookform/resolvers/zod";
import { set, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";


type Props = {
    setUsername: (value: string) => void;
    setName: (value: string) => void;
    setEmail: (value: string) => void;
};

// Skema validasi
const formSchema = z.object({
    username: z.string().min(2, {
        message: "Username must be at least 2 characters.",
    }),
    name: z.string().min(2, {
        message: "Name must be at least 2 characters.",
    }),
    email: z.string().email({
        message: "Email must be a valid email address.",
    }),

});

type FormData = z.infer<typeof formSchema>;

export function QuizForm({ setUsername, setName, setEmail }: Props) {
    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            name: "",
            email: "user@gmail.com",
        },
    });

    const onSubmit = (data: FormData) => {
        setUsername(data.username); // Kirim ke parent
        setName(data.name); // Kirim ke parent
        setEmail(data.email); // Kirim ke parent
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                                <Input placeholder="masukkan user" {...field} />
                            </FormControl>
                            <FormDescription>
                                Masukkan Username
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nama</FormLabel>
                            <FormControl>
                                <Input placeholder="masukkan nama" {...field} />
                            </FormControl>
                            <FormDescription>
                                Masukkan Nama
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input placeholder="masukkan email" {...field} />
                            </FormControl>
                            <FormDescription>
                                Masukkan Email
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit">Start Quiz</Button>
            </form>
        </Form>
    );
}
