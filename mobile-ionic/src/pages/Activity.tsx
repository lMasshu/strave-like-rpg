import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { locationOutline, navigate } from 'ionicons/icons';
import './Activity.css';

const Activity: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" />
          </IonButtons>
          <IonTitle>Nouvelle activité</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <main className="activity-shell">
          <div className="map-placeholder" role="img" aria-label="Zone de carte en attente de la position GPS">
            <IonIcon icon={navigate} />
            <strong>Carte de parcours</strong>
            <span>La position GPS sera affichée ici.</span>
          </div>
          <section className="activity-intro">
            <IonIcon icon={locationOutline} color="primary" />
            <div>
              <h1>Prêt à explorer ?</h1>
              <p>Autorise l'accès à ta position pour suivre ton trajet et contribuer au raid.</p>
            </div>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default Activity;