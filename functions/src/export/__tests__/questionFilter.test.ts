import { describe, expect, it } from "vitest";
import {
  classifyUnsafe,
  filterSuggestedQuestions,
  __INTERNAL,
} from "../questionFilter";

describe("questionFilter", () => {
  it("blocks questions naming a medication", () => {
    expect(classifyUnsafe("¿Le doy apoquel?")).toBe("medication_name");
    expect(classifyUnsafe("¿Convendría empezar Cytopoint?")).toBe(
      "medication_name",
    );
  });

  it("blocks prescription verbs even without a drug name", () => {
    expect(classifyUnsafe("¿Le puedo dar algo más fuerte?")).toBe(
      "prescription_verb",
    );
    expect(classifyUnsafe("¿Subimos la dosis?")).toBe("prescription_verb");
    expect(classifyUnsafe("¿Cambiar a otro tratamiento?")).toBe(
      "prescription_verb",
    );
  });

  it("blocks questions that affirm a diagnosis before the question mark", () => {
    expect(
      classifyUnsafe("Como tiene alergia, ¿qué hacemos?"),
    ).toBe("hidden_diagnosis");
    expect(
      classifyUnsafe("Porque padece artrosis, ¿es grave?"),
    ).toBe("hidden_diagnosis");
  });

  it("passes safe, neutral questions through unchanged", () => {
    expect(classifyUnsafe("¿Qué controles recomienda en esta etapa?")).toBeNull();
    expect(classifyUnsafe("¿Cómo están sus dientes?")).toBeNull();
  });

  it("filterSuggestedQuestions replaces unsafe items with the generic safe question", () => {
    const result = filterSuggestedQuestions([
      "¿Qué le pongo de comer?",
      "¿Le doy apoquel?",
      "¿Subimos la dosis de prednisolona?",
      "Como tiene alergia, ¿qué hago?",
    ]);
    expect(result.blocked).toBe(3);
    expect(result.questions[0]).toBe("¿Qué le pongo de comer?");
    expect(result.questions[1]).toBe(__INTERNAL.GENERIC_SAFE_QUESTION);
    expect(result.questions[2]).toBe(__INTERNAL.GENERIC_SAFE_QUESTION);
    expect(result.questions[3]).toBe(__INTERNAL.GENERIC_SAFE_QUESTION);
  });

  it("filterSuggestedQuestions handles empty / non-string input safely", () => {
    const result = filterSuggestedQuestions(["", "  ", "OK pregunta neutral?"]);
    expect(result.blocked).toBe(2);
    expect(result.questions[2]).toBe("OK pregunta neutral?");
  });
});
