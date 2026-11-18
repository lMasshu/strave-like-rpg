import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import FriendSearch, {
  DROPDOWN_LIMIT,
  MEMBERS_LIMIT,
  VISIBLE_FRIENDS,
} from "./FriendSearch";
import {
  apiClient,
  FriendActivityDto,
  LeaderboardEntryDto,
  PublicPlayerDto,
  SearchedPlayerDto,
  SuggestedPlayerDto,
} from "../services/apiClient";

const player = (id: string, username: string, level = 1): PublicPlayerDto => ({
  id,
  username,
  level,
  experience: (level - 1) * 1000,
  createdAt: "2026-11-01T00:00:00.000Z",
});

const TEST = player("p-test", "test", 8);
const LUCAS = player("p-lucas", "Lucas_Run", 1);
const HUGO = player("p-hugo", "Hugo_Bike", 7);
const LEA = player("p-lea", "Lea_Trail", 4);
const NINA = player("p-nina", "Nina", 2);
const ME = player("p-me", "mathieu_sueur", 1);

const entry = (
  who: PublicPlayerDto,
  km: number,
  rank: number,
  isMe = false,
): LeaderboardEntryDto => ({
  ...who,
  distanceMeters: km * 1000,
  activityCount: km > 0 ? 1 : 0,
  rank,
  isMe,
});

const sortie = (
  id: string,
  who: PublicPlayerDto,
  activityType: FriendActivityDto["activityType"],
  startedAt: Date,
  km: number,
  minutes: number,
): FriendActivityDto => ({
  id,
  player: who,
  activityType,
  startedAt: startedAt.toISOString(),
  durationSeconds: minutes * 60,
  distanceMeters: km * 1000,
  elevationGainMeters: 0,
});

function openActivitiesTab() {
  fireEvent.click(screen.getByRole("tab", { name: /Activités des amis/ }));
}

function renderPage() {
  return render(
    <IonReactRouter>
      <FriendSearch />
    </IonReactRouter>,
  );
}

/** Bouton Suivre / Suivi de la carte d'un joueur dans une liste donnée. */
async function followButton(
  list: HTMLElement,
  username: string,
  label: "Suivre" | "Suivi",
): Promise<HTMLElement> {
  const card = await within(list).findByRole("listitem", { name: username });
  return within(card).getByText(label);
}

function typeSearch(value: string) {
  fireEvent.input(screen.getByTestId("friends-searchbar"), {
    target: { value },
  });
}

