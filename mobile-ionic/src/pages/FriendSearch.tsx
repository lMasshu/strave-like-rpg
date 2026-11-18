import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { peopleOutline, pulseOutline, trophyOutline } from "ionicons/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import ProfileTabs, { ProfileTab } from "../components/ProfileTabs";
import { panelId, tabId } from "../components/profileTabIds";
import QuestTracePreview from "../components/QuestTracePreview";
import { periodRange } from "../services/activityStats";
import {
  formatDistanceKm,
  formatDuration,
  formatPaceOrSpeed,
  formatStartedAt,
  sportLabel,
} from "../services/friendActivityFormat";
import {
  apiClient,
  FriendActivityDto,
  LeaderboardEntryDto,
  PublicPlayerDto,
  SearchedPlayerDto,
  SuggestedPlayerDto,
} from "../services/apiClient";
import "./FriendSearch.css";

/** Délai avant d'interroger l'API pendant la frappe. */
export const SEARCH_DEBOUNCE_MS = 250;
/** Propositions affichées sous la barre de recherche. */
export const DROPDOWN_LIMIT = 8;
/** Membres listés dans l'onglet Communauté (la recherche permet de trouver les autres). */
export const MEMBERS_LIMIT = 20;
/** Bulles d'amis affichées ; au-delà, « Voir tout ». */
export const VISIBLE_FRIENDS = 4;

type FriendsTabId = "community" | "activities";

const TABS_PREFIX = "friends";
const FRIENDS_TABS: ProfileTab<FriendsTabId>[] = [
  { id: "community", label: "Communauté", icon: peopleOutline },
  { id: "activities", label: "Activités des amis", icon: pulseOutline },
];

/** Médailles du podium, par position (1er, 2e, 3e). */
const PODIUM_STYLES = [
  { medal: "🥇", className: "podium-gold" },
  { medal: "🥈", className: "podium-silver" },
  { medal: "🥉", className: "podium-bronze" },
];

function formatKm(distanceMeters: number): string {
  return (Math.round(distanceMeters / 100) / 10).toFixed(1);
}

function suggestionReason(suggestion: SuggestedPlayerDto): string {
  const runs = `${suggestion.activityCount} sortie${suggestion.activityCount > 1 ? "s" : ""}`;
  return suggestion.reason === "main-zone"
    ? `Court dans ta ville · ${runs}`
    : `Près de ta dernière sortie · ${runs}`;
}

interface PlayerCardProps {
  player: PublicPlayerDto;
  subtitle?: string;
  following: boolean;
  pending: boolean;
  onToggle: () => void;
}

/** Carte d'un joueur avec son bouton Suivre / Suivi. */
const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  subtitle,
  following,
  pending,
  onToggle,
}) => (
  <article
    className="friends-card"
    role="listitem"
    aria-label={player.username}
  >
    <div className="friends-card-main">
      <div className="friends-avatar-wrap">
        <div className="friends-avatar" aria-hidden="true">
          {player.username.charAt(0).toUpperCase()}
        </div>
        <span
          className="friends-level-tag"
          aria-label={`Niveau ${player.level}`}
        >
          {player.level}
        </span>
      </div>
      <div className="friends-info">
        <div className="friends-name-row">
          <span className="friends-username">{player.username}</span>
        </div>
        <div className="friends-meta-row">
          <span className="friends-city">
            {subtitle ?? `Niveau ${player.level}`}
          </span>
        </div>
      </div>
    </div>

    <IonButton
      size="small"
      shape="round"
      fill={following ? "outline" : "solid"}
      className={
        following ? "friends-follow-btn is-following" : "friends-follow-btn"
      }
      disabled={pending}
      aria-label={`${following ? "Ne plus suivre" : "Suivre"} ${player.username}`}
      onClick={onToggle}
    >
      {following ? "Suivi" : "Suivre"}
    </IonButton>
  </article>
);

