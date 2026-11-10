import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { checkmarkCircle } from "ionicons/icons";
import {
  ColorPalette,
  useThemeMode,
} from "../hooks/useThemeMode";
import "./Settings.css";

interface PaletteOption {
  id: ColorPalette;
  name: string;
  description: string;
  colors: [string, string, string];
}

const PALETTES: PaletteOption[] = [
  {
    id: "lime-frost",
    name: "Lime Frost",
    description: "Énergique, frais et sportif",
    colors: ["#aff33e", "#0f172a", "#fbfcf8"],
  },
  {
    id: "violet-bloom",
    name: "Violet Bloom",
    description: "Vibrant, expressif et lumineux",
    colors: ["#7033ff", "#e2ebff", "#fdfdfd"],
  },
  {
    id: "scarlet-snow",
    name: "Scarlet Snow",
    description: "Franc, chaleureux et contrasté",
    colors: ["#e11d48", "#ffe4e8", "#fffafa"],
  },
];

const Settings: React.FC = () => {
  const { palette, setPalette } = useThemeMode();

  return (
    <IonPage>
      <IonHeader className="top-bar" translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton
              defaultHref="/accueil"
              text=""
              aria-label="Retour"
            />
          </IonButtons>
          <IonTitle>Paramètres</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="settings-page-content">
        <main className="settings-container">
          <header className="settings-intro">
            <span className="settings-eyebrow">Personnalisation</span>
            <h1>Paramètres</h1>
            <p>Adaptez Stride Quest à votre style d’aventure.</p>
          </header>

          <section aria-labelledby="palette-heading">
            <div className="settings-section-heading">
              <div>
                <h2 id="palette-heading">Thème de l’interface</h2>
                <p>Choisissez une palette. Le mode clair ou sombre reste indépendant.</p>
              </div>
            </div>

            <div
              className="settings-palette-grid"
              role="radiogroup"
              aria-label="Palette de couleurs"
            >
              {PALETTES.map((option) => {
                const isSelected = palette === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`settings-palette-card ${isSelected ? "is-selected" : ""}`}
                    onClick={() => setPalette(option.id)}
                  >
                    <span className="settings-palette-preview" aria-hidden="true">
                      {option.colors.map((color) => (
                        <span key={color} style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    <span className="settings-palette-copy">
                      <strong>{option.name}</strong>
                      <small>{option.description}</small>
                    </span>
                    <IonIcon
                      className="settings-palette-check"
                      icon={checkmarkCircle}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
