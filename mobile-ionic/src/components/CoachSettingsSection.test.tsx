import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CoachSettingsSection from "./CoachSettingsSection";
import { apiClient } from "../services/apiClient";

vi.mock("../services/apiClient", () => ({
  apiClient: {
    getCoachSettings: vi.fn(),
    updateCoachSettings: vi.fn(),
  },
}));

describe("CoachSettingsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les paramètres chargés et la liste d'objectifs quand activé", async () => {
    vi.mocked(apiClient.getCoachSettings).mockResolvedValueOnce({
      coachEnabled: true,
      coachGoal: "10k",
    });

    render(<CoachSettingsSection />);

    await waitFor(() => {
      expect(
        screen.getByText("Maître de Guilde (Coach IA)"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Objectif 10 km")).toBeInTheDocument();
    expect(
      screen.getByText(/Sobriété & respect de votre vie privée/),
    ).toBeInTheDocument();
  });

  it("masque la sélection d'objectif quand le coach est désactivé", async () => {
    vi.mocked(apiClient.getCoachSettings).mockResolvedValueOnce({
      coachEnabled: false,
      coachGoal: "casual",
    });

    render(<CoachSettingsSection />);

    await waitFor(() => {
      expect(
        screen.getByText("Activer le Maître de Guilde"),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Votre style d'aventure & objectif"),
    ).not.toBeInTheDocument();
  });

  it("permet de sélectionner un nouvel objectif", async () => {
    vi.mocked(apiClient.getCoachSettings).mockResolvedValueOnce({
      coachEnabled: true,
      coachGoal: "casual",
    });
    vi.mocked(apiClient.updateCoachSettings).mockResolvedValueOnce({
      coachEnabled: true,
      coachGoal: "marathon",
    });

    render(<CoachSettingsSection />);

    await waitFor(() => {
      expect(
        screen.getByText("Objectif Marathon (42,195 km)"),
      ).toBeInTheDocument();
    });

    const marathonBtn = screen.getByRole("radio", {
      name: /Objectif Marathon/,
    });
    fireEvent.click(marathonBtn);

    await waitFor(() => {
      expect(apiClient.updateCoachSettings).toHaveBeenCalledWith({
        coachGoal: "marathon",
      });
      expect(
        screen.getByText("Objectif de progression mis à jour"),
      ).toBeInTheDocument();
    });
  });
});
