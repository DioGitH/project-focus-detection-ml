"use client";
import { createContext, useState, useContext } from "react";

type UserData = {
    username: string;
    name: string;
    email: string;
};

type UserContextType = {
    userData: UserData;
    setUserData: (data: UserData) => void;
};

// Default context value (dummy, supaya tidak null)
const defaultUserData: UserData = {
    username: "",
    name: "",
    email: "",
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }:any) {
    const [userData, setUserData] = useState({
        username: "",
        name: "",
        email: ""
    });

    return (
        <UserContext.Provider value={{ userData, setUserData }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
}
