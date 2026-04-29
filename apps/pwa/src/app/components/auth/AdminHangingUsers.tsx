import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";

interface HangingUser {
  id: string;
  email?: string;
  createdAt?: Timestamp;
  accessSource?: string;
}

interface UnusedRequest {
  id: string;
  email?: string;
  approvedAt?: Timestamp;
  accessToken?: string;
}

export function AdminHangingUsers() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [hangingUsers, setHangingUsers] = useState<HangingUser[]>([]);
  const [unusedRequests, setUnusedRequests] = useState<UnusedRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.email?.toLowerCase() === "mauri@pessy.app";

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  useEffect(() => {
    if (loading || !isAdmin) return;

    async function loadData() {
      try {
        // Query A: Users sin mascota
        const usersSnap = await getDocs(collection(db, "users"));
        const allUsers: HangingUser[] = usersSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<HangingUser, "id">),
        }));

        const petsSnap = await getDocs(collection(db, "pets"));
        const ownerIds = new Set<string>();
        petsSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.ownerId) ownerIds.add(data.ownerId);
          if (Array.isArray(data.coTutorUids)) {
            data.coTutorUids.forEach((uid: string) => ownerIds.add(uid));
          }
        });

        const noPet = allUsers.filter((u) => !ownerIds.has(u.id));
        setHangingUsers(noPet);

        // Query B: Access requests aprobados no usados
        const reqSnap = await getDocs(
          query(
            collection(db, "access_requests"),
            where("status", "==", "approved"),
            where("used", "==", false)
          )
        );
        const unused: UnusedRequest[] = reqSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<UnusedRequest, "id">),
        }));
        setUnusedRequests(unused);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar datos");
      } finally {
        setFetching(false);
      }
    }

    loadData();
  }, [loading, isAdmin]);

  function formatDate(ts?: Timestamp) {
    if (!ts) return "—";
    return ts.toDate().toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function truncateToken(token?: string) {
    if (!token) return "—";
    return token.slice(0, 8) + "...";
  }

  if (loading || fetching) {
    return (
      <div style={{ background: "#F0FAF9", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#074738", fontFamily: "Manrope, sans-serif" }}>Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: "#F0FAF9", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#b00020", fontFamily: "Manrope, sans-serif" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ background: "#F0FAF9", minHeight: "100vh", padding: "24px 16px", fontFamily: "Manrope, sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ color: "#074738", fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>
          Usuarios colgados
        </h1>

        {/* Sección A: Usuarios sin mascota */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ color: "#074738", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            Usuarios sin mascota ({hangingUsers.length})
          </h2>
          {hangingUsers.length === 0 ? (
            <div style={{ background: "white", borderRadius: 16, padding: "16px", color: "#4b7a6e" }}>
              No hay usuarios sin mascota.
            </div>
          ) : (
            <div style={{ background: "white", borderRadius: 16, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#E0F2F1" }}>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Creado</th>
                    <th style={thStyle}>Fuente</th>
                  </tr>
                </thead>
                <tbody>
                  {hangingUsers.map((u, i) => (
                    <tr key={u.id} style={{ background: i % 2 === 0 ? "white" : "#F8FFFE" }}>
                      <td style={tdStyle}>{u.email ?? u.id}</td>
                      <td style={tdStyle}>{formatDate(u.createdAt)}</td>
                      <td style={tdStyle}>{u.accessSource ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Sección B: Access requests aprobados no usados */}
        <section>
          <h2 style={{ color: "#074738", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            Invitaciones aprobadas no utilizadas ({unusedRequests.length})
          </h2>
          {unusedRequests.length === 0 ? (
            <div style={{ background: "white", borderRadius: 16, padding: "16px", color: "#4b7a6e" }}>
              No hay invitaciones pendientes de uso.
            </div>
          ) : (
            <div style={{ background: "white", borderRadius: 16, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#E0F2F1" }}>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Aprobado</th>
                    <th style={thStyle}>Token</th>
                  </tr>
                </thead>
                <tbody>
                  {unusedRequests.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? "white" : "#F8FFFE" }}>
                      <td style={tdStyle}>{r.email ?? r.id}</td>
                      <td style={tdStyle}>{formatDate(r.approvedAt)}</td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{truncateToken(r.accessToken)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 600,
  color: "#074738",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 13,
  color: "#1a3a33",
  borderTop: "1px solid #E0F2F1",
};
