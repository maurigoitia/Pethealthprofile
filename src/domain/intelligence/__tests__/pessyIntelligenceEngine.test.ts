import { describe, expect, it } from "vitest";
import { runPessyIntelligence } from "../pessyIntelligenceEngine";

describe("runPessyIntelligence", () => {
  it("uses all matched groups for rainy-day suggestions instead of only the first one", () => {
    const result = runPessyIntelligence({
      petName: "Thor",
      species: "dog",
      breed: "Border Collie cachorro",
      ageLabel: "6 meses",
      groupIds: ["dog.puppy", "dog.active_working", "dog.general"],
      temperatureC: 18,
      humidityPct: 70,
      isRaining: true,
      currentHour: 10,
    });

    const rainyPlan = result.recommendations.find((recommendation) => recommendation.code === "rainy_day_plan");
    expect(rainyPlan?.title).toBe("Juego de olfato en casa");
  });

  it("prefers favorite-activity suggestions from any matched group", () => {
    const result = runPessyIntelligence({
      petName: "Thor",
      species: "dog",
      breed: "Border Collie",
      ageLabel: "3 años",
      groupIds: ["dog.active_working", "dog.companion", "dog.general"],
      temperatureC: 20,
      humidityPct: 45,
      favoriteActivities: ["training"],
      currentHour: 11,
    });

    const dailyPlan = result.recommendations.find((recommendation) => recommendation.code === "daily_activity_suggestion");
    expect(dailyPlan?.title).toBe("Practica de autocontrol");
  });
});
