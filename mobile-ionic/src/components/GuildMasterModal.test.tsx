import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import GuildMasterModal from "./GuildMasterModal";
import { apiClient } from "../services/apiClient";

vi.mock("../services/apiClient", () => ({
  apiClient: {
    getCoachWeeklyReport: vi.fn(),
    getCoachMessages: vi.fn(),
    sendCoachMessage: vi.fn(),
    streamCoachMessage: vi.fn(),
  },
}));

describe("GuildMasterModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le bilan hebdomadaire quand il est chargé", async () => {
    vi.mocked(apiClient.getCoachWeeklyReport).mockResolvedValueOnce({
      enabled: true,
      report: {
        id: "rep-1",
        playerId: "p1",
        year: 2026,
        weekNumber: 47,
        summary: {
          totalDistanceMeters: 18500,
          totalDurationSeconds: 5400,
          activityCount: 3,
          elevationGainMeters: 140,
        },
        reportText: "Très bon travail aventurier ! Votre endurance progresse.",
        createdAt: "2026-11-18T10:00:00Z",
      },
    });
    vi.mocked(apiClient.getCoachMessages).mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <GuildMasterModal isOpen={true} onClose={vi.fn()} defaultTab="report" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Très bon travail aventurier ! Votre endurance progresse.",
        ),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Semaine 47 • 2026")).toBeInTheDocument();
    expect(screen.getByText("18.5")).toBeInTheDocument();
  });

  it("affiche l'écran d'incitation quand le coach est désactivé", async () => {
    vi.mocked(apiClient.getCoachWeeklyReport).mockResolvedValueOnce({
      enabled: false,
      report: null,
    });
    vi.mocked(apiClient.getCoachMessages).mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <GuildMasterModal isOpen={true} onClose={vi.fn()} defaultTab="report" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Le Maître de Guilde se repose"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Ouvrir les Paramètres")).toBeInTheDocument();
  });

  it("permet d'envoyer un message au Maître dans le salon de discussion", async () => {
    vi.mocked(apiClient.getCoachWeeklyReport).mockResolvedValueOnce({
      enabled: true,
      report: null,
    });
    vi.mocked(apiClient.getCoachMessages).mockResolvedValueOnce([
      {
        id: "msg-1",
        playerId: "p1",
        role: "assistant",
        content: "Salutations aventurier !",
        createdAt: "2026-11-18T09:00:00Z",
      },
    ]);
    vi.mocked(apiClient.streamCoachMessage).mockImplementation(
      async (_text, onChunk) => {
        onChunk("Pour un marathon, ");
        onChunk("la régularité prime.");
        return {
          id: "msg-2",
          playerId: "p1",
          role: "assistant",
          content: "Pour un marathon, la régularité prime.",
          createdAt: "2026-11-18T10:05:00Z",
        };
      },
    );

    render(
      <MemoryRouter>
        <GuildMasterModal isOpen={true} onClose={vi.fn()} defaultTab="chat" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Salutations aventurier !")).toBeInTheDocument();
    });

    const input = screen.getByLabelText("Votre question");
    fireEvent.change(input, { target: { value: "Conseil pour marathon" } });

    const sendBtn = screen.getByLabelText("Envoyer");
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(apiClient.streamCoachMessage).toHaveBeenCalledWith(
        "Conseil pour marathon",
        expect.any(Function),
      );
      expect(
        screen.getByText("Pour un marathon, la régularité prime."),
      ).toBeInTheDocument();
    });
  });
});
