import "./TodoPlaceholder.css";

export interface TodoPlaceholderProps {
  /** Texte affiché, ex. « TODO: gestion photo de profil ». */
  children: string;
}

/** Emplacement réservé à une fonctionnalité pas encore développée. */
const TodoPlaceholder: React.FC<TodoPlaceholderProps> = ({ children }) => (
  <div className="sq-todo-placeholder" role="note">
    {children}
  </div>
);

export default TodoPlaceholder;
