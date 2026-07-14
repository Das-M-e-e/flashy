import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import DeckPage from "./pages/DeckPage";
import ExamConfigPage from "./pages/ExamConfigPage";
import ExamPage from "./pages/ExamPage";
import ExamTakePage from "./pages/ExamTakePage";
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
        <Route path="/exam/new/deck/:deckId" element={<ExamConfigPage mode="deck" />} />
        <Route path="/exam/new/project/:projectId" element={<ExamConfigPage mode="project" />} />
        <Route path="/exam/:examId" element={<ExamPage />} />
        <Route path="/exam/:examId/take" element={<ExamTakePage />} />
      </Route>
    </Routes>
  );
}
