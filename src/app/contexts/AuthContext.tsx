import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
    User,
    onAuthStateChanged,
    signOut
} from "firebase/auth";
import { auth } from "../../lib/firebase";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fallback: If Firebase keys are missing, don't wait forever
        if (!auth.app.options.apiKey) {
            console.warn("Firebase API key missing. Running in limited mode.");
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        }, (error) => {
            console.error("Auth error:", error);
            setLoading(false);
        });

        // Protection: 5s timeout to avoid white screen
        const timer = setTimeout(() => setLoading(false), 5000);

        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    const logout = () => signOut(auth);

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {loading ? (
                <div
                    className="min-h-screen flex items-center justify-center px-6"
                    style={{
                        backgroundImage: "linear-gradient(rgb(43,124,238) 0%, rgb(61,139,255) 50%, rgb(93,163,255) 100%)",
                    }}
                >
                    <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl px-6 py-10 text-center">
                        <h1 className="text-3xl font-black text-[#2b7cee]">Pessy</h1>
                        <p className="text-slate-500 text-sm mt-2">Cargando sesión...</p>
                    </div>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
