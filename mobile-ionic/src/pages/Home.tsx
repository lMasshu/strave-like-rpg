import { IonButton, IonContent, IonIcon, IonPage } from "@ionic/react";
import { radioButtonOnOutline } from "ionicons/icons";
import TopBar from "../components/TopBar";
import "./Home.css";

const Home: React.FC = () => {
  return (
    <IonPage>
      <TopBar />

      <IonContent fullscreen>
        <main className="blank-shell">
          <div className="home-card">
            <h2>Prêt pour l'aventure ?</h2>
            <p>Explorez votre environnement et validez vos quêtes GPS.</p>

            <IonButton
              routerLink="/enregistrer"
              expand="block"
              shape="round"
              color="primary"
            >
              <IonIcon slot="start" icon={radioButtonOnOutline} />
              Démarrer une sortie
            </IonButton>
          </div>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default Home;
