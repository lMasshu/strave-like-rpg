import { IonAvatar, IonContent, IonPage, IonProgressBar } from "@ionic/react";
import TopBar from "../components/TopBar";
import "./Profile.css";

// Données de démonstration, à brancher sur le compte connecté plus tard.
const PROFILE = {
  username: "Alexis",
  level: 5,
  experience: 340,
  nextLevelExperience: 500,
  friends: 12,
  activities: 27,
  totalKm: 143,
};

const Profile: React.FC = () => {
  const progress = PROFILE.experience / PROFILE.nextLevelExperience;

  return (
    <IonPage>
      <TopBar title="Profil" />

      <IonContent>
        <section className="profile-hero">
          <IonAvatar className="profile-avatar">
            {PROFILE.username.charAt(0).toUpperCase()}
          </IonAvatar>

          <h2>{PROFILE.username}</h2>
          <p>Niveau {PROFILE.level}</p>

          <IonProgressBar value={progress} className="profile-xp" />
          <small>
            {PROFILE.experience} / {PROFILE.nextLevelExperience} XP
          </small>
        </section>

        <section className="profile-stats">
          <div>
            <strong>{PROFILE.activities}</strong>
            <span>Sorties</span>
          </div>

          <div>
            <strong>{PROFILE.totalKm}</strong>
            <span>Km</span>
          </div>

          <div>
            <strong>{PROFILE.friends}</strong>
            <span>Amis</span>
          </div>
        </section>
      </IonContent>
    </IonPage>
  );
};

export default Profile;
