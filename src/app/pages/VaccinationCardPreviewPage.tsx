import { VaccinationCardModal } from "../components/VaccinationCardModal";

const PREVIEW_PET = {
  name: "Thor",
  breed: "American Bully",
  birthDate: "12/08/2018",
  microchip: "AR-9083-THOR",
  photo: "/team/founder-3.jpg",
};

const PREVIEW_VACCINES = [
  {
    id: 1,
    name: "Antirrábica",
    date: "15/01/2026",
    nextDue: "15/01/2027",
    veterinarian: "Pessy Care",
    status: "current" as const,
    lotNumber: "AR-2219",
  },
  {
    id: 2,
    name: "Quíntuple",
    date: "02/04/2025",
    nextDue: "02/04/2026",
    veterinarian: "Pessy Care",
    status: "due-soon" as const,
    lotNumber: "QT-1033",
  },
  {
    id: 3,
    name: "Refuerzo anual",
    date: "10/01/2025",
    nextDue: "10/01/2026",
    veterinarian: "Pessy Care",
    status: "overdue" as const,
    lotNumber: "RF-1202",
  },
];

export default function VaccinationCardPreviewPage() {
  return (
    <div className="min-h-screen bg-[#f5f7f8]">
      <VaccinationCardModal
        isOpen
        onClose={() => {}}
        petData={PREVIEW_PET}
        vaccines={PREVIEW_VACCINES}
      />
    </div>
  );
}
