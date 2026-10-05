import {
  IonAvatar,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useMemo, useState } from "react";
import { DEMO_ATHLETES } from "../data/demo";
import "./FriendSearch.css";

const FriendSearch: React.FC = () => {
  const [query, setQuery] = useState("");
  const [following, setFollowing] = useState<Set<string>>(new Set());

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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/accueil" text="" />
          </IonButtons>

          <IonTitle>Trouver des amis</IonTitle>
        </IonToolbar>

        <IonToolbar>
          <IonSearchbar
            placeholder="Pseudo ou ville"
            debounce={200}
            onIonInput={(event) => setQuery(event.detail.value ?? "")}
          />
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {results.length === 0 ? (
          <p className="friends-empty">Aucun sportif trouvé.</p>
        ) : (
          <IonList lines="full">
            {results.map((athlete) => {
              const isFollowing = following.has(athlete.id);

              return (
                <IonItem key={athlete.id}>
                  <IonAvatar slot="start" className="friends-avatar">
                    {athlete.username.charAt(0).toUpperCase()}
                  </IonAvatar>

                  <IonLabel>
                    <h2>{athlete.username}</h2>
                    <p>
                      Niveau {athlete.level} · {athlete.city}
                    </p>
                  </IonLabel>

                  <IonButton
                    slot="end"
                    size="small"
                    shape="round"
                    fill={isFollowing ? "outline" : "solid"}
                    onClick={() => toggleFollow(athlete.id)}
                  >
                    {isFollowing ? "Suivi" : "Suivre"}
                  </IonButton>
                </IonItem>
              );
            })}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default FriendSearch;
