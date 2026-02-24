// ============================================================================
// PESSY - Medical Events Context
// Maneja todos los eventos médicos, pendientes, y medicaciones
// ============================================================================

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import {
  MedicalEvent,
  PendingAction,
  ActiveMedication,
  MonthSummary,
  DocumentType,
} from "../types/medical";

interface MedicalContextType {
  // Eventos médicos
  events: MedicalEvent[];
  addEvent: (event: MedicalEvent) => void;
  updateEvent: (id: string, updates: Partial<MedicalEvent>) => void;
  getEventsByPetId: (petId: string) => MedicalEvent[];
  
  // Pendientes
  pendingActions: PendingAction[];
  addPendingAction: (action: PendingAction) => void;
  completePendingAction: (id: string) => void;
  getPendingActionsByPetId: (petId: string) => PendingAction[];
  
  // Medicaciones activas
  activeMedications: ActiveMedication[];
  addMedication: (medication: ActiveMedication) => void;
  deactivateMedication: (id: string) => void;
  getActiveMedicationsByPetId: (petId: string) => ActiveMedication[];
  
  // Resumen del mes
  getMonthSummary: (petId: string, month: Date) => MonthSummary;
}

const MedicalContext = createContext<MedicalContextType | undefined>(undefined);

export function MedicalProvider({ children }: { children: ReactNode }) {
  // Estado persistido en localStorage
  const [events, setEvents] = useState<MedicalEvent[]>(() => {
    const stored = localStorage.getItem("pessy_medical_events");
    return stored ? JSON.parse(stored) : [];
  });

  const [pendingActions, setPendingActions] = useState<PendingAction[]>(() => {
    const stored = localStorage.getItem("pessy_pending_actions");
    return stored ? JSON.parse(stored) : [];
  });

  const [activeMedications, setActiveMedications] = useState<ActiveMedication[]>(() => {
    const stored = localStorage.getItem("pessy_active_medications");
    return stored ? JSON.parse(stored) : [];
  });

  // Persistir cambios
  useEffect(() => {
    localStorage.setItem("pessy_medical_events", JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem("pessy_pending_actions", JSON.stringify(pendingActions));
  }, [pendingActions]);

  useEffect(() => {
    localStorage.setItem("pessy_active_medications", JSON.stringify(activeMedications));
  }, [activeMedications]);

  // ============================================================================
  // EVENTOS MÉDICOS
  // ============================================================================
  
  const addEvent = (event: MedicalEvent) => {
    setEvents((prev) => [event, ...prev]);
  };

  const updateEvent = (id: string, updates: Partial<MedicalEvent>) => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === id ? { ...event, ...updates, updatedAt: new Date().toISOString() } : event
      )
    );
  };

  const getEventsByPetId = (petId: string) => {
    return events
      .filter((event) => event.petId === petId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  // ============================================================================
  // PENDIENTES
  // ============================================================================
  
  const addPendingAction = (action: PendingAction) => {
    setPendingActions((prev) => [action, ...prev]);
  };

  const completePendingAction = (id: string) => {
    setPendingActions((prev) =>
      prev.map((action) =>
        action.id === id
          ? { ...action, completed: true, completedAt: new Date().toISOString() }
          : action
      )
    );
  };

  const getPendingActionsByPetId = (petId: string) => {
    return pendingActions
      .filter((action) => action.petId === petId && !action.completed)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  };

  // ============================================================================
  // MEDICACIONES
  // ============================================================================
  
  const addMedication = (medication: ActiveMedication) => {
    setActiveMedications((prev) => [medication, ...prev]);
  };

  const deactivateMedication = (id: string) => {
    setActiveMedications((prev) =>
      prev.map((med) => (med.id === id ? { ...med, active: false } : med))
    );
  };

  const getActiveMedicationsByPetId = (petId: string) => {
    return activeMedications.filter((med) => med.petId === petId && med.active);
  };

  // ============================================================================
  // RESUMEN DEL MES
  // ============================================================================
  
  const getMonthSummary = (petId: string, month: Date): MonthSummary => {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const petEvents = events.filter((event) => {
      const eventDate = new Date(event.createdAt);
      return event.petId === petId && eventDate >= startOfMonth && eventDate <= endOfMonth;
    });

    const eventsByType: Record<DocumentType, number> = {
      vaccine: 0,
      lab_test: 0,
      xray: 0,
      echocardiogram: 0,
      electrocardiogram: 0,
      surgery: 0,
      medication: 0,
      checkup: 0,
      other: 0,
    };

    petEvents.forEach((event) => {
      const type = event.extractedData.documentType;
      eventsByType[type] = (eventsByType[type] || 0) + 1;
    });

    const petPendingActions = pendingActions.filter((action) => action.petId === petId);
    const completedThisMonth = petPendingActions.filter((action) => {
      if (!action.completedAt) return false;
      const completedDate = new Date(action.completedAt);
      return completedDate >= startOfMonth && completedDate <= endOfMonth;
    });

    const monthName = month.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

    return {
      month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      totalEvents: petEvents.length,
      eventsByType,
      pendingActions: getPendingActionsByPetId(petId).length,
      completedActions: completedThisMonth.length,
      activeMedications: getActiveMedicationsByPetId(petId).length,
    };
  };

  return (
    <MedicalContext.Provider
      value={{
        events,
        addEvent,
        updateEvent,
        getEventsByPetId,
        pendingActions,
        addPendingAction,
        completePendingAction,
        getPendingActionsByPetId,
        activeMedications,
        addMedication,
        deactivateMedication,
        getActiveMedicationsByPetId,
        getMonthSummary,
      }}
    >
      {children}
    </MedicalContext.Provider>
  );
}

export function useMedical() {
  const context = useContext(MedicalContext);
  if (!context) {
    throw new Error("useMedical must be used within MedicalProvider");
  }
  return context;
}