describe("FriendSearch : amis, communauté et recherche", () => {
  let registered: PublicPlayerDto[];
  let friends: PublicPlayerDto[];
  let search: ReturnType<typeof vi.spyOn>;
  let suggestions: ReturnType<typeof vi.spyOn>;
  let follow: ReturnType<typeof vi.spyOn>;
  let unfollow: ReturnType<typeof vi.spyOn>;
  let leaderboard: ReturnType<typeof vi.spyOn>;
  let feed: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    registered = [HUGO, LUCAS, TEST];
    friends = [];
    vi.spyOn(apiClient, "getFriends").mockImplementation(async () => [
      ...friends,
    ]);
    search = vi
      .spyOn(apiClient, "searchPlayers")
      .mockImplementation(async (query = "", limit = 20) =>
        registered
          .filter((p) =>
            p.username.toLowerCase().includes(query.trim().toLowerCase()),
          )
          .slice(0, limit)
          .map((p): SearchedPlayerDto => ({
            ...p,
            following: friends.some((f) => f.id === p.id),
          })),
      );
    suggestions = vi
      .spyOn(apiClient, "getFriendSuggestions")
      .mockResolvedValue([]);
    feed = vi.spyOn(apiClient, "getFriendsActivities").mockResolvedValue([]);
    leaderboard = vi
      .spyOn(apiClient, "getFriendsLeaderboard")
      .mockResolvedValue([entry(ME, 0, 1, true)]);
    follow = vi
      .spyOn(apiClient, "followPlayer")
      .mockImplementation(async (id) => {
        friends.push(registered.find((p) => p.id === id)!);
      });
    unfollow = vi
      .spyOn(apiClient, "unfollowPlayer")
      .mockImplementation(async (id) => {
        friends = friends.filter((f) => f.id !== id);
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("recherche", () => {
    it("affiche les propositions juste sous la barre, sans toucher aux membres", async () => {
      renderPage();
      const members = await screen.findByRole("list", { name: "Membres" });
      await waitFor(() =>
        expect(within(members).getAllByRole("listitem")).toHaveLength(3),
      );

      typeSearch("tes");

      const dropdown = await screen.findByRole("list", {
        name: "Résultats de recherche",
      });
      expect(
        within(dropdown)
          .getAllByRole("listitem")
          .map((item) => item.getAttribute("aria-label")),
      ).toEqual(["test"]);
      expect(search).toHaveBeenLastCalledWith("tes", DROPDOWN_LIMIT);
      // La liste des membres n'est pas filtrée par la recherche.
      expect(
        within(screen.getByRole("list", { name: "Membres" })).getAllByRole(
          "listitem",
        ),
      ).toHaveLength(3);
    });

    it("pas de liste de propositions tant que rien n'est tapé", async () => {
      renderPage();
      await screen.findByRole("list", { name: "Membres" });
      expect(
        screen.queryByRole("list", { name: "Résultats de recherche" }),
      ).toBeNull();
      expect(search).not.toHaveBeenCalledWith(
        expect.any(String),
        DROPDOWN_LIMIT,
      );
    });

    it("signale qu'aucun pseudo ne correspond", async () => {
      renderPage();
      typeSearch("InconnuXYZ");

      expect(
        await screen.findByText(
          "Aucun aventurier ne correspond à « InconnuXYZ ».",
        ),
      ).toBeInTheDocument();
    });

    it("Échap efface la recherche et ferme les propositions", async () => {
      renderPage();
      typeSearch("tes");
      await screen.findByRole("list", { name: "Résultats de recherche" });

      fireEvent.keyDown(screen.getByTestId("friends-searchbar"), {
        key: "Escape",
      });

      await waitFor(() =>
        expect(
          screen.queryByRole("list", { name: "Résultats de recherche" }),
        ).toBeNull(),
      );
    });

    it("on peut suivre directement depuis les propositions", async () => {
      renderPage();
      typeSearch("tes");
      const dropdown = await screen.findByRole("list", {
        name: "Résultats de recherche",
      });

      fireEvent.click(await followButton(dropdown, "test", "Suivre"));

      await waitFor(() => expect(follow).toHaveBeenCalledWith("p-test"));
      expect(await screen.findByText("Mes amis • 1")).toBeInTheDocument();
    });
  });

  describe("membres inscrits", () => {
    it(`n'en demande que ${MEMBERS_LIMIT} et invite à chercher les autres`, async () => {
      registered = Array.from({ length: 30 }, (_, i) =>
        player(`m-${i}`, `membre_${String(i).padStart(2, "0")}`),
      );
      renderPage();

      const members = await screen.findByRole("list", { name: "Membres" });
      await waitFor(() =>
        expect(within(members).getAllByRole("listitem")).toHaveLength(
          MEMBERS_LIMIT,
        ),
      );
      expect(search).toHaveBeenCalledWith("", MEMBERS_LIMIT);
      expect(
        screen.getByText(/utilise la recherche pour trouver les autres/),
      ).toBeInTheDocument();
    });

    it("suivre un membre l'ajoute à mes amis, puis on peut ne plus le suivre", async () => {
      renderPage();

      const members = await screen.findByRole("list", { name: "Membres" });
      fireEvent.click(await followButton(members, "test", "Suivre"));
      await waitFor(() => expect(follow).toHaveBeenCalledWith("p-test"));
      expect(await screen.findByText("Mes amis • 1")).toBeInTheDocument();

      fireEvent.click(await followButton(members, "test", "Suivi"));
      await waitFor(() => expect(unfollow).toHaveBeenCalledWith("p-test"));
      expect(await screen.findByText("Mes amis • 0")).toBeInTheDocument();
    });

    it("signale un échec de suivi sans changer la liste d'amis", async () => {
      follow.mockRejectedValue(new Error("réseau"));
      renderPage();

      const members = await screen.findByRole("list", { name: "Membres" });
      fireEvent.click(await followButton(members, "test", "Suivre"));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Impossible de suivre test.",
      );
      expect(screen.getByText("Mes amis • 0")).toBeInTheDocument();
    });
  });

  describe("mes amis", () => {
    it("pas de « Voir tout » tant que les places ne sont pas toutes prises", async () => {
      friends = [HUGO, LUCAS];
      renderPage();

      expect(await screen.findByText("Mes amis • 2")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Voir tout" })).toBeNull();
    });

    it("« Voir tout » affiche la liste complète des amis", async () => {
      friends = [HUGO, LEA, LUCAS, NINA, TEST];
      expect(friends.length).toBeGreaterThan(VISIBLE_FRIENDS);
      renderPage();

      const seeAll = await screen.findByRole("button", { name: "Voir tout" });
      expect(seeAll).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.getByRole("button", { name: "Voir les 1 autres amis" }),
      ).toBeInTheDocument();

      fireEvent.click(seeAll);

      const all = screen.getByRole("list", { name: "Tous mes amis" });
      expect(
        within(all)
          .getAllByRole("listitem")
          .map((item) => item.getAttribute("aria-label")),
      ).toEqual(["Hugo_Bike", "Lea_Trail", "Lucas_Run", "Nina", "test"]);
      expect(screen.getByRole("button", { name: "Réduire" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });
  });

  describe("onglets", () => {
    it("Communauté par défaut, Activités des amis au clic", async () => {
      renderPage();

      expect(screen.getByRole("tab", { name: /Communauté/ })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(
        await screen.findByRole("list", { name: "Membres" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Classement de la Guilde")).toBeNull();
      expect(screen.queryByText("Activités de mes amis")).toBeNull();

      fireEvent.click(screen.getByRole("tab", { name: /Activités des amis/ }));

      // Classement de la guilde en haut de l'onglet, avant le fil d'activités.
      const guild = screen.getByRole("heading", {
        name: "Classement de la Guilde",
      });
      const feed = screen.getByText("Activités de mes amis");
      expect(
        guild.compareDocumentPosition(feed) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(screen.queryByRole("list", { name: "Membres" })).toBeNull();
      // Mes amis restent visibles au-dessus des onglets.
      expect(screen.getByText("Mes amis • 0")).toBeInTheDocument();
    });
  });

  describe("activités des amis", () => {
    it("affiche les vraies sorties de mes amis, la plus récente en haut", async () => {
      const now = new Date();
      const hier = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        9,
        0,
      );
      const avantHier = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 2,
        18,
        30,
      );
      // L'API renvoie déjà la plus récente en premier : l'ordre est conservé.
      feed.mockResolvedValue([
        sortie("a-2", HUGO, "bike", hier, 60, 180),
        sortie("a-1", LEA, "run", avantHier, 10, 60),
      ]);
      friends = [HUGO, LEA];
      renderPage();
      openActivitiesTab();

      const list = await screen.findByRole("list", {
        name: "Sorties de mes amis",
      });
      const items = within(list).getAllByRole("listitem");
      expect(items.map((item) => item.getAttribute("aria-label"))).toEqual([
        "Hugo_Bike, Vélo",
        "Lea_Trail, Course à pied",
      ]);
      expect(items[0]).toHaveTextContent("Hier · 09:00");
      expect(items[0]).toHaveTextContent("60.0 km • 3 h 00 • 20.0 km/h");
      expect(items[1]).toHaveTextContent("10.0 km • 1 h 00 • 6'00\"/km");
      expect(within(items[1]).getByText(/18:30/).tagName).toBe("TIME");
    });

    it("sans ami : invite à suivre des coureurs", async () => {
      renderPage();
      openActivitiesTab();
      expect(
        await screen.findByText(
          "Suis des coureurs pour voir leurs sorties ici.",
        ),
      ).toBeInTheDocument();
    });

    it("amis sans sortie : le dit clairement", async () => {
      friends = [HUGO];
      renderPage();
      openActivitiesTab();
      expect(
        await screen.findByText(
          "Tes amis n'ont encore enregistré aucune sortie.",
        ),
      ).toBeInTheDocument();
    });

    it("se recharge quand je suis quelqu'un", async () => {
      renderPage();
      const members = await screen.findByRole("list", { name: "Membres" });
      await waitFor(() => expect(feed).toHaveBeenCalledTimes(1));

      fireEvent.click(await followButton(members, "test", "Suivre"));

      await waitFor(() => expect(feed).toHaveBeenCalledTimes(2));
    });
  });

  describe("classement de la guilde", () => {
    it("demande la semaine en cours (lundi → lundi suivant)", async () => {
      renderPage();
      await waitFor(() => expect(leaderboard).toHaveBeenCalled());
      const [from, to] = leaderboard.mock.calls[0] as [Date, Date];
      expect(from.getDay()).toBe(1);
      expect(from.getHours()).toBe(0);
      expect(to.getTime() - from.getTime()).toBeGreaterThanOrEqual(
        7 * 24 * 3600 * 1000 - 3600 * 1000,
      );
    });

    it("podium des 3 premiers avec leurs vrais kilomètres", async () => {
      leaderboard.mockResolvedValue([
        entry(HUGO, 42, 1),
        entry(ME, 10, 2, true),
        entry(LEA, 5.25, 3),
        entry(LUCAS, 0, 4),
      ]);
      friends = [HUGO, LEA, LUCAS];
      renderPage();
      openActivitiesTab();

      const podium = await screen.findByRole("list", {
        name: "Podium de la semaine",
      });
      expect(
        within(podium)
          .getAllByRole("listitem")
          .map((item) => item.getAttribute("aria-label")),
      ).toEqual([
        "Rang 1 : Hugo_Bike, 42.0 km",
        "Rang 2 : toi, 10.0 km",
        "Rang 3 : Lea_Trail, 5.3 km",
      ]);
      expect(screen.queryByText(/Ta place/)).toBeNull();
    });

    it("hors du podium, ma place est affichée en dessous", async () => {
      leaderboard.mockResolvedValue([
        entry(HUGO, 42, 1),
        entry(LEA, 20, 2),
        entry(LUCAS, 12, 3),
        entry(ME, 3, 4, true),
      ]);
      friends = [HUGO, LEA, LUCAS];
      renderPage();
      openActivitiesTab();

      const myRank = await screen.findByText(/Ta place/);
      expect(myRank).toHaveTextContent("Ta place : #4 sur 4 · 3.0 km");
    });

    it("sans ami : seul au classement, avec une invitation à suivre", async () => {
      renderPage();
      openActivitiesTab();

      const podium = await screen.findByRole("list", {
        name: "Podium de la semaine",
      });
      expect(within(podium).getAllByRole("listitem")).toHaveLength(1);
      expect(
        screen.getByText(/Suis des coureurs pour te mesurer à eux/),
      ).toBeInTheDocument();
    });

    it("se met à jour quand je suis quelqu'un", async () => {
      renderPage();
      const members = await screen.findByRole("list", { name: "Membres" });
      await waitFor(() => expect(leaderboard).toHaveBeenCalledTimes(1));

      fireEvent.click(await followButton(members, "test", "Suivre"));

      await waitFor(() => expect(leaderboard).toHaveBeenCalledTimes(2));
    });
  });

  describe("suggestions", () => {
    it("propose les coureurs de ma ville et de ma dernière sortie", async () => {
      const suggested: SuggestedPlayerDto[] = [
        { ...LUCAS, reason: "main-zone", activityCount: 3 },
        { ...HUGO, reason: "last-zone", activityCount: 1 },
      ];
      suggestions.mockResolvedValue(suggested);
      renderPage();

      const list = await screen.findByRole("list", { name: "Suggestions" });
      expect(
        within(list).getByText("Court dans ta ville · 3 sorties"),
      ).toBeInTheDocument();
      expect(
        within(list).getByText("Près de ta dernière sortie · 1 sortie"),
      ).toBeInTheDocument();
    });

    it("sans sortie GPS : invite à enregistrer une sortie", async () => {
      renderPage();
      expect(
        await screen.findByText(/Enregistre une sortie GPS/),
      ).toBeInTheDocument();
    });
  });
});
