import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import LoginModal from "./LoginModal";
import * as auth0 from "@auth0/auth0-react";

vi.mock("@ionic/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ionic/react")>();
  return {
    ...actual,
    IonModal: ({
      isOpen,
      children,
      ...props
    }: {
      isOpen: boolean;
      children?: React.ReactNode;
      [key: string]: unknown;
    }) =>
      isOpen ? (
        <div data-testid="ion-modal" {...props}>
          {children}
        </div>
      ) : null,
  };
});

describe("LoginModal component", () => {
  const mockLoginWithPopup = vi.fn().mockResolvedValue({});
  const mockLoginWithRedirect = vi.fn().mockResolvedValue({});
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(auth0, "useAuth0").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: undefined,
      loginWithPopup: mockLoginWithPopup,
      loginWithRedirect: mockLoginWithRedirect,
      logout: vi.fn(),
      getAccessTokenSilently: vi.fn(),
      getAccessTokenWithPopup: vi.fn(),
      getIdTokenClaims: vi.fn(),
      loginWithAuthorize: vi.fn(),
      handleRedirectCallback: vi.fn(),
      error: undefined,
    } as unknown as ReturnType<typeof auth0.useAuth0>);
  });

  it("renders brand, slogan, and login action buttons", () => {
    render(<LoginModal isOpen={true} onClose={mockOnClose} />);

    expect(
      screen.getByText(/Transformez chaque sortie en quête épique/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continuer avec Google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Se connecter par Email/i }),
    ).toBeInTheDocument();
  });

  it("calls loginWithPopup with google-oauth2 connection when clicking Google button", async () => {
    render(<LoginModal isOpen={true} onClose={mockOnClose} />);

    const googleBtn = screen.getByRole("button", {
      name: /Continuer avec Google/i,
    });
    await act(async () => {
      fireEvent.click(googleBtn);
    });

    expect(mockLoginWithPopup).toHaveBeenCalledWith({
      authorizationParams: {
        connection: "google-oauth2",
      },
    });
  });

  it("calls loginWithPopup when clicking Email button", async () => {
    render(<LoginModal isOpen={true} onClose={mockOnClose} />);

    const emailBtn = screen.getByRole("button", {
      name: /Se connecter par Email/i,
    });
    await act(async () => {
      fireEvent.click(emailBtn);
    });

    expect(mockLoginWithPopup).toHaveBeenCalled();
  });

  it("calls onClose when clicking close button", async () => {
    render(<LoginModal isOpen={true} onClose={mockOnClose} />);

    const closeBtn = screen.getByLabelText(/Fermer la fenêtre de connexion/i);
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
