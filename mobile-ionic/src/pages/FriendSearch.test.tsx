import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import FriendSearch from "./FriendSearch";

describe("FriendSearch Page (Guild & Friends)", () => {
  it("renders page header and guild leaderboard card with top 3 podium", () => {
    render(
      <IonReactRouter>
        <FriendSearch />
      </IonReactRouter>,
    );

    expect(screen.getByText("Trouver des amis")).toBeInTheDocument();
    expect(screen.getByText("Classement de la Guilde")).toBeInTheDocument();
    expect(screen.getByText("Top 3 distance hebdomadaire")).toBeInTheDocument();

    // Verify top 3 podium members exist
    expect(screen.getAllByText("Hugo_Bike").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Lucas_Run").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Emma_Trail").length).toBeGreaterThanOrEqual(1);
  });

  it("renders friends list with status tags and follow buttons", () => {
    render(
      <IonReactRouter>
        <FriendSearch />
      </IonReactRouter>,
    );

    const followButtons = screen.getAllByText("Suivre");
    expect(followButtons.length).toBeGreaterThan(0);

    // Click on the first follow button
    fireEvent.click(followButtons[0]);
    expect(screen.getByText("Suivi")).toBeInTheDocument();
  });

  it("filters athletes based on search query", async () => {
    const { container } = render(
      <IonReactRouter>
        <FriendSearch />
      </IonReactRouter>,
    );

    const searchbar = screen.getByTestId("friends-searchbar");
    fireEvent.input(searchbar, { target: { value: "Amiens" } });

    await waitFor(() => {
      const list = container.querySelector(".friends-list");
      expect(list).toBeInTheDocument();
      expect(list?.textContent).toContain("Lucas_Run");
      expect(list?.textContent).toContain("Nathan_Sprint");
      expect(list?.textContent).not.toContain("Emma_Trail");
    });
  });

  it("shows empty state when no athlete matches the query", async () => {
    render(
      <IonReactRouter>
        <FriendSearch />
      </IonReactRouter>,
    );

    const searchbar = screen.getByTestId("friends-searchbar");
    fireEvent.input(searchbar, { target: { value: "InconnuXYZ" } });

    await waitFor(() => {
      expect(
        screen.getByText(/Aucun aventurier ne correspond à votre recherche/i),
      ).toBeInTheDocument();
    });
  });
});
