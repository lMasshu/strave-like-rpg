import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MapPage from "./Map";

const mockMarkerInstance = {
  setLngLat: vi.fn().mockReturnThis(),
  setRotation: vi.fn().mockReturnThis(),
  setPopup: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  remove: vi.fn(),
  on: vi.fn().mockReturnThis(),
  getLngLat: vi.fn(() => ({ lng: 2.3522, lat: 48.8566 })),
};

vi.mock("mapbox-gl", () => {
  const MapMock = vi.fn().mockImplementation(function () {
    return {
      on: vi.fn(),
      once: vi.fn(),
      remove: vi.fn(),
      resize: vi.fn(),
      flyTo: vi.fn(),
      fitBounds: vi.fn(),
      getSource: vi.fn(() => undefined),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      setStyle: vi.fn(),
      isStyleLoaded: vi.fn(() => true),
    };
  });

  return {
    default: {
      Map: MapMock,
      Marker: vi.fn().mockImplementation(function () {
        return mockMarkerInstance;
      }),
      Popup: vi.fn().mockImplementation(function () {
        return {
          setHTML: vi.fn().mockReturnThis(),
        };
      }),
      LngLatBounds: vi.fn().mockImplementation(function () {
        return {
          extend: vi.fn(),
        };
      }),
      accessToken: "",
    },
  };
});

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    checkPermissions: vi.fn().mockResolvedValue({ location: "granted" }),
    requestPermissions: vi.fn().mockResolvedValue({ location: "granted" }),
    watchPosition: vi.fn().mockResolvedValue("watch-123"),
    clearWatch: vi.fn().mockResolvedValue(undefined),
    getCurrentPosition: vi.fn().mockResolvedValue({
      coords: { latitude: 48.8566, longitude: 2.3522, accuracy: 5 },
      timestamp: Date.now(),
    }),
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

// ResizeObserver mock
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("MapPage - Free Workout & Telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    const statsBtn = screen.getByText("Statistiques");
    fireEvent.click(statsBtn);

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

    const statsBtn = screen.getByText("Statistiques");
    fireEvent.click(statsBtn);

    const startBtn = screen.getByText("Démarrer la course");
    act(() => {
      fireEvent.click(startBtn);
    });

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

    const hudElement = screen.getByLabelText("Données d'enregistrement");
    expect(hudElement).toBeInTheDocument();
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

    const locateBtn = screen.getByTitle(/Suivi GPS actif|Recentrer/);
    expect(locateBtn).toBeInTheDocument();
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
});
