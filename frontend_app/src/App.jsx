import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AssistantPage from "./pages/Assistant/index.jsx";
import AdminApp from "./pages/Admin/index.jsx";
import AppealsPage from "./pages/Appeals/index.jsx";
import AppealDetailPage from "./pages/AppealDetail/index.jsx";
import ChatConversationPage from "./pages/ChatConversation/index.jsx";
import ChatHistoryPage from "./pages/ChatHistory/index.jsx";
import ContactsPage from "./pages/Contacts/index.jsx";
import LoginPage from "./pages/Login/index.jsx";
import NewsDetailPage from "./pages/NewsDetail/index.jsx";
import NewsPage from "./pages/News/index.jsx";
import NotificationsPage from "./pages/Notifications/index.jsx";
import OutageSchedulePage from "./pages/OutageSchedule/index.jsx";
import PollDetailPage from "./pages/PollDetail/index.jsx";
import PollsPage from "./pages/Polls/index.jsx";
import ProfilePage from "./pages/Profile/index.jsx";
import RegisterPage from "./pages/Register/index.jsx";
import ServicesPage from "./pages/Services/index.jsx";
import TransportPage from "./pages/Transport/index.jsx";
import RequireAuth from "./components/routing/RequireAuth.jsx";
import RequireAdmin from "./components/routing/RequireAdmin.jsx";

export default function App() {
  const location = useLocation();

  return (
    <Routes location={location}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<Navigate to="/assistant" replace />} />
      <Route path="/assistant" element={<RequireAuth><AssistantPage /></RequireAuth>} />
      <Route path="/admin/*" element={<RequireAdmin><AdminApp /></RequireAdmin>} />
      <Route path="/chat-history" element={<RequireAuth><ChatHistoryPage /></RequireAuth>} />
      <Route path="/chat-history/:chatId" element={<RequireAuth><ChatConversationPage /></RequireAuth>} />
      <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
      <Route path="/news" element={<RequireAuth><NewsPage /></RequireAuth>} />
      <Route path="/news/:newsId" element={<RequireAuth><NewsDetailPage /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      <Route path="/services" element={<RequireAuth><ServicesPage /></RequireAuth>} />
      <Route path="/services/contacts" element={<RequireAuth><ContactsPage /></RequireAuth>} />
      <Route path="/services/polls" element={<RequireAuth><PollsPage /></RequireAuth>} />
      <Route path="/services/polls/:pollId" element={<RequireAuth><PollDetailPage /></RequireAuth>} />
      <Route path="/services/appeals" element={<RequireAuth><AppealsPage /></RequireAuth>} />
      <Route path="/services/appeals/:appealId" element={<RequireAuth><AppealDetailPage /></RequireAuth>} />
      <Route path="/services/transport" element={<RequireAuth><TransportPage /></RequireAuth>} />
      <Route path="/services/outages" element={<RequireAuth><OutageSchedulePage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/assistant" replace />} />
    </Routes>
  );
}
