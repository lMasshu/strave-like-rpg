import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from "@ionic/react";
import "./Home.css";

const Home: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Accueil</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <main className="blank-shell">
          <div className="blank-canvas">
            <div className="blank-placeholder" />
          </div>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default Home;
