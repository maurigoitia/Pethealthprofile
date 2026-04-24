import React from "react";
import { Stethoscope, Phone, Mail, Hash } from "lucide-react";
import { usePet } from "../../contexts/PetContext";
import { useExtractedVets } from "../../hooks/useExtractedVets";

/**
 * TreatingVetsList — lista de vets que trataron a la mascota activa.
 *
 * Lee directo de `pets/{petId}/extractedVets` (populada por la Cloud
 * Function `extractVetsFromArchives` + upserts incrementales desde
 * MedicalContext). La UI principal de /buscar-vet ya no usa este
 * componente — se mantiene para `/cuidados` (CuidadosScreen).
 *
 * Si no hay vets → no renderiza nada.
 */
export function TreatingVetsList() {
  const { activePet } = usePet();
  const { vets } = useExtractedVets(activePet?.id || null);

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
            key={vet.id}
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: "14px 16px",
              boxShadow: "0 2px 8px rgba(0,0,0,.04)",
              border: "1px solid rgba(7,71,56,.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: vet.license || vet.phone || vet.email ? 10 : 0,
              }}
            >
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
                {vet.clinic && (
                  <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                    {vet.clinic}
                    {vet.eventCount >= 2 ? ` · ${vet.eventCount} docs` : ""}
                  </p>
                )}
              </div>
            </div>

            {(vet.license || vet.phone || vet.email) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  paddingTop: 8,
                  borderTop: "1px solid rgba(7,71,56,.06)",
                }}
              >
                {vet.license && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      color: "#374151",
                      fontWeight: 600,
                      backgroundColor: "#F1F5F9",
                      padding: "4px 8px",
                      borderRadius: 8,
                    }}
                  >
                    <Hash size={11} strokeWidth={2} color="#1A9B7D" />
                    Mat. {vet.license}
                  </span>
                )}
                {vet.phone && (
                  <a
                    href={`tel:${vet.phone}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      color: "#074738",
                      fontWeight: 600,
                      backgroundColor: "#E0F2F1",
                      padding: "4px 8px",
                      borderRadius: 8,
                      textDecoration: "none",
                    }}
                  >
                    <Phone size={11} strokeWidth={2} />
                    {vet.phone}
                  </a>
                )}
                {vet.email && (
                  <a
                    href={`mailto:${vet.email}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      color: "#074738",
                      fontWeight: 600,
                      backgroundColor: "#E0F2F1",
                      padding: "4px 8px",
                      borderRadius: 8,
                      textDecoration: "none",
                    }}
                  >
                    <Mail size={11} strokeWidth={2} />
                    {vet.email}
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TreatingVetsList;
