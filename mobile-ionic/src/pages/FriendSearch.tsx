import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import LineMdIcon from "../components/LineMdIcon";
import { useMemo, useState } from "react";
import QuestTracePreview from "../components/QuestTracePreview";
import { DEMO_ATHLETES, DEMO_FRIEND_ACTIVITIES, Athlete } from "../data/demo";
import "./FriendSearch.css";

const FriendSearch: React.FC = () => {
  const [query, setQuery] = useState("");
  const [following, setFollowing] = useState<Set<string>>(new Set());

  const guildPodium = useMemo(() => {
    return [...DEMO_ATHLETES]
      .sort((a, b) => (b.weeklyDistanceKm ?? 0) - (a.weeklyDistanceKm ?? 0))
      .slice(0, 3);
  }, []);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return DEMO_ATHLETES;
    }

    return DEMO_ATHLETES.filter(
      (athlete) =>
        athlete.username.toLowerCase().includes(normalized) ||
        athlete.city.toLowerCase().includes(normalized),
    );
  }, [query]);

  const toggleFollow = (id: string) => {
    setFollowing((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const renderPodiumStep = (
    athlete: Athlete,
    rank: 1 | 2 | 3,
    medalEmoji: string,
    podiumClass: string,
  ) => {
    return (
      <div
        key={athlete.id}
        className={`guild-podium-step ${podiumClass}`}
        aria-label={`Rang ${rank}: ${athlete.username}`}
      >
        <div className="guild-podium-medal">{medalEmoji}</div>
        <div className="guild-podium-avatar-container">
          <div className="friends-avatar guild-podium-avatar">
            {athlete.username.charAt(0).toUpperCase()}
          </div>
          <span className="guild-podium-rank-tag">#{rank}</span>
        </div>
        <span className="guild-podium-username">{athlete.username}</span>
        <span className="guild-podium-score">
          {athlete.weeklyDistanceKm?.toFixed(1) ?? "0"} km
        </span>
        <span className="guild-podium-level">Niv. {athlete.level}</span>
      </div>
    );
  };

  return (
    <IonPage>
      <IonHeader className="top-bar" translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/accueil" text="" />
          </IonButtons>

          <IonTitle>Trouver des amis</IonTitle>
        </IonToolbar>

        <IonToolbar className="friends-search-toolbar">
          <IonSearchbar
            placeholder="Pseudo ou ville…"
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
            className="friends-searchbar"
          />
        </IonToolbar>
      </IonHeader>

      <IonContent className="friends-page-content">
        <main className="friends-container">
          {/* Rangée horizontale d'amis (Maquette Page 5) */}
          <section
            className="sq-card friends-bubbles-section"
            aria-label="Mes amis"
          >
            <div className="friends-bubbles-header">
              <span className="friends-bubbles-title">Mes amis • 12</span>
            </div>
            <div className="friends-bubbles-row">
              <div className="friends-bubble-item">
                <div className="friends-bubble-avatar">L</div>
                <span className="friends-bubble-name">Léa</span>
              </div>
              <div className="friends-bubble-item">
                <div className="friends-bubble-avatar">H</div>
                <span className="friends-bubble-name">Hugo</span>
              </div>
              <div className="friends-bubble-item">
                <div className="friends-bubble-avatar">S</div>
                <span className="friends-bubble-name">Sarah</span>
              </div>
              <div className="friends-bubble-item">
                <div className="friends-bubble-avatar">T</div>
                <span className="friends-bubble-name">Tom</span>
              </div>
              <div className="friends-bubble-item">
                <div className="friends-bubble-avatar bubble-more">+8</div>
                <span className="friends-bubble-name">Voir tout</span>
              </div>
            </div>
          </section>

          {/* Flux : Activités de mes amis (Maquette Page 5) */}
          <section
            className="friends-feed-section"
            aria-label="Activités de mes amis"
          >
            <h2 className="sq-section-title">Activités de mes amis</h2>
            <div className="friends-feed-list">
              {DEMO_FRIEND_ACTIVITIES.map((act) => (
                <article key={act.id} className="sq-card friends-activity-item">
                  <div className="friends-activity-trace-col">
                    <QuestTracePreview
                      distanceKm={act.distanceKm}
                      elevationMeters={45}
                      className="friends-activity-mini-trace"
                    />
                  </div>
                  <div className="friends-activity-info-col">
                    <h3 className="friends-activity-title">
                      {act.friendName} •{" "}
                      {act.type === "cycle" ? "Vélo" : "Course à pied"}
                    </h3>
                    <span className="friends-activity-time">
                      {act.timeLabel}
                    </span>
                    <p className="friends-activity-stats">
                      {act.distanceKm} km • {act.durationFormatted} •{" "}
                      {act.paceOrSpeed}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Classement de la Guilde (Top 3 de la semaine) */}
          <section
            className="sq-card guild-leaderboard-card"
            aria-label="Classement de la Guilde"
          >
            <div className="guild-leaderboard-header">
              <div className="guild-leaderboard-icon-wrap">
                <LineMdIcon name="star" />
              </div>
              <div className="guild-leaderboard-titles">
                <h2 className="guild-leaderboard-title">
                  Classement de la Guilde
                </h2>
                <p className="guild-leaderboard-subtitle">
                  Top 3 distance hebdomadaire
                </p>
              </div>
            </div>

            <div className="guild-podium">
              {guildPodium[1] &&
                renderPodiumStep(guildPodium[1], 2, "🥈", "podium-silver")}
              {guildPodium[0] &&
                renderPodiumStep(guildPodium[0], 1, "🥇", "podium-gold")}
              {guildPodium[2] &&
                renderPodiumStep(guildPodium[2], 3, "🥉", "podium-bronze")}
            </div>
          </section>

          {/* Liste des aventuriers */}
          <section className="friends-list-section">
            <div className="friends-list-header">
              <h3 className="friends-list-title">
                {query.trim()
                  ? `Résultats (${results.length})`
                  : `Membres disponibles (${results.length})`}
              </h3>
            </div>

            {results.length === 0 ? (
              <div className="friends-empty-card">
                <p className="friends-empty">
                  Aucun aventurier ne correspond à votre recherche « {query} ».
                </p>
              </div>
            ) : (
              <div className="friends-list" role="list">
                {results.map((athlete) => {
                  const isFollowing = following.has(athlete.id);

                  return (
                    <article
                      key={athlete.id}
                      className="friends-card"
                      role="listitem"
                    >
                      <div className="friends-card-main">
                        <div className="friends-avatar-wrap">
                          <div className="friends-avatar">
                            {athlete.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="friends-level-tag">
                            {athlete.level}
                          </span>
                        </div>

                        <div className="friends-info">
                          <div className="friends-name-row">
                            <span className="friends-username">
                              {athlete.username}
                            </span>
                            {athlete.role && (
                              <span className="friends-role-badge">
                                {athlete.role}
                              </span>
                            )}
                          </div>

                          <div className="friends-meta-row">
                            <span className="friends-city">{athlete.city}</span>
                            {athlete.weeklyDistanceKm !== undefined && (
                              <span className="friends-distance">
                                · {athlete.weeklyDistanceKm.toFixed(1)} km/sem.
                              </span>
                            )}
                          </div>

                          {athlete.status && (
                            <div
                              className={`friends-status-badge status-${athlete.status}`}
                            >
                              <span className="friends-status-dot" />
                              <span className="friends-status-text">
                                {athlete.statusLabel ??
                                  (athlete.status === "en_course"
                                    ? "En course"
                                    : athlete.status === "actif_recemment"
                                      ? "Actif"
                                      : "Au repos")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <IonButton
                        size="small"
                        shape="round"
                        fill={isFollowing ? "outline" : "solid"}
                        className={`friends-follow-btn ${
                          isFollowing ? "is-following" : ""
                        }`}
                        onClick={() => toggleFollow(athlete.id)}
                      >
                        {isFollowing ? "Suivi" : "Suivre"}
                      </IonButton>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default FriendSearch;
