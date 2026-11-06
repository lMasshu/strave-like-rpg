import React, { useState } from "react";
import { IonContent, IonIcon, IonPage, IonSearchbar } from "@ionic/react";
import { useNavigate } from "react-router-dom";
import { compassOutline } from "ionicons/icons";
import TopBar from "../components/TopBar";
import QuestTracePreview from "../components/QuestTracePreview";
import { DEMO_PUBLIC_ROUTES } from "../data/demo";
import "./Parcours.css";

type RouteFilter = "pres_de_moi" | "course" | "velo";

const Parcours: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<RouteFilter>("pres_de_moi");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRoutes = DEMO_PUBLIC_ROUTES.filter((route) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      route.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.author.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === "course") return route.type === "run";
    if (filter === "velo") return route.type === "cycle";
    return true;
  });

  const handleSelectRoute = (_route?: unknown) => {
    void _route;
    navigate("/enregistrer");
  };

  return (
    <IonPage>
      <TopBar title="Parcours" />

      <IonContent fullscreen className="sq-parcours-content">
        <main className="sq-parcours-container">
          <header className="sq-parcours-header">
            <h1 className="sq-parcours-title">Bibliothèque de parcours</h1>
            <p className="sq-parcours-subtitle">
              Explorez les boucles publiques partagées par la communauté.
            </p>
          </header>

          {/* Barre de recherche */}
          <div className="sq-parcours-search-wrap">
            <IonSearchbar
              value={searchQuery}
              onIonInput={(e) => setSearchQuery(e.detail.value ?? "")}
              placeholder="Lieu, nom du parcours..."
              className="sq-parcours-searchbar"
            />
          </div>

          {/* Filtres : Près de moi / Course / Vélo */}
          <div className="sq-parcours-filters" role="tablist">
            <button
              type="button"
              className={`sq-parcours-filter-btn ${filter === "pres_de_moi" ? "is-active" : ""}`}
              onClick={() => setFilter("pres_de_moi")}
            >
              Près de moi
            </button>
            <button
              type="button"
              className={`sq-parcours-filter-btn ${filter === "course" ? "is-active" : ""}`}
              onClick={() => setFilter("course")}
            >
              Course
            </button>
            <button
              type="button"
              className={`sq-parcours-filter-btn ${filter === "velo" ? "is-active" : ""}`}
              onClick={() => setFilter("velo")}
            >
              Vélo
            </button>
          </div>

          {/* Liste des parcours */}
          <section className="sq-parcours-list" aria-label="Liste des parcours">
            {filteredRoutes.map((route) => (
              <article
                key={route.id}
                className="sq-card sq-card-interactive sq-parcours-card"
                onClick={() => handleSelectRoute(route)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectRoute(route);
                  }
                }}
              >
                <div className="sq-parcours-trace-col">
                  <QuestTracePreview
                    distanceKm={route.distanceKm}
                    elevationMeters={route.elevationMeters}
                    className="sq-parcours-mini-trace"
                  />
                </div>

                <div className="sq-parcours-info-col">
                  <h2 className="sq-parcours-item-title">{route.title}</h2>
                  <p className="sq-parcours-item-stats">
                    {route.distanceKm} km • {route.elevationMeters} m de
                    dénivelé
                  </p>
                  <p className="sq-parcours-item-meta">
                    À {route.proximityKm} km • Publié par {route.author}
                  </p>
                </div>
              </article>
            ))}

            {filteredRoutes.length === 0 && (
              <div className="sq-parcours-empty">
                <IonIcon
                  icon={compassOutline}
                  className="sq-parcours-empty-icon"
                />
                <p>Aucun parcours ne correspond à votre recherche.</p>
              </div>
            )}
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default Parcours;
