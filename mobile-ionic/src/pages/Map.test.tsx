import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import MapPage from "./Map";
import { apiClient } from "../services/apiClient";
import type { ActivitySaveResult } from "../services/apiClient";

vi.mock("../hooks/useGeolocationTracker", () => ({
  useGeolocationTracker: () => ({
    position: null,
    status: "waiting",
    error: null,
  }),
}));
vi.mock("mapbox-gl", () => ({
  default: {
    Map: class {
      on() {}
      remove() {}
      resize() {}
      setStyle() {}
      isStyleLoaded() {
        return false;
      }
      once() {}
    },
  },
}));
vi.mock("@ionic/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ionic/react")>();
  return {
    ...actual,
    IonPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    IonContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    useIonViewDidEnter: () => {},
    IonAlert: ({
      isOpen,
      buttons,
      onDidDismiss,
    }: {
      isOpen: boolean;
      buttons: { text: string; handler?: () => void }[];
      onDidDismiss: () => void;
    }) =>
      isOpen ? (
        <div>
          {buttons.map((button) => (
            <button
              key={button.text}
              onClick={() => {
                button.handler?.();
                onDidDismiss();
              }}
            >
              {button.text}
            </button>
          ))}
        </div>
      ) : null,
    IonToast: ({ isOpen, message }: { isOpen: boolean; message: string }) =>
      isOpen ? <div role="status">{message}</div> : null,
  };
});

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(100000);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("does not reset workout B when workout A's pending save completes", async () => {
  let resolveSave!: (result: ActivitySaveResult) => void;
  vi.spyOn(apiClient, "saveActivity").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
  );
  render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Démarrer" }));
  vi.mocked(Date.now).mockReturnValue(101000);
  fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Enregistrer l'activité" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
  fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
  vi.mocked(Date.now).mockReturnValue(103000);
  fireEvent.click(screen.getByRole("button", { name: "Démarrer" }));
  await act(async () =>
    resolveSave({
      activityId: "workout-a",
      xpEarned: 0,
      newLevel: 1,
      previousLevel: 1,
      levelUp: false,
      totalExperience: 0,
      distanceMeters: 0,
      durationSeconds: 1,
    }),
  );
  expect(
    screen.queryByRole("button", { name: "Démarrer" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
});

it("should render segment controls for Statistiques and Carte GPS", () => {
  render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
  );
  expect(screen.getByText("Statistiques")).toBeInTheDocument();
  expect(screen.getByText("Carte GPS")).toBeInTheDocument();
});

it("should switch to Statistiques screen and show workout metrics", () => {
  render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText("Statistiques"));
  expect(screen.getByText("Course à pied")).toBeInTheDocument();
  expect(screen.getByText("Rythme réel")).toBeInTheDocument();
  expect(screen.getByText("Distance")).toBeInTheDocument();
  expect(screen.getByText("Démarrer la course")).toBeInTheDocument();
});

it("should toggle to recording when clicking Démarrer", () => {
  render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText("Statistiques"));
  fireEvent.click(screen.getByText("Démarrer la course"));
  expect(screen.getByText("En cours")).toBeInTheDocument();
  expect(screen.getByText("Pause")).toBeInTheDocument();
  expect(screen.getByText("Terminer")).toBeInTheDocument();
});

it("should show HUD live on Carte GPS mode", () => {
  render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
  );
  expect(screen.getByLabelText("Données d'enregistrement")).toBeInTheDocument();
  expect(screen.getByText("Démarrer")).toBeInTheDocument();
});

it("should not render obsolete test pins A and B", () => {
  render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
  );
  expect(screen.queryByText("Point A (Départ)")).not.toBeInTheDocument();
  expect(screen.queryByText("Point B (Objectif)")).not.toBeInTheDocument();
  expect(screen.queryByText("Départ (A)")).not.toBeInTheDocument();
});

it("should render follow-me locate button", () => {
  render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
  );
  expect(screen.getByTitle(/Suivi GPS actif|Recentrer/)).toBeInTheDocument();
});

it("should automatically start workout when arriving with autoStart state from Home", () => {
  render(
    <MemoryRouter
      initialEntries={[
        { pathname: "/enregistrer", state: { autoStart: true } },
      ]}
    >
      <MapPage />
    </MemoryRouter>,
  );
  expect(screen.getByText("Pause")).toBeInTheDocument();
  expect(screen.getByText("Terminer")).toBeInTheDocument();
});

it("keeps the finished course after a failed save and retries its original snapshot", async () => {
  const save = vi
    .spyOn(apiClient, "saveActivity")
    .mockRejectedValueOnce(new Error("offline"));
  render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Démarrer" }));
  vi.mocked(Date.now).mockReturnValue(105250);
  fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
  vi.mocked(Date.now).mockReturnValue(135250);
  fireEvent.click(
    screen.getByRole("button", { name: "Enregistrer l'activité" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(
      "Course conservée en mémoire",
    ),
  );
  expect(
    screen.queryByRole("button", { name: "Démarrer" }),
  ).not.toBeInTheDocument();
  save.mockResolvedValueOnce({
    activityId: "id",
    xpEarned: 0,
    newLevel: 1,
    previousLevel: 1,
    levelUp: false,
    totalExperience: 0,
    distanceMeters: 0,
    durationSeconds: 5.25,
  });
  fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer l'activité" }),
    ),
  );
  expect(screen.getByRole("button", { name: "Démarrer" })).toBeInTheDocument();
  expect(save.mock.calls[0][0]).toEqual(save.mock.calls[1][0]);
  expect(save.mock.calls[1][0].endedAt).toBe("1970-01-01T00:01:45.250Z");
});
