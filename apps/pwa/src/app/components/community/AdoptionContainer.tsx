/**
 * AdoptionContainer — wrapper que decide:
 * - Si el user no tiene `adopter_profile/main` → mostrar AdopterProfileSetup
 * - Si tiene perfil → mostrar AdoptionFeed con matching
 *
 * Auto-fetch del perfil al montar. Permite editar el perfil después.
 */
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { AdopterProfileSetup } from "./AdopterProfileSetup";
import { AdoptionFeed } from "./AdoptionFeed";
import type { AdopterProfile } from "../../../domain/community/adoption.contract";

interface Props {
  onBack?: () => void;
}

export function AdoptionContainer({ onBack }: Props) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AdopterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "adopter_profile", "main"));
        if (snap.exists()) {
          setProfile(snap.data() as AdopterProfile);
        }
      } catch (err) {
        console.warn("[AdoptionContainer] no se pudo cargar perfil:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0FAF9] flex items-center justify-center">
        <div className="size-10 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
      </div>
    );
  }

  // Sin perfil o editando → setup form
  if (!profile || editing) {
    return (
      <AdopterProfileSetup
        onBack={editing ? () => setEditing(false) : onBack}
        onComplete={(p) => {
          setProfile(p);
          setEditing(false);
        }}
      />
    );
  }

  // Con perfil → feed
  return <AdoptionFeed onBack={onBack} adopter={profile} />;
}