const FriendSearch: React.FC = () => {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FriendsTabId>("community");
  const [friends, setFriends] = useState<PublicPlayerDto[]>([]);
  const [showAllFriends, setShowAllFriends] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedPlayerDto[]>([]);
  const [members, setMembers] = useState<SearchedPlayerDto[] | null>(null);
  const [matches, setMatches] = useState<SearchedPlayerDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryDto[] | null>(
    null,
  );
  const [feed, setFeed] = useState<FriendActivityDto[] | null>(null);
  /** Joueurs en cours de (dé)suivi : bouton désactivé le temps de la requête. */
  const [pending, setPending] = useState<Set<string>>(new Set());

  const trimmedQuery = query.trim();

  const followedIds = useMemo(
    () => new Set(friends.map((friend) => friend.id)),
    [friends],
  );

  const loadFriends = useCallback(async () => {
    try {
      setFriends(await apiClient.getFriends());
    } catch {
      setError("Impossible de charger tes amis.");
    }
  }, []);

  const loadFeed = useCallback(async () => {
    try {
      setFeed(await apiClient.getFriendsActivities());
    } catch {
      setFeed([]);
      setError("Impossible de charger les activités de tes amis.");
    }
  }, []);

  // Semaine en cours (lundi 00:00 → lundi suivant, heure du téléphone).
  const loadLeaderboard = useCallback(async () => {
    const week = periodRange("week", new Date());
    try {
      setLeaderboard(await apiClient.getFriendsLeaderboard(week.from, week.to));
    } catch {
      setLeaderboard([]);
      setError("Impossible de charger le classement de la guilde.");
    }
  }, []);

  useEffect(() => {
    void loadFriends();
    void loadLeaderboard();
    void loadFeed();
    apiClient
      .getFriendSuggestions()
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
    apiClient
      .searchPlayers("", MEMBERS_LIMIT)
      .then(setMembers)
      .catch(() => {
        setMembers([]);
        setError("Impossible de charger les membres.");
      });
  }, [loadFriends, loadLeaderboard, loadFeed]);

  // Propositions sous la barre de recherche, après une courte pause de frappe.
  useEffect(() => {
    if (!trimmedQuery) {
      setMatches([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      apiClient
        .searchPlayers(trimmedQuery, DROPDOWN_LIMIT)
        .then((players) => {
          if (!cancelled) setMatches(players);
        })
        .catch(() => {
          if (!cancelled) setError("Recherche impossible pour le moment.");
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  const toggleFollow = async (player: PublicPlayerDto) => {
    const wasFollowing = followedIds.has(player.id);
    setPending((current) => new Set(current).add(player.id));
    setError(null);
    try {
      if (wasFollowing) await apiClient.unfollowPlayer(player.id);
      else await apiClient.followPlayer(player.id);
      await Promise.all([loadFriends(), loadLeaderboard(), loadFeed()]);
    } catch {
      setError(
        wasFollowing
          ? `Impossible de ne plus suivre ${player.username}.`
          : `Impossible de suivre ${player.username}.`,
      );
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(player.id);
        return next;
      });
    }
  };

  const cardProps = (player: PublicPlayerDto) => ({
    player,
    following: followedIds.has(player.id),
    pending: pending.has(player.id),
    onToggle: () => void toggleFollow(player),
  });

  const podium = (leaderboard ?? []).slice(0, 3);
  const me = leaderboard?.find((entry) => entry.isMe);
  const meOffPodium = me !== undefined && !podium.includes(me);

  const renderPodiumStep = (entry: LeaderboardEntryDto, position: number) => {
    const style = PODIUM_STYLES[position];
    return (
      <div
        key={entry.id}
        className={`guild-podium-step ${style.className}${entry.isMe ? " is-me" : ""}`}
        role="listitem"
        aria-label={`Rang ${entry.rank} : ${entry.isMe ? "toi" : entry.username}, ${formatKm(entry.distanceMeters)} km`}
      >
        <div className="guild-podium-medal" aria-hidden="true">
          {style.medal}
        </div>
        <div className="guild-podium-avatar-container" aria-hidden="true">
          <div className="friends-avatar guild-podium-avatar">
            {entry.username.charAt(0).toUpperCase()}
          </div>
          <span className="guild-podium-rank-tag">#{entry.rank}</span>
        </div>
        <span className="guild-podium-username" aria-hidden="true">
          {entry.isMe ? "Toi" : entry.username}
        </span>
        <span className="guild-podium-score" aria-hidden="true">
          {formatKm(entry.distanceMeters)} km
        </span>
        <span className="guild-podium-level" aria-hidden="true">
          Niv. {entry.level}
        </span>
      </div>
    );
  };

  /** « Voir tout » dès que toutes les bulles sont occupées. */
  const canShowAllFriends = friends.length >= VISIBLE_FRIENDS;
  const hiddenFriends = friends.length - VISIBLE_FRIENDS;

  const panelProps = (id: FriendsTabId) => ({
    role: "tabpanel",
    id: panelId(TABS_PREFIX, id),
    "aria-labelledby": tabId(TABS_PREFIX, id),
    tabIndex: 0,
    className: "sq-profile-tab-panel",
  });

  return (
    <IonPage>
      <IonHeader className="top-bar friends-header" translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/accueil" text="" />
          </IonButtons>

          <IonTitle>Trouver des amis</IonTitle>
        </IonToolbar>

        <IonToolbar className="friends-search-toolbar">
          <IonSearchbar
            placeholder="Chercher un pseudo…"
            debounce={0}
            value={query}
            data-testid="friends-searchbar"
            onIonInput={(event) => setQuery(event.detail.value ?? "")}
            onInput={(event: React.FormEvent<HTMLIonSearchbarElement>) => {
              const target = event.target as HTMLInputElement;
              if (target && typeof target.value === "string") {
                setQuery(target.value);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
            className="friends-searchbar"
          />
        </IonToolbar>

        {/* Propositions juste sous la barre, comme un moteur de recherche */}
        {trimmedQuery && (
          <div className="friends-search-dropdown">
            {searching && matches.length === 0 ? (
              <div className="friends-search-status" role="status">
                <IonSpinner name="crescent" aria-hidden="true" />
                <span>Recherche…</span>
              </div>
            ) : matches.length === 0 ? (
              <p className="friends-search-status" role="status">
                Aucun aventurier ne correspond à « {trimmedQuery} ».
              </p>
            ) : (
              <div
                className="friends-list"
                role="list"
                aria-label="Résultats de recherche"
              >
                {matches.map((player) => (
                  <PlayerCard key={player.id} {...cardProps(player)} />
                ))}
              </div>
            )}
          </div>
        )}
      </IonHeader>

      <IonContent className="friends-page-content">
        <main className="friends-container">
          {error && (
            <p className="friends-error" role="alert">
              {error}
            </p>
          )}

          {/* Mes amis : les joueurs que je suis */}
          <section
            className="sq-card friends-bubbles-section"
            aria-label="Mes amis"
          >
            <div className="friends-bubbles-header">
              <span className="friends-bubbles-title">
                Mes amis • {friends.length}
              </span>
              {canShowAllFriends && (
                <button
                  type="button"
                  className="friends-see-all"
                  aria-expanded={showAllFriends}
                  aria-controls="friends-all-list"
                  onClick={() => setShowAllFriends((open) => !open)}
                >
                  {showAllFriends ? "Réduire" : "Voir tout"}
                </button>
              )}
            </div>

            {friends.length === 0 ? (
              <p className="friends-empty">
                Tu ne suis encore personne : trouve des coureurs ci-dessous.
              </p>
            ) : showAllFriends ? (
              <div
                id="friends-all-list"
                className="friends-list"
                role="list"
                aria-label="Tous mes amis"
              >
                {friends.map((friend) => (
                  <PlayerCard key={friend.id} {...cardProps(friend)} />
                ))}
              </div>
            ) : (
              <div className="friends-bubbles-row" role="list">
                {friends.slice(0, VISIBLE_FRIENDS).map((friend) => (
                  <div
                    key={friend.id}
                    className="friends-bubble-item"
                    role="listitem"
                  >
                    <div className="friends-bubble-avatar" aria-hidden="true">
                      {friend.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="friends-bubble-name">
                      {friend.username}
                    </span>
                  </div>
                ))}
                {hiddenFriends > 0 && (
                  <button
                    type="button"
                    className="friends-bubble-item friends-bubble-more-btn"
                    aria-label={`Voir les ${hiddenFriends} autres amis`}
                    onClick={() => setShowAllFriends(true)}
                  >
                    <span className="friends-bubble-avatar bubble-more">
                      +{hiddenFriends}
                    </span>
                    <span className="friends-bubble-name">Voir tout</span>
                  </button>
                )}
              </div>
            )}
          </section>

          <ProfileTabs
            tabs={FRIENDS_TABS}
            activeTab={activeTab}
            onChange={setActiveTab}
            idPrefix={TABS_PREFIX}
            label="Sections de la page Amis"
          />

          {activeTab === "community" && (
            <div {...panelProps("community")}>
              {/* Suggestions : coureurs de ma ville principale et de ma dernière sortie */}
              <section
                className="friends-list-section"
                aria-labelledby="friends-suggestions-title"
              >
                <div className="friends-list-header">
                  <h2
                    id="friends-suggestions-title"
                    className="friends-list-title"
                  >
                    Suggestions près de chez toi
                  </h2>
                </div>
                {suggestions.length === 0 ? (
                  <div className="friends-empty-card">
                    <p className="friends-empty">
                      Enregistre une sortie GPS pour découvrir les coureurs de
                      ta ville.
                    </p>
                  </div>
                ) : (
                  <div
                    className="friends-list"
                    role="list"
                    aria-label="Suggestions"
                  >
                    {suggestions.map((suggestion) => (
                      <PlayerCard
                        key={suggestion.id}
                        {...cardProps(suggestion)}
                        subtitle={suggestionReason(suggestion)}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Membres de la communauté, limités : la recherche sert à trouver les autres */}
              <section
                className="friends-list-section"
                aria-labelledby="friends-members-title"
              >
                <div className="friends-list-header">
                  <h2 id="friends-members-title" className="friends-list-title">
                    Membres de la communauté
                  </h2>
                </div>
                {members === null ? (
                  <div className="friends-search-status" role="status">
                    <IonSpinner name="crescent" aria-hidden="true" />
                    <span>Chargement…</span>
                  </div>
                ) : members.length === 0 ? (
                  <div className="friends-empty-card">
                    <p className="friends-empty">
                      Aucun autre aventurier inscrit pour le moment.
                    </p>
                  </div>
                ) : (
                  <>
                    <div
                      className="friends-list"
                      role="list"
                      aria-label="Membres"
                    >
                      {members.map((player) => (
                        <PlayerCard key={player.id} {...cardProps(player)} />
                      ))}
                    </div>
                    {members.length >= MEMBERS_LIMIT && (
                      <p className="friends-members-hint">
                        Seuls les {MEMBERS_LIMIT} premiers membres sont affichés
                        : utilise la recherche pour trouver les autres.
                      </p>
                    )}
                  </>
                )}
              </section>
            </div>
          )}

          {activeTab === "activities" && (
            <div {...panelProps("activities")}>
              {/* Classement de la guilde : moi + mes amis, distance de la semaine */}
              <section
                className="sq-card guild-leaderboard-card"
                aria-labelledby="guild-leaderboard-title"
              >
                <div className="guild-leaderboard-header">
                  <div className="guild-leaderboard-icon-wrap">
                    <IonIcon icon={trophyOutline} aria-hidden="true" />
                  </div>
                  <div className="guild-leaderboard-titles">
                    <h2
                      id="guild-leaderboard-title"
                      className="guild-leaderboard-title"
                    >
                      Classement de la Guilde
                    </h2>
                    <p className="guild-leaderboard-subtitle">
                      Toi et tes amis · distance de la semaine
                    </p>
                  </div>
                </div>

                {leaderboard === null ? (
                  <div className="friends-search-status" role="status">
                    <IonSpinner name="crescent" aria-hidden="true" />
                    <span>Chargement…</span>
                  </div>
                ) : (
                  <>
                    {/* Ordre visuel 2 – 1 – 3, ordre de lecture 1 – 2 – 3 */}
                    <div
                      className={`guild-podium guild-podium-size-${podium.length}`}
                      role="list"
                      aria-label="Podium de la semaine"
                    >
                      {podium.map((entry, position) =>
                        renderPodiumStep(entry, position),
                      )}
                    </div>
                    {meOffPodium && (
                      <p className="guild-my-rank">
                        Ta place : <strong>#{me.rank}</strong> sur{" "}
                        {leaderboard.length} · {formatKm(me.distanceMeters)} km
                      </p>
                    )}
                    {friends.length === 0 && (
                      <p className="friends-empty">
                        Suis des coureurs pour te mesurer à eux chaque semaine.
                      </p>
                    )}
                  </>
                )}
              </section>

              {/* Fil d'activités des amis : la sortie la plus récente en haut */}
              <section
                className="friends-feed-section"
                aria-labelledby="friends-feed-title"
              >
                <h2 id="friends-feed-title" className="sq-section-title">
                  Activités de mes amis
                </h2>
                {feed === null ? (
                  <div className="friends-search-status" role="status">
                    <IonSpinner name="crescent" aria-hidden="true" />
                    <span>Chargement…</span>
                  </div>
                ) : feed.length === 0 ? (
                  <div className="friends-empty-card">
                    <p className="friends-empty">
                      {friends.length === 0
                        ? "Suis des coureurs pour voir leurs sorties ici."
                        : "Tes amis n'ont encore enregistré aucune sortie."}
                    </p>
                  </div>
                ) : (
                  <div
                    className="friends-feed-list"
                    role="list"
                    aria-label="Sorties de mes amis"
                  >
                    {feed.map((activity) => (
                      <article
                        key={activity.id}
                        className="sq-card friends-activity-item"
                        role="listitem"
                        aria-label={`${activity.player.username}, ${sportLabel(activity.activityType)}`}
                      >
                        <div className="friends-activity-trace-col">
                          <QuestTracePreview
                            distanceKm={
                              Math.round(activity.distanceMeters / 100) / 10
                            }
                            elevationMeters={Math.round(
                              activity.elevationGainMeters,
                            )}
                            className="friends-activity-mini-trace"
                          />
                        </div>
                        <div className="friends-activity-info-col">
                          <h3 className="friends-activity-title">
                            {activity.player.username} •{" "}
                            {sportLabel(activity.activityType)}
                          </h3>
                          <time
                            className="friends-activity-time"
                            dateTime={activity.startedAt}
                          >
                            {formatStartedAt(activity.startedAt, new Date())}
                          </time>
                          <p className="friends-activity-stats">
                            {formatDistanceKm(activity.distanceMeters)} •{" "}
                            {formatDuration(activity.durationSeconds)} •{" "}
                            {formatPaceOrSpeed(
                              activity.activityType,
                              activity.distanceMeters,
                              activity.durationSeconds,
                            )}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
};

export default FriendSearch;
