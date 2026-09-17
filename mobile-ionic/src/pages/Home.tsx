import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonProgressBar,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { flame, footsteps, play, shield, trophy } from "ionicons/icons";
import "./Home.css";

const Home: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Stride Quest</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Stride Quest</IonTitle>
          </IonToolbar>
        </IonHeader>
        <main className="home-shell">
          <section className="welcome-block">
            <IonText color="medium">Bonjour, aventurier</IonText>
            <h1>Chaque pas fait avancer la quête.</h1>
            <p>
              Pars explorer ton quartier et transforme ton effort en puissance
              de combat.
            </p>
          </section>

          <IonCard className="raid-card">
            <IonCardHeader>
              <IonCardSubtitle>Raid en cours</IonCardSubtitle>
              <IonCardTitle>Le Gardien des Brumes</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div className="raid-status">
                <span>
                  <IonIcon icon={shield} /> 68% PV restants
                </span>
                <IonBadge color="warning">Niveau 4</IonBadge>
              </div>
              <IonProgressBar value={0.68} color="warning" />
              <p className="card-hint">
                Encore 420 points de dégâts pour obtenir le coffre.
              </p>
              <IonButton expand="block" routerLink="/activity">
                <IonIcon slot="start" icon={play} />
                Démarrer une activité
              </IonButton>
            </IonCardContent>
          </IonCard>

          <section className="stats-grid" aria-label="Statistiques du joueur">
            <div className="stat-tile">
              <IonIcon icon={footsteps} color="primary" />
              <strong>12,4 km</strong>
              <IonText color="medium">Cette semaine</IonText>
            </div>
            <div className="stat-tile">
              <IonIcon icon={flame} color="warning" />
              <strong>3 jours</strong>
              <IonText color="medium">Série active</IonText>
            </div>
            <div className="stat-tile">
              <IonIcon icon={trophy} color="success" />
              <strong>1 280 XP</strong>
              <IonText color="medium">Niveau 7</IonText>
            </div>
          </section>

          <section className="activity-section">
            <div className="section-heading">
              <h2>Dernière activité</h2>
              <IonText color="primary">Voir tout</IonText>
            </div>
            <div className="activity-row">
              <div className="activity-icon">
                <IonIcon icon={footsteps} />
              </div>
              <div>
                <strong>Balade du parc</strong>
                <IonText color="medium">3,2 km · 34 min</IonText>
              </div>
              <IonBadge color="success">+160 XP</IonBadge>
            </div>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default Home;
