interface Props {
  userName: string;
  petName: string;
}

/**
 * HomeGreetingV2 — Pessy App v2
 * Saludo dinámico por franja horaria + eyebrow.
 * "Buenos días, {user}. ¿Cómo está {pet} hoy?"
 */
export function HomeGreetingV2({ userName, petName }: Props) {
  const hour = new Date().getHours();
  const salute =
    hour < 6 ? "Buenas noches" :
    hour < 13 ? "Buenos días" :
    hour < 20 ? "Buenas tardes" :
    "Buenas noches";

  const displayName = userName?.trim() || "vos";
  const displayPet = petName?.trim() || "tu mascota";

  return (
    <div className="px-[18px] pt-3.5 pb-4">
      <span
        className="block text-[10px] font-[800] uppercase text-[#1A9B7D] mb-2"
        style={{ letterSpacing: "0.28em", fontFamily: "'Manrope', sans-serif" }}
      >
        Tu mascota, sus cosas
      </span>
      <h1
        className="text-[28px] font-[800] text-[#074738] leading-[1.06]"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.025em" }}
      >
        {salute}, {displayName}.
        <br />
        <span className="text-[#1A9B7D]">¿Cómo está {displayPet} hoy?</span>
      </h1>
    </div>
  );
}
