import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AssistantPage from "./pages/Assistant/index.jsx";
import AppealsPage from "./pages/Appeals/index.jsx";
import ChatConversationPage from "./pages/ChatConversation/index.jsx";
import ChatHistoryPage from "./pages/ChatHistory/index.jsx";
import ContactsPage from "./pages/Contacts/index.jsx";
import NewsDetailPage from "./pages/NewsDetail/index.jsx";
import NewsPage from "./pages/News/index.jsx";
import NotificationsPage from "./pages/Notifications/index.jsx";
import PollDetailPage from "./pages/PollDetail/index.jsx";
import PollsPage from "./pages/Polls/index.jsx";
import ProfilePage from "./pages/Profile/index.jsx";
import ServicesPage from "./pages/Services/index.jsx";
import TransportPage from "./pages/Transport/index.jsx";

export default function App() {
  const location = useLocation();

  return (
    <Routes location={location}>
      <Route path="/" element={<Navigate to="/assistant" replace />} />
      <Route path="/assistant" element={<AssistantPage />} />
      <Route path="/chat-history" element={<ChatHistoryPage />} />
      <Route path="/chat-history/:chatId" element={<ChatConversationPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/news/flower-festival" element={<NewsDetailPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/services/contacts" element={<ContactsPage />} />
      <Route path="/services/polls" element={<PollsPage />} />
      <Route path="/services/polls/:pollId" element={<PollDetailPage />} />
      <Route path="/services/appeals" element={<AppealsPage />} />
      <Route path="/services/transport" element={<TransportPage />} />
      <Route path="*" element={<Navigate to="/assistant" replace />} />
    </Routes>
  );
}
