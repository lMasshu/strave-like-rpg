import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { mapOutline } from "ionicons/icons";
import "./Home.css";

const Home: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Stride Quest</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <main className="blank-shell">
          <div className="home-card">
            <h2>Prêt pour l'aventure ?</h2>
            <p>Explorez votre environnement et validez vos quêtes GPS.</p>
            <IonButton
              routerLink="/map"
              expand="block"
              shape="round"
              color="primary"
            >
              <IonIcon slot="start" icon={mapOutline} />
              Ouvrir la Carte
            </IonButton>
          </div>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default Home;
