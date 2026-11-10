import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import Notifications from "./Notifications";
import { getNotificationIcon } from "../components/lineMdMappings";
import type { NotificationType } from "../data/demo";

describe("Notifications Page", () => {
  it("renders page header and category filter tabs", () => {
    render(
      <IonReactRouter>
        <Notifications />
      </IonReactRouter>,
    );

    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Tout lire")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Tous/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Raids/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Succès/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Amis/i })).toBeInTheDocument();
    expect(document.querySelector('[data-icon="alert"]')).toBeInTheDocument();
    expect(
      document.querySelector('[data-icon="account-add"]'),
    ).toBeInTheDocument();
  });

  it("falls back to a valid icon for an unknown notification type", () => {
    expect(getNotificationIcon("unknown" as NotificationType)).toBe("bell");
  });

  it("filters notifications when category tab is selected", () => {
    render(
      <IonReactRouter>
        <Notifications />
      </IonReactRouter>,
    );

    // Default "Tous" shows raid and follow notifications
    expect(
      screen.getByText(/Le Dragon de Somme a perdu 12 %/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Lucas_Run a commencé à vous suivre/i),
    ).toBeInTheDocument();

    // Select "Raids" tab
    const raidsTab = screen.getByRole("tab", { name: /Raids/i });
    fireEvent.click(raidsTab);

    expect(
      screen.getByText(/Le Dragon de Somme a perdu 12 %/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Lucas_Run a commencé à vous suivre/i),
    ).toBeNull();

    // Select "Succès" tab
    const succesTab = screen.getByRole("tab", { name: /Succès/i });
    fireEvent.click(succesTab);

    expect(
      screen.getByText(/Bravo, vous passez au niveau 5/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Le Dragon de Somme a perdu 12 %/i)).toBeNull();

    // Select "Amis" tab
    const amisTab = screen.getByRole("tab", { name: /Amis/i });
    fireEvent.click(amisTab);

    expect(
      screen.getByText(/Lucas_Run a commencé à vous suivre/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Emma_Trail a aimé votre sortie/i),
    ).toBeInTheDocument();
  });

  it("marks all notifications as read when clicking Tout lire", () => {
    const { container } = render(
      <IonReactRouter>
        <Notifications />
      </IonReactRouter>,
    );

    const markAllBtn = screen.getByText("Tout lire");
    expect(container.querySelectorAll(".notif-dot").length).toBeGreaterThan(0);

    fireEvent.click(markAllBtn);

    // No more unread dots
    expect(container.querySelectorAll(".notif-dot").length).toBe(0);
  });

  it("marks an individual notification as read on click", () => {
    const { container } = render(
      <IonReactRouter>
        <Notifications />
      </IonReactRouter>,
    );

    const unreadItem = container.querySelector(".notif-card.is-unread");
    expect(unreadItem).toBeInTheDocument();

    fireEvent.click(unreadItem!);

    expect(unreadItem?.classList.contains("is-read")).toBe(true);
  });

  it("marks an individual notification as read with Enter and Space keys", () => {
    const { container } = render(
      <IonReactRouter>
        <Notifications />
      </IonReactRouter>,
    );

    const unreadItems = container.querySelectorAll(".notif-card.is-unread");
    expect(unreadItems.length).toBeGreaterThanOrEqual(2);

    // Test Enter key on first unread item
    fireEvent.keyDown(unreadItems[0], { key: "Enter" });
    expect(unreadItems[0].classList.contains("is-read")).toBe(true);

    // Test Space key on second unread item
    fireEvent.keyDown(unreadItems[1], { key: " " });
    expect(unreadItems[1].classList.contains("is-read")).toBe(true);
  });
});
