import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AssistantPage from "./pages/Assistant/index.jsx";
import ChatHistoryPage from "./pages/ChatHistory/index.jsx";
import NewsDetailPage from "./pages/NewsDetail/index.jsx";
import NewsPage from "./pages/News/index.jsx";
import NotificationsPage from "./pages/Notifications/index.jsx";

export default function App() {
  const location = useLocation();

  return (
    <Routes location={location}>
      <Route path="/" element={<Navigate to="/assistant" replace />} />
      <Route path="/assistant" element={<AssistantPage />} />
      <Route path="/chat-history" element={<ChatHistoryPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/news/flower-festival" element={<NewsDetailPage />} />
      <Route path="*" element={<Navigate to="/assistant" replace />} />
    </Routes>
  );
}
