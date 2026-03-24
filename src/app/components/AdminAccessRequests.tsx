import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { collection, query, where, orderBy, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

interface AccessRequest {
  id: string;
  name: string;
  email: string;
  source?: string;
  createdAt?: Timestamp;
}

export function AdminAccessRequests() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.email?.toLowerCase() === "mauriciogoitia@gmail.com";

  // Redirect non-admins once auth is resolved
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  // Load pending requests
  useEffect(() => {
    if (loading || !isAdmin) return;

    async function loadRequests() {
      try {
        const q = query(
          collection(db, "access_requests"),
          where("status", "==", "pending"),
          orderBy("createdAt", "desc"),
        );
        const snapshot = await getDocs(q);
        const docs: AccessRequest[] = snapshot.docs.map((d) => ({
          id: d.id,
          name: (d.data().name as string) || "",
          email: (d.data().email as string) || "",
          source: (d.data().source as string) || undefined,
          createdAt: d.data().createdAt as Timestamp | undefined,
        }));
        setRequests(docs);
      } catch (err) {
        setError("No se pudieron cargar las solicitudes.");
        console.error(err);
      } finally {
        setFetching(false);
      }
    }

    loadRequests();
  }, [loading, isAdmin]);

  async function handleApprove(req: AccessRequest) {
    setProcessing((prev) => ({ ...prev, [req.id]: true }));
    try {
      const approve = httpsCallable(functions, "approveAccessRequest");
      await approve({ requestId: req.id });
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      console.error("Error aprobando:", err);
      alert("Error al aprobar la solicitud. Revisá los logs.");
    } finally {
      setProcessing((prev) => ({ ...prev, [req.id]: false }));
    }
  }

  async function handleReject(req: AccessRequest) {
    setProcessing((prev) => ({ ...prev, [req.id]: true }));
    try {
      await updateDoc(doc(db, "access_requests", req.id), {
        status: "rejected",
        approvedBy: user!.uid,
        approvedAt: Timestamp.now(),
      });
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      console.error("Error rechazando:", err);
      alert("Error al rechazar la solicitud. Revisá los logs.");
    } finally {
      setProcessing((prev) => ({ ...prev, [req.id]: false }));
    }
  }

  function formatDate(ts?: Timestamp): string {
    if (!ts) return "—";
    return ts.toDate().toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  // While auth is loading, render nothing to avoid flash
  if (loading) return null;

  // Non-admins: redirect handled in useEffect, render nothing
  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[#074738]">Solicitudes de acceso</h1>

      {error && (
        <p className="mt-4 text-sm text-red-500">{error}</p>
      )}

      {fetching ? (
        <p className="mt-6 text-sm text-[#5e716b]">Cargando solicitudes…</p>
      ) : requests.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#5e716b]">
          No hay solicitudes pendientes.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {requests.map((req) => {
            const busy = processing[req.id] ?? false;
            return (
              <li key={req.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-bold text-[#074738]">{req.name}</p>
                <p className="text-sm text-[#5e716b]">{req.email}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {req.source ? `Fuente: ${req.source} · ` : ""}
                  {formatDate(req.createdAt)}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleApprove(req)}
                    className="flex-1 rounded-full bg-[#074738] py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {busy ? "…" : "Aprobar"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleReject(req)}
                    className="flex-1 rounded-full border border-red-300 py-2 text-sm font-bold text-red-600 disabled:opacity-60"
                  >
                    {busy ? "…" : "Rechazar"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
