import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from "react";
import { User, onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userName: string;       // Primer nombre, capitalizado
  userFullName: string;   // Nombre completo
  userPhoto: string;      // URL foto de perfil
  userCountry: string;    // Código de país (ej: "AR")
  userRole: "tutor" | "vet";  // Rol del usuario
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Lee Firestore y devuelve los datos del perfil. Siempre hace una sola query.
async function fetchUserProfile(firebaseUser: User): Promise<{
  firstName: string;
  fullName: string;
  photo: string;
  country: string;
  role: "tutor" | "vet";
}> {
  try {
    const snap = await getDoc(doc(db, "users", firebaseUser.uid));
    if (snap.exists()) {
      const data = snap.data();
      const fullName = ((data.fullName || data.name || "") as string).trim();
      if (fullName) {
        const firstName = fullName.split(" ")[0];
        return {
          firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase(),
          fullName,
          photo: (data.photo || firebaseUser.photoURL || "") as string,
          country: (data.country || "") as string,
          role: (data.role === "vet" ? "vet" : "tutor") as "tutor" | "vet",
        };
      }
    }
  } catch {
    // Firestore offline o sin permisos — caer a Auth
  }

  // Fallback 1: displayName en Firebase Auth
  const dn = (firebaseUser.displayName || "").trim();
  if (dn) {
    const firstName = dn.split(" ")[0];
    return {
      firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase(),
      fullName: dn,
      photo: firebaseUser.photoURL || "",
      country: "",
      role: "tutor",
    };
  }

  // Fallback 2: email
  const emailName = firebaseUser.email?.split("@")[0] || "Usuario";
  return { firstName: emailName, fullName: emailName, photo: "", country: "", role: "tutor" };
}

// Crea el doc en Firestore solo si no existe. Nunca sobreescribe datos.
async function ensureFirestoreProfile(firebaseUser: User): Promise<void> {
  try {
    const ref = doc(db, "users", firebaseUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        fullName: firebaseUser.displayName || "",
        name: firebaseUser.displayName || "",
        email: firebaseUser.email?.trim().toLowerCase() || "",
        photo: firebaseUser.photoURL || null,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      });
    } else {
      // Solo registrar último login — nunca tocar fullName/name/country
      await setDoc(ref, { lastLoginAt: new Date().toISOString() }, { merge: true });
    }
  } catch {
    // No bloquear si Firestore falla
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userFullName, setUserFullName] = useState("");
  const [userPhoto, setUserPhoto] = useState("");
  const [userCountry, setUserCountry] = useState("");
  const [userRole, setUserRole] = useState<"tutor" | "vet">("tutor");

  const applyProfile = useCallback((profile: { firstName: string; fullName: string; photo: string; country: string; role: "tutor" | "vet" }) => {
    const safeFirstName =
      (profile.firstName || "").trim() ||
      (profile.fullName || "").trim().split(/\s+/)[0] ||
      "Tutor";
    const safeFullName = (profile.fullName || "").trim() || safeFirstName;
    setUserName(safeFirstName);
    setUserFullName(safeFullName);
    setUserPhoto(profile.photo);
    setUserCountry(profile.country);
    setUserRole(profile.role);
  }, []);

  const clearProfile = useCallback(() => {
    setUserName("");
    setUserFullName("");
    setUserPhoto("");
    setUserCountry("");
    setUserRole("tutor");
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const profile = await fetchUserProfile(currentUser);
    applyProfile(profile);
  }, [applyProfile]);

  useEffect(() => {
    if (!auth.app.options.apiKey) {
      setLoading(false);
      return;
    }

    // Safety timeout para evitar loading infinito
    const safetyTimer = setTimeout(() => setLoading(false), 8000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Cargar perfil Y asegurar doc en Firestore en paralelo
        const [profile] = await Promise.all([
          fetchUserProfile(firebaseUser),
          ensureFirestoreProfile(firebaseUser),
        ]);

        applyProfile(profile);

        // Sincronizar displayName en Auth si está vacío
        if (!firebaseUser.displayName && profile.fullName && profile.fullName !== firebaseUser.email?.split("@")[0]) {
          updateProfile(firebaseUser, { displayName: profile.fullName }).catch(() => {});
        }
      } else {
        clearProfile();
      }

      clearTimeout(safetyTimer);
      setLoading(false);
    }, () => {
      clearTimeout(safetyTimer);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, [applyProfile, clearProfile]);

  const logout = () => signOut(auth);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const contextValue = useMemo(() => ({
    user, loading, userName, userFullName, userPhoto, userCountry, userRole, logout, refreshUser,
  }), [user, loading, userName, userFullName, userPhoto, userCountry, userRole]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
