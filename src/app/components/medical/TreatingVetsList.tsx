import React, { useMemo } from "react";
import { Stethoscope, Phone, MapPin, Hash } from "lucide-react";
import { useMedical } from "../../contexts/MedicalContext";
import { usePet } from "../../contexts/PetContext";

/**
 * Extrae y deduplica los veterinarios que trataron a la mascota activa
 * a partir de los documentos médicos procesados por el motor de IA.
 * Muestra nombre, matrícula, clínica y dirección cuando están disponibles.
 */

interface TreatingVet {
  key: string;
  name: string;
  license: string | null;
  clinicName: string | null;
  clinicAddress: string | null;
  lastSeen: string | null; // fecha del documento más reciente
  docCount: number;
}

export function TreatingVetsList() {
  const { events } = useMedical();
  const { activePet } = usePet();

  const vets = useMemo<TreatingVet[]>(() => {
    if (!activePet?.id) return [];

    const map = new Map<string, TreatingVet>();

    events
      .filter((e) => e.petId === activePet.id)
      .forEach((e) => {
        const payload = e.extractedData?.masterPayload;
        const name =
          payload?.document_info?.veterinarian_name?.trim() ||
          (e.extractedData as Record<string, unknown>)?.veterinarian_name as string | null ||
          null;

        if (!name) return;

        const key = name.toLowerCase().replace(/\s+/g, "_");
        const existing = map.get(key);

        const license =
          payload?.document_info?.veterinarian_license?.trim() || null;
        const clinicName =
          payload?.document_info?.clinic_name?.trim() || null;
        const clinicAddress =
          payload?.document_info?.clinic_address?.trim() || null;
        const date =
          (e.extractedData?.date as string | null) ||
          (e.createdAt ? new Date(e.createdAt).toISOString().split("T")[0] : null);

        if (!existing) {
          map.set(key, {
            key,
            name,
            license,
            clinicName,
            clinicAddress,
            lastSeen: date,
            docCount: 1,
          });
        } else {
          map.set(key, {
            ...existing,
            license: existing.license || license,
            clinicName: existing.clinicName || clinicName,
            clinicAddress: existing.clinicAddress || clinicAddress,
            lastSeen:
              date && (!existing.lastSeen || date > existing.lastSeen)
                ? date
                : existing.lastSeen,
            docCount: existing.docCount + 1,
          });
        }
      });

    return Array.from(map.values()).sort((a, b) =>
      (b.lastSeen ?? "").localeCompare(a.lastSeen ?? "")
    );
  }, [events, activePet?.id]);

  if (!activePet) return null;
  if (vets.length === 0) return null;

  return (
    <div>
      <p
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 10,
          fontWeight: 800,
          color: "#9CA3AF",
          textTransform: "uppercase",
          letterSpacing: ".1em",
          marginBottom: 10,
        }}
      >
        Vets que trataron a {activePet.name}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {vets.map((vet) => (
          <div
            key={vet.key}
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: "14px 16px",
              boxShadow: "0 2px 8px rgba(0,0,0,.04)",
              border: "1px solid rgba(7,71,56,.06)",
            }}
          >
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: vet.license || vet.clinicName ? 10 : 0 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  minWidth: 40,
                  borderRadius: "50%",
                  backgroundColor: "#E0F2F1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#1A9B7D",
                }}
              >
                <Stethoscope size={18} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#0F172A",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {vet.name}
                </p>
                {vet.lastSeen && (
                  <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                    Último registro: {vet.lastSeen} · {vet.docCount} doc{vet.docCount > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Detail rows */}
            {(vet.license || vet.clinicName || vet.clinicAddress) && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  paddingTop: 8,
                  borderTop: "1px solid rgba(7,71,56,.06)",
                }}
              >
                {vet.license && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Hash size={13} strokeWidth={2} style={{ color: "#1A9B7D", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>
                      Mat. {vet.license}
                    </span>
                  </div>
                )}
                {vet.clinicName && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Phone size={13} strokeWidth={2} style={{ color: "#1A9B7D", flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: 12,
                        color: "#374151",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {vet.clinicName}
                    </span>
                  </div>
                )}
                {vet.clinicAddress && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <MapPin size={13} strokeWidth={2} style={{ color: "#1A9B7D", flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: "#64748B", lineHeight: 1.4 }}>
                      {vet.clinicAddress}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
