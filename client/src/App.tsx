import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import DeckPage from "./pages/DeckPage";
import ProjectPage from "./pages/ProjectPage";
import ProjectsPage from "./pages/ProjectsPage";
import StudyPage from "./pages/StudyPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/decks/:deckId" element={<DeckPage />} />
        <Route path="/study/deck/:deckId" element={<StudyPage mode="deck" />} />
        <Route path="/study/project/:projectId" element={<StudyPage mode="project" />} />
      </Route>
    </Routes>
  );
}
