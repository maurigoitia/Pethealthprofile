import { useState } from "react";
import { Appointment } from "../types/medical";

export function useBookAppointment() {
  const [isOpen, setIsOpen] = useState(false);
  const [initialValues, setInitialValues] = useState<Partial<Appointment>>({});

  function openBooking(vetName: string, clinicName: string) {
    setInitialValues({
      veterinarian: vetName,
      clinic: clinicName,
      type: "checkup",
    });
    setIsOpen(true);
  }

  return {
    isOpen,
    initialValues,
    openBooking,
    onClose: () => setIsOpen(false),
  };
}
