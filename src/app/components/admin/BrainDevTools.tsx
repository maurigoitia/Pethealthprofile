import { useState } from "react";
import { seedBrainKnowledge } from "../../services/brainKnowledgeService";
import { useAuth } from "../../contexts/AuthContext";

export function BrainDevTools() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<string>("");

  const isAdmin = user?.email?.toLowerCase() === "mauri@pessy.app";
  if (!isAdmin) return null;

  const handleSeed = async () => {
    setStatus("loading");
    setResult("");
    try {
      const data = await seedBrainKnowledge();
      setStatus("success");
      setResult(
        `✅ ${data.seeded} secciones sincronizadas\nNotebooks: ${data.notebooks.join(", ")}`
      );
    } catch (err) {
      setStatus("error");
      setResult(`❌ Error: ${(err as Error).message}`);
    }
  };

  return (
    <div style={{
      margin: "16px",
      padding: "16px",
      borderRadius: "16px",
      background: "#f0fdf4",
      border: "1px solid #bbf7d0",
    }}>
      <h3 style={{
        fontSize: "14px",
        fontWeight: 600,
        color: "#074738",
        marginBottom: "12px",
      }}>
        🧠 PESSY Brain — Dev Tools
      </h3>

      <button
        onClick={handleSeed}
        disabled={status === "loading"}
        style={{
          padding: "10px 20px",
          borderRadius: "12px",
          border: "none",
          background: status === "loading" ? "#9ca3af" : "#1A9B7D",
          color: "white",
          fontSize: "14px",
          fontWeight: 500,
          cursor: status === "loading" ? "not-allowed" : "pointer",
          width: "100%",
          transition: "background 150ms ease",
        }}
      >
        {status === "loading" ? "Sincronizando..." : "Seed Brain Knowledge (9 notebooks)"}
      </button>

      {result && (
        <pre style={{
          marginTop: "12px",
          padding: "12px",
          borderRadius: "8px",
          background: status === "error" ? "#fef2f2" : "#f0fdf4",
          fontSize: "12px",
          whiteSpace: "pre-wrap",
          color: status === "error" ? "#991b1b" : "#065f46",
        }}>
          {result}
        </pre>
      )}
    </div>
  );
}
